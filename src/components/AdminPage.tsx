import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  ArrowLeft,
  BookOpen,
  Database,
  ExternalLink,
  KeyRound,
  Lock,
  LogOut,
  Package,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Unlock,
  Users,
} from 'lucide-react';
import { CONFIG, GiftAudience, GiftSetProduct, OccasionId, PricingTier, formatVnd } from '../config';
import {
  AdminAccessStatus,
  CustomerProfileRecord,
  PaymentNotificationRecord,
  ShopOrderRecord,
  WebCardRecord,
  changeAdminPasswordAndClearFirstFlag,
  checkAdminPrivilege,
  deleteGiftSetAdmin,
  deleteWebCardAdmin,
  fetchAllCustomersForAdmin,
  fetchAllOrdersForAdmin,
  fetchAllPaymentNotificationsForAdmin,
  fetchAllWebCardsForAdmin,
  logoutAccount,
  saveGiftSetAdmin,
  savePricingTiersAdmin,
  seedDefaultGiftSetsAdmin,
  sendPasswordResetForEmail,
  signInAdminWithGoogle,
  signInAdminWithUsernameOrEmail,
  toggleWebCardLockAdmin,
  updateOrderStatusAdmin,
} from '../firebase';

interface AdminPageProps {
  currentUser: User | null;
  pricingTiers: PricingTier[];
  giftSets: GiftSetProduct[];
  onRefreshStoreData: () => void;
  onOpenCard: (code: string) => void;
  onBackHome: () => void;
}

type AdminTab = 'orders' | 'cards' | 'gifts' | 'pricing' | 'customers' | 'password' | 'guide';

const LOCKOUT_STORAGE_KEY = 'shop_admin_lockout_state';

function readLockoutState(): { failures: number; lockedUntil: number } {
  try {
    const raw = localStorage.getItem(LOCKOUT_STORAGE_KEY);
    if (!raw) return { failures: 0, lockedUntil: 0 };
    const parsed = JSON.parse(raw);
    return {
      failures: Number(parsed.failures || 0),
      lockedUntil: Number(parsed.lockedUntil || 0),
    };
  } catch {
    return { failures: 0, lockedUntil: 0 };
  }
}

function writeLockoutState(failures: number, lockedUntil: number) {
  try {
    localStorage.setItem(LOCKOUT_STORAGE_KEY, JSON.stringify({ failures, lockedUntil }));
  } catch {
    // ignore
  }
}

export const AdminPage: React.FC<AdminPageProps> = ({
  currentUser,
  pricingTiers,
  giftSets,
  onRefreshStoreData,
  onOpenCard,
  onBackHome,
}) => {
  const [adminStatus, setAdminStatus] = useState<AdminAccessStatus | null>(null);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);

  // Đăng nhập Admin
  const [usernameInput, setUsernameInput] = useState<string>('admin');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [loginBusy, setLoginBusy] = useState<boolean>(false);
  const [loginMessage, setLoginMessage] = useState<string>('');
  const [lockState, setLockState] = useState(readLockoutState);
  const [nowMs, setNowMs] = useState<number>(Date.now());

  // Đổi mật khẩu (bắt buộc lần đầu & trong tab Đổi mật khẩu)
  const [curPass, setCurPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passStatus, setPassStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [savingPass, setSavingPass] = useState(false);

  // Dữ liệu dashboard
  const [activeTab, setActiveTab] = useState<AdminTab>('orders');
  const [orders, setOrders] = useState<ShopOrderRecord[]>([]);
  const [paymentNotifs, setPaymentNotifs] = useState<PaymentNotificationRecord[]>([]);
  const [webCards, setWebCards] = useState<WebCardRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerProfileRecord[]>([]);
  const [loadingDash, setLoadingDash] = useState<boolean>(false);
  const [dashNotice, setDashNotice] = useState<string>('');

  // Form Set quà CRUD
  const [editingGift, setEditingGift] = useState<GiftSetProduct | null>(null);
  const [giftItemsText, setGiftItemsText] = useState<string>('');
  const [savingGift, setSavingGift] = useState<boolean>(false);

  // Bảng giá chỉnh sửa
  const [draftPricing, setDraftPricing] = useState<PricingTier[]>(pricingTiers);
  const [savingPricing, setSavingPricing] = useState<boolean>(false);

  useEffect(() => {
    setDraftPricing(pricingTiers);
  }, [pricingTiers]);

  // Đếm ngược khóa 5 phút nếu bị khóa do sai >= 5 lần
  useEffect(() => {
    if (lockState.lockedUntil <= Date.now()) return;
    const iv = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [lockState.lockedUntil]);

  // Kiểm tra quyền Admin mỗi khi phiên Auth thay đổi
  useEffect(() => {
    let mounted = true;
    setCheckingAuth(true);
    checkAdminPrivilege(currentUser)
      .then((res) => {
        if (!mounted) return;
        setAdminStatus(res);
      })
      .finally(() => {
        if (mounted) setCheckingAuth(false);
      });
    return () => {
      mounted = false;
    };
  }, [currentUser?.uid]);

  const loadDashboardData = async () => {
    setLoadingDash(true);
    try {
      const [ordRes, notifRes, cardRes, custRes] = await Promise.all([
        fetchAllOrdersForAdmin(),
        fetchAllPaymentNotificationsForAdmin(),
        fetchAllWebCardsForAdmin(),
        fetchAllCustomersForAdmin(),
      ]);
      setOrders(ordRes);
      setPaymentNotifs(notifRes);
      setWebCards(cardRes);
      setCustomers(custRes);
    } catch (err) {
      setDashNotice(
        err instanceof Error ? err.message : 'Không thể tải dữ liệu quản trị từ Firestore.'
      );
    } finally {
      setLoadingDash(false);
    }
  };

  useEffect(() => {
    if (adminStatus?.isAdmin && !adminStatus.mustChangePassword) {
      loadDashboardData();
    }
  }, [adminStatus?.isAdmin, adminStatus?.mustChangePassword]);

  const remainingLockSec = Math.max(0, Math.ceil((lockState.lockedUntil - nowMs) / 1000));
  const isLockedOut = remainingLockSec > 0;

  const registerFailedAttempt = () => {
    const nextFail = lockState.failures + 1;
    if (nextFail >= CONFIG.adminMaxFailedAttempts) {
      const until = Date.now() + CONFIG.adminLockoutMs;
      writeLockoutState(0, until);
      setLockState({ failures: 0, lockedUntil: until });
      setNowMs(Date.now());
    } else {
      writeLockoutState(nextFail, 0);
      setLockState({ failures: nextFail, lockedUntil: 0 });
    }
  };

  const handleAdminPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut) return;
    setLoginMessage('');
    setLoginBusy(true);
    try {
      const { status } = await signInAdminWithUsernameOrEmail(usernameInput, passwordInput);
      writeLockoutState(0, 0);
      setLockState({ failures: 0, lockedUntil: 0 });
      setAdminStatus(status);
      setPasswordInput('');
    } catch (err) {
      registerFailedAttempt();
      // Thông báo lỗi chung chung, không lộ sai tên đăng nhập hay sai mật khẩu (trừ lỗi chưa cấu hình adminEmail)
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('CONFIG.adminEmail')) {
        setLoginMessage(msg);
      } else {
        setLoginMessage('Thông tin đăng nhập không hợp lệ hoặc tài khoản chưa được cấp quyền quản trị.');
      }
    } finally {
      setLoginBusy(false);
    }
  };

  const handleAdminGoogleLogin = async () => {
    if (isLockedOut) return;
    setLoginMessage('');
    setLoginBusy(true);
    try {
      const { status } = await signInAdminWithGoogle();
      writeLockoutState(0, 0);
      setLockState({ failures: 0, lockedUntil: 0 });
      setAdminStatus(status);
    } catch {
      registerFailedAttempt();
      setLoginMessage('Thông tin đăng nhập không hợp lệ hoặc tài khoản chưa được cấp quyền quản trị.');
    } finally {
      setLoginBusy(false);
    }
  };

  const handleAdminForgotPassword = async () => {
    setLoginMessage('');
    const target =
      usernameInput.trim().toLowerCase() === 'admin'
        ? CONFIG.adminEmail
        : usernameInput.trim();
    if (!target || target.includes('[') || !target.includes('@')) {
      setLoginMessage(
        'Vui lòng điền email quản trị thật vào CONFIG.adminEmail hoặc ô tài khoản trước khi gửi đặt lại mật khẩu.'
      );
      return;
    }
    try {
      await sendPasswordResetForEmail(target);
      setLoginMessage('Đã gửi email đặt lại mật khẩu tới hộp thư quản trị (nếu tài khoản tồn tại).');
    } catch (err) {
      setLoginMessage(err instanceof Error ? err.message : 'Không thể gửi email đặt lại mật khẩu.');
    }
  };

  const handleUpdateAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassStatus(null);
    setSavingPass(true);
    try {
      await changeAdminPasswordAndClearFirstFlag(curPass, newPass, confirmPass);
      setCurPass('');
      setNewPass('');
      setConfirmPass('');
      setPassStatus({ type: 'ok', text: 'Đã đổi mật khẩu quản trị thành công.' });
      setAdminStatus((prev) =>
        prev ? { ...prev, mustChangePassword: false } : { isAdmin: true, mustChangePassword: false }
      );
    } catch (err) {
      setPassStatus({
        type: 'err',
        text: err instanceof Error ? err.message : 'Không thể đổi mật khẩu quản trị.',
      });
    } finally {
      setSavingPass(false);
    }
  };

  const handleOrderStatusChange = async (
    order: ShopOrderRecord,
    newStatus: ShopOrderRecord['status']
  ) => {
    try {
      await updateOrderStatusAdmin(order.orderCode, newStatus, order.cardCode);
      setOrders((prev) =>
        prev.map((o) => (o.orderCode === order.orderCode ? { ...o, status: newStatus } : o))
      );
      setDashNotice(`Đã cập nhật trạng thái đơn ${order.orderCode}.`);
      loadDashboardData();
    } catch (err) {
      setDashNotice(err instanceof Error ? err.message : 'Không thể cập nhật đơn hàng.');
    }
  };

  const handleToggleCardLock = async (card: WebCardRecord) => {
    try {
      const nextLocked = !card.locked;
      const nextStatus = nextLocked ? card.status : 'active';
      await toggleWebCardLockAdmin(card.code, nextLocked, nextStatus);
      setWebCards((prev) =>
        prev.map((c) =>
          c.code === card.code ? { ...c, locked: nextLocked, status: nextStatus } : c
        )
      );
    } catch (err) {
      setDashNotice(err instanceof Error ? err.message : 'Không thể đổi trạng thái khóa thiệp.');
    }
  };

  const handleDeleteCard = async (code: string) => {
    try {
      await deleteWebCardAdmin(code);
      setWebCards((prev) => prev.filter((c) => c.code !== code));
      setDashNotice(`Đã xóa web thiệp /c/${code}.`);
    } catch (err) {
      setDashNotice(err instanceof Error ? err.message : 'Không thể xóa thiệp.');
    }
  };

  const startNewGift = () => {
    setEditingGift({
      id: `set-${Date.now().toString(36)}`,
      title: '',
      audience: 'nu',
      occasionTag: 'noel',
      price: 299000,
      imageUrl: CONFIG.defaultGiftSets[0]?.imageUrl || '',
      description: '',
      items: ['01 Hộp quà cao cấp & ruy băng', '01 Thiệp QR 3D tặng kèm 0đ'],
      inStock: true,
    });
    setGiftItemsText('01 Hộp quà cao cấp & ruy băng\n01 Thiệp QR 3D tặng kèm 0đ');
  };

  const startEditGift = (gift: GiftSetProduct) => {
    setEditingGift({ ...gift });
    setGiftItemsText(gift.items.join('\n'));
  };

  const handleSaveGift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGift) return;
    setSavingGift(true);
    try {
      await saveGiftSetAdmin({
        ...editingGift,
        items: giftItemsText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setEditingGift(null);
      onRefreshStoreData();
      setDashNotice('Đã lưu sản phẩm Set quà lên Firestore.');
    } catch (err) {
      setDashNotice(err instanceof Error ? err.message : 'Không thể lưu Set quà.');
    } finally {
      setSavingGift(false);
    }
  };

  const handleSavePricing = async () => {
    setSavingPricing(true);
    try {
      const normalized = draftPricing.map((t) => ({
        ...t,
        priceText: formatVnd(t.price),
      }));
      await savePricingTiersAdmin(normalized);
      onRefreshStoreData();
      setDashNotice('Đã cập nhật bảng giá web thiệp lên Firestore.');
    } catch (err) {
      setDashNotice(err instanceof Error ? err.message : 'Không thể lưu bảng giá.');
    } finally {
      setSavingPricing(false);
    }
  };

  // ==================== CHƯA ĐĂNG NHẬP HOẶC KHÔNG PHẢI ADMIN ====================
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#14100E] text-[#F7F1E8] flex items-center justify-center p-4 text-sm text-[#B8ABA0]">
        Đang kiểm tra quyền quản trị viên...
      </div>
    );
  }

  if (!currentUser || !adminStatus?.isAdmin) {
    return (
      <div className="min-h-screen bg-[#14100E] text-[#F7F1E8] flex flex-col">
        <header className="border-b border-[#E6BE73]/15 bg-[#181310] px-4 h-16 flex items-center justify-between">
          <button
            type="button"
            onClick={onBackHome}
            className="min-h-[40px] px-3.5 rounded-xl border border-[#E6BE73]/25 bg-[#221B17] text-xs font-medium text-[#F7F1E8] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#E6BE73]" />
            <span>Về trang chủ</span>
          </button>
          <span className="text-xs text-[#A89B8E]">Khu vực Quản trị · /admin</span>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl border border-[#E6BE73]/25 bg-[#1B1512] p-6 sm:p-7 space-y-5">
            <div className="text-center space-y-1.5">
              <div className="mx-auto w-11 h-11 rounded-xl bg-[#E6BE73]/15 text-[#E6BE73] flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold m-0">Đăng nhập Quản trị viên</h1>
              <p className="text-xs text-[#B8ABA0] m-0">
                Xác thực qua Firebase Authentication &amp; danh sách quyền <code className="text-[#E6BE73]">admins/&lt;UID&gt;</code>
              </p>
            </div>

            {currentUser && !adminStatus?.isAdmin && (
              <div className="rounded-xl border border-[#B83B4A]/40 bg-[#2A1819] p-3 text-xs text-[#F09D8B] space-y-2">
                <div>
                  Tài khoản hiện tại (<strong>{currentUser.email}</strong>) chưa có document trong Firestore collection{' '}
                  <code>admins/{currentUser.uid}</code>.
                </div>
                <button
                  type="button"
                  onClick={() => logoutAccount()}
                  className="underline text-xs text-white bg-transparent border-0 p-0 cursor-pointer"
                >
                  Đăng xuất tài khoản này
                </button>
              </div>
            )}

            {isLockedOut && (
              <div className="rounded-xl border border-[#B83B4A]/50 bg-[#2A1819] p-3.5 text-xs text-[#F09D8B]">
                Đăng nhập tạm khóa trong <strong>{Math.floor(remainingLockSec / 60)}p {remainingLockSec % 60}s</strong> do nhập sai quá {CONFIG.adminMaxFailedAttempts} lần liên tiếp.
              </div>
            )}

            <form onSubmit={handleAdminPasswordLogin} className="space-y-3.5">
              <label className="block space-y-1">
                <span className="text-xs text-[#D7CCC0]">Tên đăng nhập ("admin") hoặc Email</span>
                <input
                  type="text"
                  required
                  disabled={isLockedOut}
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="admin"
                  className="w-full min-h-[42px] px-3 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm text-[#F7F1E8]"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs text-[#D7CCC0]">Mật khẩu</span>
                <input
                  type="password"
                  required
                  disabled={isLockedOut}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full min-h-[42px] px-3 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm text-[#F7F1E8]"
                />
              </label>

              {loginMessage && <p className="text-xs text-[#F09D8B] m-0">{loginMessage}</p>}

              <button
                type="submit"
                disabled={loginBusy || isLockedOut}
                className="w-full min-h-[46px] rounded-xl bg-[#E6BE73] hover:bg-[#F0CC88] disabled:opacity-50 text-[#1A1208] text-sm font-bold cursor-pointer"
              >
                {loginBusy ? 'Đang xác thực...' : 'Đăng nhập Quản trị'}
              </button>
            </form>

            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleAdminForgotPassword}
                className="text-[#E6BE73] hover:underline bg-transparent border-0 p-0 cursor-pointer text-xs"
              >
                Quên mật khẩu?
              </button>
              <span className="text-[#8F8378]">
                Sai còn {Math.max(0, CONFIG.adminMaxFailedAttempts - lockState.failures)} lần
              </span>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-[#8F8378]">
              <div className="h-px flex-1 bg-[#E6BE73]/15" />
              <span>hoặc</span>
              <div className="h-px flex-1 bg-[#E6BE73]/15" />
            </div>

            <button
              type="button"
              disabled={loginBusy || isLockedOut}
              onClick={handleAdminGoogleLogin}
              className="w-full min-h-[46px] rounded-xl border border-[#E6BE73]/35 bg-[#241C18] hover:bg-[#2E241E] text-sm font-semibold text-[#F7F1E8] cursor-pointer"
            >
              Đăng nhập bằng Google (Email cho phép)
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ==================== BẮT BUỘC ĐỔI MẬT KHẨU LẦN ĐẦU (mustChangePassword: true) ====================
  if (adminStatus.mustChangePassword) {
    return (
      <div className="min-h-screen bg-[#14100E] text-[#F7F1E8] flex items-center justify-center p-4">
        <form
          onSubmit={handleUpdateAdminPassword}
          className="max-w-md w-full rounded-2xl border border-[#E6BE73]/35 bg-[#1B1512] p-6 sm:p-7 space-y-4"
        >
          <div className="space-y-1">
            <p className="text-xs text-[#E6BE73] font-semibold m-0">Bảo mật đăng nhập lần đầu</p>
            <h1 className="text-xl font-bold m-0">Bắt buộc đổi mật khẩu Admin</h1>
            <p className="text-xs text-[#C8BDB2] m-0 leading-relaxed">
              Tài khoản quản trị đang gắn cờ <code className="text-[#E6BE73]">mustChangePassword</code>. Vui lòng đổi sang mật khẩu mạnh mới (tối thiểu 8 ký tự có chữ và số) để tiếp tục vào bảng quản trị.
            </p>
          </div>

          <input
            type="password"
            required
            value={curPass}
            onChange={(e) => setCurPass(e.target.value)}
            placeholder="Mật khẩu hiện tại"
            className="w-full min-h-[42px] px-3 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm text-[#F7F1E8]"
          />
          <input
            type="password"
            required
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            placeholder="Mật khẩu mới (≥ 8 ký tự, gồm chữ và số)"
            className="w-full min-h-[42px] px-3 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm text-[#F7F1E8]"
          />
          <input
            type="password"
            required
            value={confirmPass}
            onChange={(e) => setConfirmPass(e.target.value)}
            placeholder="Nhập lại mật khẩu mới lần 2"
            className="w-full min-h-[42px] px-3 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm text-[#F7F1E8]"
          />

          {passStatus && (
            <p
              className={`text-xs m-0 ${
                passStatus.type === 'ok' ? 'text-emerald-300' : 'text-[#F09D8B]'
              }`}
            >
              {passStatus.text}
            </p>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => logoutAccount()}
              className="min-h-[44px] px-4 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-xs font-medium text-[#D7CCC0] cursor-pointer"
            >
              Đăng xuất
            </button>
            <button
              type="submit"
              disabled={savingPass}
              className="flex-1 min-h-[44px] rounded-xl bg-[#E6BE73] text-[#1A1208] text-sm font-bold cursor-pointer"
            >
              {savingPass ? 'Đang lưu...' : 'Đổi mật khẩu & Vào Admin'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ==================== BẢNG ĐIỀU KHIỂN QUẢN TRỊ ĐẦY ĐỦ ====================
  return (
    <div className="min-h-screen bg-[#14100E] text-[#F7F1E8]">
      <header className="border-b border-[#E6BE73]/15 bg-[#181310]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBackHome}
              className="min-h-[40px] px-3 rounded-xl border border-[#E6BE73]/25 bg-[#221B17] text-xs font-medium text-[#F7F1E8] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-[#E6BE73]" />
              <span>Cửa hàng</span>
            </button>
            <div className="truncate">
              <div className="text-sm font-bold text-[#E6BE73] truncate">
                Quản trị {CONFIG.shopName}
              </div>
              <div className="text-[11px] text-[#A89B8E] truncate">{currentUser.email}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={loadDashboardData}
              className="min-h-[40px] px-3 rounded-xl border border-[#E6BE73]/25 bg-[#221B17] text-xs text-[#F7F1E8] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#E6BE73] ${loadingDash ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Làm mới</span>
            </button>
            <button
              type="button"
              onClick={() => logoutAccount()}
              className="min-h-[40px] px-3 rounded-xl border border-[#B83B4A]/40 bg-[#271919] text-xs text-[#F09D8B] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Thoát</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Thanh chuyển tab chức năng */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-[#1B1512] border border-[#E6BE73]/15">
          {[
            { id: 'orders', label: `Đơn hàng (${orders.length})`, icon: Package },
            { id: 'cards', label: `Web thiệp (${webCards.length})`, icon: Sparkles },
            { id: 'gifts', label: `Set quà (${giftSets.length})`, icon: Database },
            { id: 'pricing', label: 'Bảng giá', icon: Sparkles },
            { id: 'customers', label: `Khách hàng (${customers.length})`, icon: Users },
            { id: 'password', label: 'Đổi mật khẩu', icon: KeyRound },
            { id: 'guide', label: 'Hướng dẫn Firebase', icon: BookOpen },
          ].map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as AdminTab)}
                className={`min-h-[40px] px-3.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${
                  active ? 'bg-[#E6BE73] text-[#1A1208] font-semibold' : 'text-[#C8BDB2] hover:text-[#F7F1E8]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {dashNotice && (
          <div className="rounded-xl border border-[#E6BE73]/30 bg-[#1F1814] px-4 py-2.5 text-xs text-[#E6BE73] flex items-center justify-between gap-3">
            <span>{dashNotice}</span>
            <button
              type="button"
              onClick={() => setDashNotice('')}
              className="text-[#A89B8E] underline bg-transparent border-0 text-xs cursor-pointer"
            >
              Ẩn
            </button>
          </div>
        )}

        {/* TAB 1: ĐƠN HÀNG & BÁO CHUYỂN KHOẢN */}
        {activeTab === 'orders' && (
          <div className="space-y-5">
            {paymentNotifs.length > 0 && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-2">
                <div className="text-xs font-bold text-emerald-300">
                  Thông báo "Đã chuyển khoản" mới từ khách ({paymentNotifs.length})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {paymentNotifs.slice(0, 6).map((n) => (
                    <div
                      key={n.id}
                      className="rounded-lg bg-[#14100E] border border-emerald-500/20 p-2.5 text-xs space-y-0.5"
                    >
                      <div className="font-mono font-bold text-[#E6BE73]">
                        {n.orderCode} · {formatVnd(n.amount)}
                      </div>
                      {n.note && <div className="text-[#D7CCC0]">{n.note}</div>}
                      <div className="text-[10px] text-[#8F8378]">
                        {new Date(n.createdAtMs).toLocaleString('vi-VN')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {orders.map((ord) => (
                <div
                  key={ord.orderCode}
                  className="rounded-2xl border border-[#E6BE73]/18 bg-[#1B1512] p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#A89B8E]">
                      <span className="font-mono font-bold text-[#E6BE73]">{ord.orderCode}</span>
                      <span>·</span>
                      <span>{ord.orderType === 'gift_set' ? 'Đơn Set quà' : 'Đơn Web thiệp'}</span>
                      <span>·</span>
                      <span>{new Date(ord.createdAtMs).toLocaleString('vi-VN')}</span>
                      {ord.customerMarkedPaid && (
                        <>
                          <span>·</span>
                          <span className="text-emerald-300 font-semibold">Khách báo đã CK</span>
                        </>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-[#F7F1E8]">
                      {ord.customerName} {ord.customerPhone ? `· ${ord.customerPhone}` : ''}
                    </div>
                    {ord.customerAddress && (
                      <div className="text-xs text-[#C8BDB2]">Địa chỉ: {ord.customerAddress}</div>
                    )}
                    <div className="text-xs text-[#B8ABA0]">
                      {ord.items.map((i) => `${i.title} x${i.quantity}`).join(', ')} ·{' '}
                      <strong className="text-[#E6BE73] tabular-nums">
                        {formatVnd(ord.totalAmount)}
                      </strong>
                      {ord.wantPrintedQr ? ' · Yêu cầu in QR bỏ hộp' : ''}
                    </div>
                    {ord.cardCode && (
                      <button
                        type="button"
                        onClick={() => onOpenCard(ord.cardCode!)}
                        className="text-xs text-[#E6BE73] underline bg-transparent border-0 p-0 cursor-pointer inline-flex items-center gap-1"
                      >
                        <span>Mở /c/{ord.cardCode}</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {(
                      [
                        { id: 'pending_payment', label: 'Chờ thanh toán' },
                        { id: 'paid', label: 'Đã thanh toán' },
                        { id: 'delivered', label: 'Đã giao' },
                        { id: 'cancelled', label: 'Hủy' },
                      ] as const
                    ).map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => handleOrderStatusChange(ord, st.id)}
                        className={`min-h-[36px] px-3 rounded-lg text-xs font-medium border cursor-pointer ${
                          ord.status === st.id
                            ? 'border-[#E6BE73] bg-[#E6BE73] text-[#1A1208] font-bold'
                            : 'border-[#E6BE73]/20 bg-[#14100E] text-[#D7CCC0]'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: QUẢN LÝ WEB THIỆP (MỞ / KHÓA / XÓA) */}
        {activeTab === 'cards' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {webCards.map((c) => (
              <div
                key={c.code}
                className="rounded-2xl border border-[#E6BE73]/18 bg-[#1B1512] p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-[#E6BE73] font-mono font-bold">
                      /c/{c.code} · {c.occasion} · {c.tier}
                    </div>
                    <h3 className="text-base font-bold m-0 mt-0.5">
                      Gửi {c.recipientName} (từ {c.senderName})
                    </h3>
                    <p className="text-xs text-[#A89B8E] m-0">
                      Trạng thái: {c.locked ? 'Đang khóa' : c.status} · Giá: {formatVnd(c.price)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenCard(c.code)}
                    className="min-h-[36px] px-3 rounded-lg bg-[#271F1A] text-xs text-[#E6BE73] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Xem</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleCardLock(c)}
                    className={`min-h-[36px] px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${
                      c.locked
                        ? 'bg-emerald-900/40 text-emerald-200 border border-emerald-500/40'
                        : 'bg-[#2A201A] text-[#F7F1E8] border border-[#E6BE73]/25'
                    }`}
                  >
                    {c.locked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    <span>{c.locked ? 'Mở khóa' : 'Khóa thiệp'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCard(c.code)}
                    className="min-h-[36px] px-3 rounded-lg bg-[#2A1819] text-[#F09D8B] text-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: THÊM / SỬA / XÓA SET QUÀ */}
        {activeTab === 'gifts' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={startNewGift}
                className="min-h-[42px] px-4 rounded-xl bg-[#E6BE73] text-[#1A1208] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Set quà mới</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  await seedDefaultGiftSetsAdmin();
                  onRefreshStoreData();
                  setDashNotice('Đã nạp 4 Set quà mẫu lên Firestore.');
                }}
                className="min-h-[42px] px-4 rounded-xl border border-[#E6BE73]/30 bg-[#1B1512] text-xs font-medium text-[#E6BE73] cursor-pointer"
              >
                Nạp 4 Set quà mẫu vào Firestore
              </button>
            </div>

            {editingGift && (
              <form
                onSubmit={handleSaveGift}
                className="rounded-2xl border border-[#E6BE73]/35 bg-[#1B1512] p-5 space-y-4"
              >
                <h3 className="text-base font-bold m-0">Thông tin Set quà</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={editingGift.title}
                    onChange={(e) => setEditingGift({ ...editingGift, title: e.target.value })}
                    placeholder="Tên Set quà"
                    className="min-h-[42px] px-3 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm text-[#F7F1E8]"
                  />
                  <input
                    type="number"
                    required
                    min={0}
                    value={editingGift.price}
                    onChange={(e) =>
                      setEditingGift({ ...editingGift, price: Number(e.target.value) })
                    }
                    placeholder="Giá (VNĐ)"
                    className="min-h-[42px] px-3 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm text-[#F7F1E8]"
                  />
                  <select
                    value={editingGift.audience}
                    onChange={(e) =>
                      setEditingGift({ ...editingGift, audience: e.target.value as GiftAudience })
                    }
                    className="min-h-[42px] px-3 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm text-[#F7F1E8]"
                  >
                    <option value="nu">Dành cho Nữ</option>
                    <option value="nam">Dành cho Nam</option>
                    <option value="unisex">Nam &amp; Nữ</option>
                  </select>
                  <select
                    value={editingGift.occasionTag}
                    onChange={(e) =>
                      setEditingGift({
                        ...editingGift,
                        occasionTag: e.target.value as OccasionId | 'all',
                      })
                    }
                    className="min-h-[42px] px-3 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm text-[#F7F1E8]"
                  >
                    <option value="all">Mọi dịp</option>
                    {CONFIG.occasions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.title}
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  type="text"
                  required
                  value={editingGift.imageUrl}
                  onChange={(e) => setEditingGift({ ...editingGift, imageUrl: e.target.value })}
                  placeholder="URL ảnh sản phẩm"
                  className="w-full min-h-[42px] px-3 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm text-[#F7F1E8]"
                />
                <textarea
                  rows={2}
                  required
                  value={editingGift.description}
                  onChange={(e) =>
                    setEditingGift({ ...editingGift, description: e.target.value })
                  }
                  placeholder="Mô tả ngắn gọn về Set quà"
                  className="w-full p-3 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm text-[#F7F1E8]"
                />
                <textarea
                  rows={4}
                  value={giftItemsText}
                  onChange={(e) => setGiftItemsText(e.target.value)}
                  placeholder="Danh sách các món trong hộp (mỗi món 1 dòng)"
                  className="w-full p-3 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm text-[#F7F1E8]"
                />
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={editingGift.inStock}
                    onChange={(e) =>
                      setEditingGift({ ...editingGift, inStock: e.target.checked })
                    }
                  />
                  <span>Còn hàng</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={savingGift}
                    className="min-h-[42px] px-5 rounded-xl bg-[#E6BE73] text-[#1A1208] text-xs font-bold cursor-pointer"
                  >
                    {savingGift ? 'Đang lưu...' : 'Lưu Set quà'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingGift(null)}
                    className="min-h-[42px] px-4 rounded-xl bg-[#271F1A] text-xs text-[#D7CCC0] cursor-pointer"
                  >
                    Hủy
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {giftSets.map((g) => (
                <div
                  key={g.id}
                  className="rounded-2xl border border-[#E6BE73]/18 bg-[#1B1512] p-4 flex items-center gap-4"
                >
                  <img
                    src={g.imageUrl}
                    alt={g.title}
                    className="w-20 h-20 rounded-xl object-cover shrink-0 bg-[#14100E]"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="text-sm font-bold text-[#F7F1E8] truncate">{g.title}</div>
                    <div className="text-xs text-[#E6BE73] tabular-nums">{formatVnd(g.price)}</div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => startEditGift(g)}
                        className="px-3 py-1 rounded-lg bg-[#271F1A] text-xs text-[#F7F1E8] cursor-pointer"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteGiftSetAdmin(g.id);
                          onRefreshStoreData();
                        }}
                        className="px-3 py-1 rounded-lg bg-[#2A1819] text-xs text-[#F09D8B] cursor-pointer"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: SỬA BẢNG GIÁ */}
        {activeTab === 'pricing' && (
          <div className="rounded-2xl border border-[#E6BE73]/20 bg-[#1B1512] p-5 sm:p-6 space-y-5">
            <h2 className="text-lg font-bold m-0">Chỉnh sửa bảng giá Web thiệp</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {draftPricing.map((tier, idx) => (
                <div
                  key={tier.id}
                  className="rounded-xl border border-[#E6BE73]/20 bg-[#14100E] p-4 space-y-3"
                >
                  <div className="text-sm font-bold text-[#E6BE73]">{tier.name}</div>
                  <label className="block space-y-1">
                    <span className="text-xs text-[#B8ABA0]">Giá bán (VNĐ)</span>
                    <input
                      type="number"
                      min={0}
                      value={tier.price}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setDraftPricing((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, price: val } : item))
                        );
                      }}
                      className="w-full min-h-[40px] px-3 rounded-lg border border-[#E6BE73]/20 bg-[#1B1512] text-sm text-[#F7F1E8]"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-[#B8ABA0]">Mô tả thời hạn</span>
                    <input
                      type="text"
                      value={tier.durationText}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraftPricing((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, durationText: val } : item))
                        );
                      }}
                      className="w-full min-h-[40px] px-3 rounded-lg border border-[#E6BE73]/20 bg-[#1B1512] text-xs text-[#F7F1E8]"
                    />
                  </label>
                </div>
              ))}
            </div>
            <button
              type="button"
              disabled={savingPricing}
              onClick={handleSavePricing}
              className="min-h-[44px] px-6 rounded-xl bg-[#E6BE73] text-[#1A1208] text-sm font-bold cursor-pointer"
            >
              {savingPricing ? 'Đang lưu...' : 'Lưu bảng giá lên Firestore'}
            </button>
          </div>
        )}

        {/* TAB 5: DANH SÁCH KHÁCH HÀNG */}
        {activeTab === 'customers' && (
          <div className="rounded-2xl border border-[#E6BE73]/20 bg-[#1B1512] overflow-hidden">
            <div className="p-4 border-b border-[#E6BE73]/15 text-sm font-bold">
              Khách hàng đã đăng ký ({customers.length})
            </div>
            <div className="divide-y divide-[#E6BE73]/10">
              {customers.map((u) => (
                <div
                  key={u.uid}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="text-sm font-semibold text-[#F7F1E8]">{u.displayName}</div>
                    <div className="text-[#B8ABA0]">
                      {u.email} · {u.provider}
                    </div>
                  </div>
                  <div className="text-[#8F8378]">
                    Đăng ký: {new Date(u.createdAtMs).toLocaleDateString('vi-VN')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: ĐỔI MẬT KHẨU ADMIN */}
        {activeTab === 'password' && (
          <form
            onSubmit={handleUpdateAdminPassword}
            className="max-w-md rounded-2xl border border-[#E6BE73]/20 bg-[#1B1512] p-6 space-y-4"
          >
            <h2 className="text-lg font-bold m-0">Đổi mật khẩu Quản trị viên</h2>
            <input
              type="password"
              required
              value={curPass}
              onChange={(e) => setCurPass(e.target.value)}
              placeholder="Mật khẩu hiện tại"
              className="w-full min-h-[42px] px-3 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm text-[#F7F1E8]"
            />
            <input
              type="password"
              required
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="Mật khẩu mới (≥ 8 ký tự, gồm chữ và số)"
              className="w-full min-h-[42px] px-3 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm text-[#F7F1E8]"
            />
            <input
              type="password"
              required
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              placeholder="Nhập lại mật khẩu mới lần 2"
              className="w-full min-h-[42px] px-3 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm text-[#F7F1E8]"
            />
            {passStatus && (
              <p
                className={`text-xs m-0 ${
                  passStatus.type === 'ok' ? 'text-emerald-300' : 'text-[#F09D8B]'
                }`}
              >
                {passStatus.text}
              </p>
            )}
            <button
              type="submit"
              disabled={savingPass}
              className="min-h-[44px] px-5 rounded-xl bg-[#E6BE73] text-[#1A1208] text-sm font-bold cursor-pointer"
            >
              {savingPass ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
            </button>
          </form>
        )}

        {/* TAB 7: HƯỚNG DẪN CẤU HÌNH FIREBASE CONSOLE */}
        {activeTab === 'guide' && (
          <div className="rounded-2xl border border-[#E6BE73]/25 bg-[#1B1512] p-6 space-y-4 text-sm text-[#D7CCC0] leading-relaxed">
            <h2 className="text-lg font-bold text-[#E6BE73] m-0">
              Hướng dẫn cấu hình nhanh trên Firebase Console
            </h2>
            <ol className="space-y-3 pl-5 m-0">
              <li>
                <strong>Bật phương thức đăng nhập:</strong> Vào <em>Firebase Console → Authentication → Sign-in method</em>, bật cả <strong>Email/Password</strong> và <strong>Google</strong>.
              </li>
              <li>
                <strong>Thêm domain vào Authorized domains:</strong> Trong <em>Authentication → Settings → Authorized domains</em>, thêm tên miền web chính thức của bạn (VD: <code>ten-shop.web.app</code> hoặc domain riêng).
              </li>
              <li>
                <strong>Tạo tài khoản Admin:</strong> Trong <em>Authentication → Users → Add user</em>, nhập email quản trị của bạn và mật khẩu ban đầu (≥ 6 ký tự). Sao chép <strong>User UID</strong> vừa tạo, rồi điền email đó vào <code>CONFIG.adminEmail</code> trong <code>src/config.ts</code>.
              </li>
              <li>
                <strong>Cấp quyền Admin bằng Firestore:</strong> Mở <em>Firestore Database</em>, tạo collection <code>admins</code>, tạo document có <strong>Document ID đúng bằng UID của admin</strong> vừa chép, với 2 field: <code>role: "admin"</code> (string) và <code>mustChangePassword: true</code> (boolean).
              </li>
              <li>
                <strong>Dán Security Rules:</strong> Toàn bộ nội dung chuẩn đã có sẵn trong file <code>firestore.rules</code> và <code>storage.rules</code> của dự án để bạn dán vào tab <em>Rules</em> tương ứng nếu triển khai dự án Firebase riêng.
              </li>
            </ol>
          </div>
        )}
      </main>
    </div>
  );
};
