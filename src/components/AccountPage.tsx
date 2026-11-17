import React, { useEffect, useState } from 'react';
import { User, sendEmailVerification } from 'firebase/auth';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  ExternalLink,
  Gift,
  KeyRound,
  LogOut,
  MailCheck,
  ShieldAlert,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { CONFIG, formatVnd } from '../config';
import {
  ShopOrderRecord,
  WebCardRecord,
  buildCardShareUrl,
  changeCustomerPassword,
  deleteCustomerAccountAndData,
  fetchMyOrders,
  fetchMyWebCards,
  isGoogleOnlyAccount,
  loginCustomerWithEmail,
  loginCustomerWithGoogleSmart,
  logoutAccount,
  registerCustomerAccount,
  sendPasswordResetForEmail,
} from '../firebase';

interface AccountPageProps {
  currentUser: User | null;
  onBackHome: () => void;
  onOpenCard: (code: string) => void;
  onCreateNewCard: (giftOrderId?: string) => void;
  onShowLegal: () => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({
  currentUser,
  onBackHome,
  onOpenCard,
  onCreateNewCard,
  onShowLegal,
}) => {
  const [authTab, setAuthTab] = useState<'login' | 'register' | 'reset'>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMsg, setAuthMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [myCards, setMyCards] = useState<WebCardRecord[]>([]);
  const [myOrders, setMyOrders] = useState<ShopOrderRecord[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string>('');

  // Đổi mật khẩu
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newPass2, setNewPass2] = useState('');
  const [passMsg, setPassMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [changingPass, setChangingPass] = useState(false);

  // Xác nhận xóa tài khoản
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deletePass, setDeletePass] = useState('');
  const [deletingAcc, setDeletingAcc] = useState(false);
  const [deleteErr, setDeleteErr] = useState('');

  const googleOnly = isGoogleOnlyAccount(currentUser);

  const loadAccountData = async (uid: string) => {
    setLoadingData(true);
    try {
      const [cards, orders] = await Promise.all([fetchMyWebCards(uid), fetchMyOrders(uid)]);
      setMyCards(cards);
      setMyOrders(orders);
    } catch {
      // ignore initial query errors
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadAccountData(currentUser.uid);
    } else {
      setMyCards([]);
      setMyOrders([]);
    }
  }, [currentUser?.uid]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMsg(null);
    setAuthBusy(true);
    try {
      if (authTab === 'login') {
        await loginCustomerWithEmail(email, password);
        setAuthMsg({ type: 'ok', text: 'Đăng nhập thành công!' });
      } else if (authTab === 'register') {
        const res = await registerCustomerAccount({
          displayName,
          email,
          password,
          agreedTerms,
        });
        setAuthMsg({
          type: 'ok',
          text: res.verificationSent
            ? 'Đăng ký thành công! Chúng tôi đã gửi email xác minh tới hộp thư của bạn.'
            : 'Đăng ký tài khoản thành công!',
        });
      } else {
        await sendPasswordResetForEmail(email);
        setAuthMsg({
          type: 'ok',
          text: 'Đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra hộp thư (kể cả mục Spam).',
        });
      }
    } catch (err) {
      setAuthMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Thao tác thất bại.',
      });
    } finally {
      setAuthBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthMsg(null);
    setAuthBusy(true);
    try {
      await loginCustomerWithGoogleSmart();
    } catch (err) {
      setAuthMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Đăng nhập Google thất bại.',
      });
    } finally {
      setAuthBusy(false);
    }
  };

  const handleCopyCardUrl = async (code: string) => {
    try {
      await navigator.clipboard.writeText(buildCardShareUrl(code));
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(''), 1800);
    } catch {
      // ignore
    }
  };

  const handleDownloadQrPng = async (code: string) => {
    try {
      const url = await QRCode.toDataURL(buildCardShareUrl(code), {
        width: 600,
        margin: 2,
        color: { dark: '#1A1208', light: '#FFFBF3' },
      });
      const a = document.createElement('a');
      a.href = url;
      a.download = `ma-qr-thiep-${code}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      // ignore
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg(null);
    if (newPass !== newPass2) {
      setPassMsg({ type: 'err', text: 'Mật khẩu mới nhập lại lần 2 không khớp.' });
      return;
    }
    setChangingPass(true);
    try {
      await changeCustomerPassword(oldPass, newPass);
      setOldPass('');
      setNewPass('');
      setNewPass2('');
      setPassMsg({ type: 'ok', text: 'Đã cập nhật mật khẩu mới thành công.' });
    } catch (err) {
      setPassMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Không thể đổi mật khẩu.',
      });
    } finally {
      setChangingPass(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteErr('');
    setDeletingAcc(true);
    try {
      await deleteCustomerAccountAndData(googleOnly ? undefined : deletePass);
      setConfirmDeleteOpen(false);
      onBackHome();
    } catch (err) {
      setDeleteErr(err instanceof Error ? err.message : 'Không thể xóa tài khoản.');
    } finally {
      setDeletingAcc(false);
    }
  };

  const formatExpiry = (expiresAtMs: number | null) => {
    if (expiresAtMs === null) return 'Lưu giữ vĩnh viễn';
    if (Date.now() > expiresAtMs) return 'Đã hết hạn';
    const daysLeft = Math.max(1, Math.ceil((expiresAtMs - Date.now()) / (24 * 60 * 60 * 1000)));
    return `Còn ${daysLeft} ngày (${new Date(expiresAtMs).toLocaleDateString('vi-VN')})`;
  };

  const statusText = (status: ShopOrderRecord['status']) => {
    switch (status) {
      case 'paid':
        return 'Đã thanh toán';
      case 'delivered':
        return 'Đã giao / Hoàn tất';
      case 'cancelled':
        return 'Đã hủy';
      default:
        return 'Chờ thanh toán';
    }
  };

  return (
    <div className="min-h-screen bg-[#14100E] text-[#F7F1E8]">
      {/* Thanh trên gọn nhẹ */}
      <header className="border-b border-[#E6BE73]/15 bg-[#181310]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBackHome}
            className="min-h-[42px] px-3.5 rounded-xl border border-[#E6BE73]/25 bg-[#221B17] text-xs sm:text-sm font-medium text-[#F7F1E8] inline-flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#E6BE73]" />
            <span>Về {CONFIG.shopName}</span>
          </button>

          {currentUser && (
            <button
              type="button"
              onClick={() => logoutAccount()}
              className="min-h-[40px] px-3.5 rounded-xl border border-[#E6BE73]/25 bg-[#221B17] text-xs font-medium text-[#F09D8B] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất</span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {!currentUser ? (
          /* ==================== MÀN HÌNH ĐĂNG NHẬP / ĐĂNG KÝ KHÁCH HÀNG ==================== */
          <div className="max-w-md mx-auto rounded-2xl border border-[#E6BE73]/25 bg-[#1B1512] p-6 sm:p-7 space-y-5">
            <div className="space-y-1 text-center">
              <h1 className="text-2xl font-bold m-0">Tài khoản khách hàng</h1>
              <p className="text-xs text-[#B8ABA0] m-0">
                Quản lý lại link web thiệp đã tạo, tải mã QR và theo dõi đơn Set quà.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#14100E] border border-[#E6BE73]/15 text-xs font-medium">
              {[
                { id: 'login', label: 'Đăng nhập' },
                { id: 'register', label: 'Đăng ký' },
                { id: 'reset', label: 'Quên MK' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setAuthTab(t.id as 'login' | 'register' | 'reset');
                    setAuthMsg(null);
                  }}
                  className={`min-h-[38px] rounded-lg cursor-pointer ${
                    authTab === t.id ? 'bg-[#E6BE73] text-[#1A1208] font-semibold' : 'text-[#C8BDB2]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={authBusy}
              onClick={handleGoogleSignIn}
              className="w-full min-h-[46px] rounded-xl border border-[#E6BE73]/35 bg-[#241C18] hover:bg-[#2E241E] text-sm font-semibold text-[#F7F1E8] flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <span>Đăng nhập nhanh bằng Google</span>
            </button>

            <div className="flex items-center gap-3 text-[11px] text-[#8F8378]">
              <div className="h-px flex-1 bg-[#E6BE73]/15" />
              <span>hoặc dùng Email</span>
              <div className="h-px flex-1 bg-[#E6BE73]/15" />
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-3.5">
              {authTab === 'register' && (
                <label className="block space-y-1">
                  <span className="text-xs text-[#D7CCC0]">Họ và tên *</span>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full min-h-[42px] px-3 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm text-[#F7F1E8]"
                  />
                </label>
              )}

              <label className="block space-y-1">
                <span className="text-xs text-[#D7CCC0]">Địa chỉ Email *</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tenban@gmail.com"
                  className="w-full min-h-[42px] px-3 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm text-[#F7F1E8]"
                />
              </label>

              {authTab !== 'reset' && (
                <label className="block space-y-1">
                  <span className="text-xs text-[#D7CCC0]">
                    Mật khẩu {authTab === 'register' ? '(tối thiểu 8 ký tự, có chữ và số)' : ''} *
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full min-h-[42px] px-3 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm text-[#F7F1E8]"
                  />
                </label>
              )}

              {authTab === 'register' && (
                <label className="flex items-start gap-2 text-xs text-[#C8BDB2] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => setAgreedTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#E6BE73]"
                  />
                  <span>
                    Tôi đồng ý với{' '}
                    <button
                      type="button"
                      onClick={onShowLegal}
                      className="text-[#E6BE73] underline bg-transparent border-0 p-0 text-xs cursor-pointer"
                    >
                      Điều khoản sử dụng &amp; Quyền riêng tư
                    </button>
                    .
                  </span>
                </label>
              )}

              {authMsg && (
                <p
                  className={`text-xs m-0 ${
                    authMsg.type === 'ok' ? 'text-emerald-300' : 'text-[#F09D8B]'
                  }`}
                >
                  {authMsg.text}
                </p>
              )}

              <button
                type="submit"
                disabled={authBusy}
                className="w-full min-h-[46px] rounded-xl bg-[#E6BE73] hover:bg-[#F0CC88] disabled:opacity-60 text-[#1A1208] text-sm font-bold cursor-pointer"
              >
                {authBusy
                  ? 'Đang xử lý...'
                  : authTab === 'login'
                    ? 'Đăng nhập'
                    : authTab === 'register'
                      ? 'Đăng ký tài khoản'
                      : 'Gửi email đặt lại mật khẩu'}
              </button>
            </form>
          </div>
        ) : (
          /* ==================== TRANG "TÀI KHOẢN CỦA TÔI" ==================== */
          <div className="space-y-8">
            {/* Thông tin tổng quan tài khoản */}
            <div className="rounded-2xl border border-[#E6BE73]/25 bg-[#1B1512] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs text-[#E6BE73] font-medium m-0">Tài khoản của tôi</p>
                <h1 className="text-2xl font-bold m-0">
                  {currentUser.displayName || currentUser.email || 'Khách hàng'}
                </h1>
                <div className="text-xs text-[#B8ABA0] flex flex-wrap items-center gap-2">
                  <span>{currentUser.email}</span>
                  <span>·</span>
                  <span>
                    {currentUser.emailVerified
                      ? 'Email đã xác minh'
                      : 'Chưa xác minh email'}
                  </span>
                  {!currentUser.emailVerified && !googleOnly && (
                    <button
                      type="button"
                      onClick={() => sendEmailVerification(currentUser).catch(() => {})}
                      className="text-[#E6BE73] underline bg-transparent border-0 p-0 text-xs cursor-pointer inline-flex items-center gap-1"
                    >
                      <MailCheck className="w-3.5 h-3.5" />
                      <span>Gửi lại link xác minh</span>
                    </button>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onCreateNewCard()}
                className="min-h-[46px] px-5 rounded-xl bg-[#E6BE73] hover:bg-[#F0CC88] text-[#1A1208] text-sm font-semibold inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Tạo web thiệp mới</span>
              </button>
            </div>

            {/* Danh sách Web thiệp đã tạo */}
            <section className="space-y-4">
              <h2 className="text-lg font-bold m-0">Web thiệp 3D đã tạo ({myCards.length})</h2>
              {loadingData ? (
                <p className="text-sm text-[#A89B8E]">Đang tải dữ liệu...</p>
              ) : myCards.length === 0 ? (
                <div className="rounded-2xl border border-[#E6BE73]/15 bg-[#1B1512] p-6 text-sm text-[#A89B8E]">
                  Bạn chưa tạo web thiệp nào khi đăng nhập tài khoản này.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myCards.map((c) => {
                    const fullUrl = buildCardShareUrl(c.code);
                    return (
                      <div
                        key={c.code}
                        className="rounded-2xl border border-[#E6BE73]/20 bg-[#1B1512] p-5 space-y-3.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs text-[#E6BE73] font-medium">
                              /c/{c.code} · {c.tier === 'basic' ? 'Cơ bản' : c.tier === 'custom' ? 'Tùy chỉnh' : 'Cao cấp'}
                            </div>
                            <h3 className="text-base font-bold text-[#F7F1E8] m-0 mt-0.5">
                              Gửi: {c.recipientName}
                            </h3>
                            <p className="text-xs text-[#B8ABA0] m-0 mt-0.5">
                              {formatExpiry(c.expiresAtMs)} ·{' '}
                              {c.locked
                                ? 'Đang bị tạm khóa'
                                : c.status === 'active'
                                  ? 'Đã mở hoạt động'
                                  : 'Chờ xác nhận thanh toán'}
                            </p>
                          </div>
                          <span className="text-sm font-bold text-[#E6BE73] tabular-nums">
                            {formatVnd(c.price)}
                          </span>
                        </div>

                        <div className="px-3 py-1.5 rounded-lg bg-[#14100E] text-xs font-mono text-[#D7CCC0] truncate">
                          {fullUrl}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenCard(c.code)}
                            className="min-h-[38px] px-3 rounded-lg bg-[#E6BE73] text-[#1A1208] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Xem thiệp</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyCardUrl(c.code)}
                            className="min-h-[38px] px-3 rounded-lg border border-[#E6BE73]/25 bg-[#14100E] text-xs text-[#F7F1E8] inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            {copiedCode === c.code ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-[#E6BE73]" />
                            )}
                            <span>{copiedCode === c.code ? 'Đã chép' : 'Sao chép link'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadQrPng(c.code)}
                            className="min-h-[38px] px-3 rounded-lg border border-[#E6BE73]/25 bg-[#14100E] text-xs text-[#F7F1E8] inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-[#E6BE73]" />
                            <span>Tải QR</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Lịch sử đơn hàng */}
            <section className="space-y-4">
              <h2 className="text-lg font-bold m-0">Lịch sử đơn hàng ({myOrders.length})</h2>
              {myOrders.length === 0 ? (
                <div className="rounded-2xl border border-[#E6BE73]/15 bg-[#1B1512] p-6 text-sm text-[#A89B8E]">
                  Bạn chưa có đơn hàng nào gắn với tài khoản này.
                </div>
              ) : (
                <div className="space-y-3">
                  {myOrders.map((ord) => (
                    <div
                      key={ord.orderCode}
                      className="rounded-2xl border border-[#E6BE73]/20 bg-[#1B1512] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="text-xs text-[#E6BE73] font-medium">
                          Mã đơn <span className="font-mono font-bold">{ord.orderCode}</span> ·{' '}
                          {new Date(ord.createdAtMs).toLocaleDateString('vi-VN')} ·{' '}
                          <strong>{statusText(ord.status)}</strong>
                        </div>
                        <div className="text-sm font-semibold text-[#F7F1E8]">
                          {ord.items.map((i) => `${i.title} (x${i.quantity})`).join(', ')}
                        </div>
                        <div className="text-xs text-[#A89B8E] tabular-nums">
                          Tổng tiền: <strong className="text-[#E6BE73]">{formatVnd(ord.totalAmount)}</strong>
                        </div>
                      </div>

                      {ord.orderType === 'gift_set' && !ord.giftFreeCardClaimed && (
                        <button
                          type="button"
                          onClick={() => onCreateNewCard(ord.orderCode)}
                          className="min-h-[42px] px-4 rounded-xl bg-[#E6BE73] text-[#1A1208] text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          <Gift className="w-4 h-4" />
                          <span>Tạo web thiệp tặng kèm (0đ)</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Đổi mật khẩu (Ẩn nếu là tài khoản Google) + Xóa tài khoản */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {!googleOnly && (
                <form
                  onSubmit={handleChangePassword}
                  className="rounded-2xl border border-[#E6BE73]/20 bg-[#1B1512] p-5 space-y-3.5"
                >
                  <div className="flex items-center gap-2 text-base font-bold">
                    <KeyRound className="w-4 h-4 text-[#E6BE73]" />
                    <span>Đổi mật khẩu</span>
                  </div>
                  <input
                    type="password"
                    required
                    value={oldPass}
                    onChange={(e) => setOldPass(e.target.value)}
                    placeholder="Mật khẩu hiện tại"
                    className="w-full min-h-[42px] px-3 rounded-xl border border-[#E6BE73]/20 bg-[#14100E] text-sm text-[#F7F1E8]"
                  />
                  <input
                    type="password"
                    required
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="Mật khẩu mới (≥ 8 ký tự, chữ & số)"
                    className="w-full min-h-[42px] px-3 rounded-xl border border-[#E6BE73]/20 bg-[#14100E] text-sm text-[#F7F1E8]"
                  />
                  <input
                    type="password"
                    required
                    value={newPass2}
                    onChange={(e) => setNewPass2(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    className="w-full min-h-[42px] px-3 rounded-xl border border-[#E6BE73]/20 bg-[#14100E] text-sm text-[#F7F1E8]"
                  />
                  {passMsg && (
                    <p
                      className={`text-xs m-0 ${
                        passMsg.type === 'ok' ? 'text-emerald-300' : 'text-[#F09D8B]'
                      }`}
                    >
                      {passMsg.text}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={changingPass}
                    className="min-h-[42px] px-5 rounded-xl bg-[#271F1A] hover:bg-[#332922] border border-[#E6BE73]/30 text-xs font-semibold text-[#F7F1E8] cursor-pointer"
                  >
                    {changingPass ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                  </button>
                </form>
              )}

              <div className="rounded-2xl border border-[#B83B4A]/35 bg-[#1B1312] p-5 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-base font-bold text-[#F09D8B]">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Xóa tài khoản &amp; toàn bộ dữ liệu</span>
                  </div>
                  <p className="text-xs text-[#C8BDB2] leading-relaxed m-0">
                    Thao tác này sẽ xóa vĩnh viễn hồ sơ, toàn bộ web thiệp, ảnh/âm thanh và lịch sử đơn hàng thuộc tài khoản của bạn. Không thể hoàn tác.
                  </p>
                </div>

                {!confirmDeleteOpen ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteOpen(true)}
                    className="min-h-[42px] px-4 rounded-xl border border-[#B83B4A]/50 bg-[#2A1819] text-xs font-semibold text-[#F09D8B] inline-flex items-center justify-center gap-1.5 cursor-pointer self-start"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa tài khoản của tôi</span>
                  </button>
                ) : (
                  <div className="space-y-2.5 pt-2 border-t border-[#B83B4A]/25">
                    {!googleOnly && (
                      <input
                        type="password"
                        value={deletePass}
                        onChange={(e) => setDeletePass(e.target.value)}
                        placeholder="Nhập mật khẩu hiện tại để xác nhận"
                        className="w-full min-h-[40px] px-3 rounded-xl border border-[#B83B4A]/40 bg-[#14100E] text-xs text-[#F7F1E8]"
                      />
                    )}
                    {deleteErr && <p className="text-xs text-[#F09D8B] m-0">{deleteErr}</p>}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={deletingAcc}
                        onClick={handleDeleteAccount}
                        className="min-h-[40px] px-4 rounded-xl bg-[#B83B4A] text-white text-xs font-semibold cursor-pointer"
                      >
                        {deletingAcc ? 'Đang xóa...' : 'Xác nhận xóa vĩnh viễn'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteOpen(false)}
                        className="min-h-[40px] px-3 rounded-xl bg-[#251D19] text-xs text-[#D7CCC0] cursor-pointer"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};
