import React, { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  ChevronDown,
  Gift,
  Mail,
  Menu,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  X,
} from 'lucide-react';
import {
  CONFIG,
  GiftSetProduct,
  OccasionId,
  PricingTier,
  PricingTierId,
} from './config';
import {
  ShopOrderRecord,
  WebCardRecord,
  auth,
  checkAdminPrivilege,
  consumePendingGoogleRedirect,
  fetchGiftSets,
  fetchPricingTiers,
  fetchWebCardByCode,
  subscribeToWebCardByCode,
} from './firebase';
import { HeroParticleDemo } from './components/HeroParticleDemo';
import { CardExperience3D } from './components/CardExperience3D';
import { CardCreatorWizard } from './components/CardCreatorWizard';
import { GiftCatalogSection } from './components/GiftCatalogSection';
import { VietQrModal } from './components/VietQrModal';
import { AccountPage } from './components/AccountPage';
import { AdminPage } from './components/AdminPage';

type RouteView =
  | { view: 'home' }
  | { view: 'card'; code: string }
  | { view: 'account' }
  | { view: 'admin' };

function parseLocationPath(pathname: string): RouteView {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/admin') return { view: 'admin' };
  if (clean === '/tai-khoan') return { view: 'account' };
  if (clean.startsWith('/c/')) {
    const code = decodeURIComponent(clean.slice(3)).trim();
    if (code) return { view: 'card', code };
  }
  return { view: 'home' };
}

export default function App() {
  const [route, setRoute] = useState<RouteView>(() =>
    parseLocationPath(typeof window !== 'undefined' ? window.location.pathname : '/')
  );
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [isAdminUser, setIsAdminUser] = useState<boolean>(false);
  const [activeOccasion, setActiveOccasion] = useState<OccasionId>('noel');
  const [openFaqId, setOpenFaqId] = useState<string>(CONFIG.faqs[0]?.id || '');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [legalOpen, setLegalOpen] = useState<boolean>(false);

  // Dữ liệu đọc từ Firestore (Bảng giá & Set quà)
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>(CONFIG.pricing);
  const [giftSets, setGiftSets] = useState<GiftSetProduct[]>(CONFIG.defaultGiftSets);

  // Trình tạo Web thiệp 3 bước (Giai đoạn 2)
  const [wizardOpen, setWizardOpen] = useState<boolean>(false);
  const [wizardOccasion, setWizardOccasion] = useState<OccasionId>('noel');
  const [wizardTier, setWizardTier] = useState<PricingTierId>('custom');
  const [freeGiftOrderId, setFreeGiftOrderId] = useState<string | null>(null);

  // Modal VietQR sau khi đặt đơn Web thiệp hoặc Set quà
  const [activePaymentModal, setActivePaymentModal] = useState<{
    order: ShopOrderRecord;
    cardCode?: string;
  } | null>(null);

  const [savedCardSession, setSavedCardSession] = useState<{
    order: ShopOrderRecord;
    cardCode?: string;
  } | null>(() => {
    try {
      const raw = localStorage.getItem('last_webcard_payment_v1');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.order && parsed.order.orderCode) return parsed;
    } catch {
      // ignore
    }
    return null;
  });

  // Tải Web thiệp công khai ở route /c/:code
  const [loadedCard, setLoadedCard] = useState<WebCardRecord | null>(null);
  const [loadingCard, setLoadingCard] = useState<boolean>(false);
  const [cardNotFound, setCardNotFound] = useState<boolean>(false);

  const navigateTo = useCallback((path: string) => {
    window.history.pushState({}, '', path);
    setRoute(parseLocationPath(path));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onPop = () => {
      setRoute(parseLocationPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    consumePendingGoogleRedirect();
    const unsub = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
      if (!u) {
        setIsAdminUser(false);
        return;
      }
      checkAdminPrivilege(u)
        .then((res) => setIsAdminUser(res.isAdmin))
        .catch(() => setIsAdminUser(false));
    });
    return () => unsub();
  }, []);

  const refreshStoreData = useCallback(async () => {
    const [tiers, sets] = await Promise.all([fetchPricingTiers(), fetchGiftSets()]);
    setPricingTiers(tiers);
    setGiftSets(sets);
  }, []);

  useEffect(() => {
    refreshStoreData();
  }, [refreshStoreData]);

  // Tải & lắng nghe thời gian thực cấu hình thiệp khi truy cập /c/<code>
  useEffect(() => {
    if (route.view !== 'card') return;
    let active = true;
    setLoadingCard(true);
    setCardNotFound(false);
    setLoadedCard(null);
    fetchWebCardByCode(route.code)
      .then((card) => {
        if (!active) return;
        if (!card) {
          setCardNotFound(true);
        } else {
          setLoadedCard(card);
        }
      })
      .catch(() => {
        if (active) setCardNotFound(true);
      })
      .finally(() => {
        if (active) setLoadingCard(false);
      });

    const unsub = subscribeToWebCardByCode(route.code, (card) => {
      if (!active) return;
      setLoadingCard(false);
      if (!card) {
        setCardNotFound(true);
        setLoadedCard(null);
      } else {
        setCardNotFound(false);
        setLoadedCard(card);
      }
    });

    return () => {
      active = false;
      unsub();
    };
  }, [route]);

  const openWizard = (
    occasion: OccasionId = activeOccasion,
    tier: PricingTierId = 'custom',
    giftOrderId: string | null = null
  ) => {
    setWizardOccasion(occasion);
    setWizardTier(tier);
    setFreeGiftOrderId(giftOrderId);
    setWizardOpen(true);
  };

  const scrollHomeSection = (sectionId: string) => {
    setMobileMenuOpen(false);
    if (route.view !== 'home') {
      navigateTo('/');
      setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
      return;
    }
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ==================== ROUTE: TRANG QUẢN TRỊ /admin ====================
  if (route.view === 'admin') {
    return (
      <AdminPage
        currentUser={currentUser}
        pricingTiers={pricingTiers}
        giftSets={giftSets}
        onRefreshStoreData={refreshStoreData}
        onOpenCard={(code) => navigateTo(`/c/${code}`)}
        onBackHome={() => navigateTo('/')}
      />
    );
  }

  // ==================== ROUTE: TÀI KHOẢN KHÁCH HÀNG /tai-khoan ====================
  if (route.view === 'account') {
    return (
      <>
        <AccountPage
          currentUser={currentUser}
          onBackHome={() => navigateTo('/')}
          onOpenAdmin={() => navigateTo('/admin')}
          onOpenCard={(code) => navigateTo(`/c/${code}`)}
          onCreateNewCard={(giftOrderId) => {
            navigateTo('/');
            openWizard('noel', 'custom', giftOrderId || null);
          }}
          onShowLegal={() => setLegalOpen(true)}
          onOpenPaymentForOrder={(order, cardCode) => {
            setActivePaymentModal({ order, cardCode });
          }}
        />
        {activePaymentModal && (
          <VietQrModal
            order={activePaymentModal.order}
            cardCode={activePaymentModal.cardCode}
            onClose={() => setActivePaymentModal(null)}
            onOpenCardLink={(code) => {
              setActivePaymentModal(null);
              navigateTo(`/c/${code}`);
            }}
            onCreateFreeGiftCard={(giftOrderId) => {
              setActivePaymentModal(null);
              navigateTo('/');
              openWizard('noel', 'custom', giftOrderId);
            }}
          />
        )}
        {legalOpen && (
          <LegalModal onClose={() => setLegalOpen(false)} />
        )}
      </>
    );
  }

  // ==================== ROUTE: TRANG XEM THIỆP CÔNG KHAI /c/<code> ====================
  if (route.view === 'card') {
    if (loadingCard) {
      return (
        <div className="min-h-screen bg-[#14100E] text-[#F7F1E8] flex items-center justify-center p-4 text-sm text-[#E6BE73]">
          Đang mở web thiệp 3D...
        </div>
      );
    }
    if (cardNotFound || !loadedCard) {
      return (
        <div className="min-h-screen bg-[#14100E] text-[#F7F1E8] flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl border border-[#E6BE73]/25 bg-[#1B1512] p-6 space-y-4 text-center">
            <h1 className="text-xl font-bold m-0">Không tìm thấy web thiệp này</h1>
            <p className="text-sm text-[#C8BDB2] leading-relaxed m-0">
              Đường dẫn <code className="text-[#E6BE73]">/c/{route.code}</code> không tồn tại hoặc đã bị xóa khỏi hệ thống.
            </p>
            <button
              type="button"
              onClick={() => navigateTo('/')}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#E6BE73] text-[#1A1208] text-sm font-semibold cursor-pointer"
            >
              Về trang chủ {CONFIG.shopName}
            </button>
          </div>
        </div>
      );
    }
    return (
      <CardExperience3D
        card={loadedCard}
        onBackHome={() => navigateTo('/')}
      />
    );
  }

  // ==================== ROUTE: TRANG BÁN HÀNG CHÍNH (/) ====================
  return (
    <div className="min-h-screen bg-[#14100E] text-[#F7F1E8] flex flex-col">
      {/* Thanh điều hướng 3 vùng gọn nhẹ mobile-first */}
      <header className="sticky top-0 z-40 border-b border-[#E6BE73]/15 bg-[#14100E]/95">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 sm:gap-8">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="font-pacifico text-xl sm:text-2xl text-[#E6BE73] bg-transparent border-0 p-0 whitespace-nowrap shrink-0 tracking-wide cursor-pointer"
          >
            {CONFIG.shopName}
          </button>

          <nav
            aria-label="Điều hướng chính"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-[#D7CCC0]"
          >
            <button
              type="button"
              onClick={() => scrollHomeSection('web-thiep')}
              className="hover:text-[#E6BE73] transition-colors bg-transparent border-0 p-0 whitespace-nowrap shrink-0 py-2 cursor-pointer text-sm font-medium text-[#D7CCC0]"
            >
              Web thiệp
            </button>
            <button
              type="button"
              onClick={() => scrollHomeSection('set-qua')}
              className="hover:text-[#E6BE73] transition-colors bg-transparent border-0 p-0 whitespace-nowrap shrink-0 py-2 cursor-pointer text-sm font-medium text-[#D7CCC0]"
            >
              Set quà
            </button>
            <button
              type="button"
              onClick={() => scrollHomeSection('bang-gia')}
              className="hover:text-[#E6BE73] transition-colors bg-transparent border-0 p-0 whitespace-nowrap shrink-0 py-2 cursor-pointer text-sm font-medium text-[#D7CCC0]"
            >
              Bảng giá
            </button>
            <button
              type="button"
              onClick={() => scrollHomeSection('lien-he')}
              className="hover:text-[#E6BE73] transition-colors bg-transparent border-0 p-0 whitespace-nowrap shrink-0 py-2 cursor-pointer text-sm font-medium text-[#D7CCC0]"
            >
              Liên hệ
            </button>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {isAdminUser && (
              <button
                type="button"
                onClick={() => navigateTo('/admin')}
                className="hidden sm:inline-flex items-center justify-center gap-1.5 min-h-[42px] px-3.5 rounded-xl border border-[#E6BE73]/45 bg-[#2A2016] hover:bg-[#35281B] text-[#E6BE73] text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Quản trị</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => navigateTo('/tai-khoan')}
              className="hidden sm:inline-flex items-center justify-center gap-1.5 min-h-[42px] px-3.5 rounded-xl border border-[#E6BE73]/25 bg-[#1E1815] hover:bg-[#28201C] text-[#F7F1E8] text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
            >
              <UserIcon className="w-3.5 h-3.5 text-[#E6BE73]" />
              <span>{currentUser ? 'Tài khoản' : 'Đăng nhập'}</span>
            </button>

            <button
              type="button"
              onClick={() => openWizard(activeOccasion, 'custom')}
              className="hidden sm:inline-flex items-center justify-center min-h-[42px] px-4 py-2 rounded-xl bg-[#E6BE73] hover:bg-[#F0CC88] text-[#1A1208] text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Tạo web thiệp
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
              className="md:hidden inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl border border-[#E6BE73]/25 bg-[#1E1815] text-[#F7F1E8] cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#E6BE73]/15 bg-[#1B1512] px-4 py-3 space-y-1">
            {[
              { id: 'web-thiep', label: 'Web thiệp' },
              { id: 'set-qua', label: 'Set quà' },
              { id: 'bang-gia', label: 'Bảng giá' },
              { id: 'lien-he', label: 'Liên hệ' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollHomeSection(item.id)}
                className="w-full text-left min-h-[44px] px-3 rounded-lg text-sm font-medium text-[#F7F1E8] hover:bg-[#261E1A] transition-colors cursor-pointer"
              >
                {item.label}
              </button>
            ))}
            {isAdminUser && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigateTo('/admin');
                }}
                className="w-full text-left min-h-[44px] px-3 rounded-lg text-sm font-semibold text-[#E6BE73] bg-[#261E16] hover:bg-[#31261B] cursor-pointer flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Trang Quản trị (/admin)</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                navigateTo('/tai-khoan');
              }}
              className="w-full text-left min-h-[44px] px-3 rounded-lg text-sm font-medium text-[#E6BE73] hover:bg-[#261E1A] cursor-pointer"
            >
              {currentUser ? 'Tài khoản của tôi' : 'Đăng nhập / Đăng ký'}
            </button>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openWizard(activeOccasion, 'custom');
                }}
                className="w-full min-h-[46px] rounded-xl bg-[#E6BE73] text-[#1A1208] text-sm font-semibold cursor-pointer"
              >
                Tạo web thiệp ngay
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {savedCardSession && (
          <div className="bg-[#1E1713] border-b border-[#E6BE73]/25">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="text-[#E6BE73] font-medium">
                Đơn Web thiệp <strong className="font-mono">{savedCardSession.order.orderCode}</strong> vừa tạo · Bấm để xem trạng thái <strong>Chờ duyệt</strong> hoặc nhận <strong>Link thiệp &amp; Mã QR</strong> khi Admin đã duyệt.
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActivePaymentModal(savedCardSession)}
                  className="min-h-[32px] px-3 rounded-lg bg-[#E6BE73] text-[#1A1208] text-xs font-semibold cursor-pointer"
                >
                  Xem trạng thái / Nhận Link &amp; QR
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSavedCardSession(null);
                    try {
                      localStorage.removeItem('last_webcard_payment_v1');
                    } catch {
                      // ignore
                    }
                  }}
                  className="min-h-[32px] px-2 rounded-lg border border-[#E6BE73]/20 bg-[#14100E] text-[#A89B8E] text-xs cursor-pointer"
                >
                  Ẩn
                </button>
              </div>
            </div>
          </div>
        )}
        {/* HERO SECTION + DEMO HẠT 3D CHẠY THẬT */}
        <section className="border-b border-[#E6BE73]/12 bg-[radial-gradient(ellipse_at_top,rgba(184,59,74,0.14)_0%,rgba(20,16,14,0)_60%)]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 lg:py-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
              <div className="lg:col-span-6 flex flex-col justify-center space-y-5">
                <p className="text-xs sm:text-sm font-medium text-[#E6BE73] m-0">
                  {CONFIG.shopName} · Quà tặng &amp; Web thiệp 3D cá nhân hóa
                </p>

                <h1
                  className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold leading-[1.2] text-[#F7F1E8] m-0"
                  style={{ textWrap: 'balance' }}
                >
                  Gửi trọn tấm lòng qua{' '}
                  <span className="font-script text-4xl sm:text-5xl text-[#E6BE73] font-bold">
                    web thiệp 3D
                  </span>{' '}
                  và set quà được gói riêng
                </h1>

                <p className="text-sm sm:text-base text-[#C8BDB2] leading-relaxed m-0 max-w-xl">
                  {CONFIG.shopStory}
                </p>

                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    type="button"
                    onClick={() => openWizard(activeOccasion, 'custom')}
                    className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 py-3 rounded-xl bg-[#E6BE73] hover:bg-[#F0CC88] text-[#1A1208] text-sm sm:text-base font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Tạo web thiệp ngay</span>
                  </button>

                  <a
                    href="#set-qua"
                    className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 py-3 rounded-xl border border-[#E6BE73]/35 bg-[#1E1815] hover:bg-[#28201C] text-[#F7F1E8] text-sm sm:text-base font-medium transition-colors no-underline whitespace-nowrap shrink-0"
                  >
                    <Gift className="w-4 h-4 text-[#E6BE73]" />
                    <span>Xem set quà</span>
                  </a>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#A89B8E]">
                  <span>Mở trực tiếp trên điện thoại</span>
                  <span aria-hidden="true">·</span>
                  <span>Kèm mã QR in thiệp giấy</span>
                  <span aria-hidden="true">·</span>
                  <span>Tặng 0đ gói Tùy chỉnh khi mua Set quà</span>
                </div>
              </div>

              <div id="hero-demo" className="lg:col-span-6 flex flex-col justify-center">
                <HeroParticleDemo
                  activeOccasion={activeOccasion}
                  onSelectOccasion={setActiveOccasion}
                />
              </div>
            </div>
          </div>
        </section>

        {/* MẢNG A: 5 DỊP THIẾT KẾ WEB THIỆP */}
        <section id="web-thiep" className="py-14 sm:py-16 border-b border-[#E6BE73]/10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-medium text-[#E6BE73] m-0">
                Mảng A · Web thiệp hiệu ứng hạt 3D
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#F7F1E8] m-0">
                Năm dịp cảm xúc, thiết kế riêng theo câu chuyện của bạn
              </h2>
              <p className="text-sm text-[#B8ABA0] leading-relaxed m-0">
                Mỗi mẫu là một cảnh hạt 3D chuyển động mượt theo cấu hình lời chúc, ảnh kỷ niệm và nhạc nền riêng.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {CONFIG.occasions.map((occ, index) => {
                const isSelected = activeOccasion === occ.id;
                return (
                  <article
                    key={occ.id}
                    className={`rounded-2xl border p-5 sm:p-6 flex flex-col justify-between gap-4 transition-colors ${
                      isSelected
                        ? 'bg-[#221B17] border-[#E6BE73]/55'
                        : 'bg-[#1A1411] border-[#E6BE73]/15 hover:border-[#E6BE73]/35'
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2 text-xs text-[#B8ABA0]">
                        <span className="tabular-nums">0{index + 1}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate flex-1">{occ.particleShapeLabel}</span>
                      </div>

                      <h3 className="text-lg font-semibold text-[#F7F1E8] m-0">
                        {occ.title}
                      </h3>
                      <p className="text-xs font-medium text-[#E6BE73] m-0">
                        {occ.subtitle}
                      </p>
                      <p className="text-sm text-[#C8BDB2] leading-relaxed m-0">
                        {occ.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveOccasion(occ.id);
                          document
                            .getElementById('hero-demo')
                            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                        className="min-h-[44px] px-3.5 rounded-xl border border-[#E6BE73]/25 bg-[#251E1A] hover:bg-[#2F2621] text-xs font-medium text-[#F7F1E8] cursor-pointer"
                      >
                        Xem thử
                      </button>
                      <button
                        type="button"
                        onClick={() => openWizard(occ.id, 'custom')}
                        className="flex-1 min-h-[44px] rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold bg-[#E6BE73] hover:bg-[#F0CC88] text-[#1A1208] transition-colors cursor-pointer"
                      >
                        Tạo mẫu này
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* MẢNG B: CATALOG SET QUÀ ĐỌC TỪ FIRESTORE + GIỎ HÀNG */}
        <GiftCatalogSection
          giftSets={giftSets}
          currentUser={currentUser}
          onOrderCreated={(order) => setActivePaymentModal({ order })}
        />

        {/* BẢNG GIÁ WEB THIỆP (ĐỌC TỪ FIRESTORE HOẶC CONFIG) */}
        <section id="bang-gia" className="py-14 sm:py-16 border-b border-[#E6BE73]/10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-medium text-[#E6BE73] m-0">
                Bảng giá minh bạch
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#F7F1E8] m-0">
                Chọn gói Web thiệp phù hợp với món quà của bạn
              </h2>
              <p className="text-sm text-[#B8ABA0] leading-relaxed m-0">
                Gói Cơ bản và Tùy chỉnh có thời hạn lưu link rõ ràng; gói Cao cấp được chọn tên link riêng và lưu vĩnh viễn.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              {pricingTiers.map((tier) => (
                <div
                  key={tier.id}
                  className={`rounded-2xl border p-6 flex flex-col justify-between gap-6 ${
                    tier.highlighted
                      ? 'bg-[#231B17] border-[#E6BE73]/60'
                      : 'bg-[#1A1411] border-[#E6BE73]/15'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs text-[#E6BE73]">
                        <span>{tier.name}</span>
                        <span>
                          {tier.highlighted
                            ? 'Phổ biến nhất'
                            : tier.durationDays
                              ? `${tier.durationDays} ngày`
                              : 'Vĩnh viễn'}
                        </span>
                      </div>
                      <div className="text-3xl font-bold text-[#F7F1E8] tabular-nums">
                        {tier.priceText}
                      </div>
                      <p className="text-xs text-[#B8ABA0] m-0">{tier.durationText}</p>
                    </div>

                    <p className="text-sm text-[#D7CCC0] leading-relaxed m-0 pt-3 border-t border-[#E6BE73]/12">
                      {tier.summary}
                    </p>

                    <ul className="space-y-2.5 text-sm text-[#C8BDB2] pl-4 m-0 list-disc">
                      {tier.features.map((feat, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {feat}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => openWizard(activeOccasion, tier.id)}
                    className={`min-h-[46px] w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
                      tier.highlighted
                        ? 'bg-[#E6BE73] hover:bg-[#F0CC88] text-[#1A1208]'
                        : 'bg-[#261E1A] hover:bg-[#322822] text-[#F7F1E8] border border-[#E6BE73]/25'
                    }`}
                  >
                    {tier.ctaLabel}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CÂU HỎI THƯỜNG GẶP (FAQ) */}
        <section id="faq" className="py-14 sm:py-16 border-b border-[#E6BE73]/10 bg-[#181310]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-medium text-[#E6BE73] m-0">Giải đáp nhanh</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#F7F1E8] m-0">
                Câu hỏi thường gặp
              </h2>
            </div>

            <div className="divide-y divide-[#E6BE73]/15 border-y border-[#E6BE73]/15">
              {CONFIG.faqs.map((item) => {
                const isOpen = openFaqId === item.id;
                return (
                  <div key={item.id} className="py-1">
                    <button
                      type="button"
                      onClick={() => setOpenFaqId(isOpen ? '' : item.id)}
                      aria-expanded={isOpen}
                      className="w-full min-h-[52px] py-3 flex items-center justify-between gap-4 text-left text-sm sm:text-base font-medium text-[#F7F1E8] hover:text-[#E6BE73] transition-colors cursor-pointer"
                    >
                      <span>{item.question}</span>
                      <ChevronDown
                        className={`w-4 h-4 shrink-0 text-[#E6BE73] transition-transform ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <p className="pb-4 pr-6 text-sm text-[#C8BDB2] leading-relaxed m-0">
                        {item.answer}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* LIÊN HỆ ZALO / FACEBOOK & THÔNG TIN CHUYỂN KHOẢN */}
        <section id="lien-he" className="py-14 sm:py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              <div className="lg:col-span-7 rounded-2xl border border-[#E6BE73]/20 bg-[#1A1411] p-6 sm:p-8 flex flex-col justify-between gap-6">
                <div className="space-y-3">
                  <p className="text-xs font-medium text-[#E6BE73] m-0">
                    Hỗ trợ &amp; Đặt theo yêu cầu riêng
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-bold text-[#F7F1E8] m-0">
                    Liên hệ {CONFIG.shopName}
                  </h2>
                  <p className="text-sm text-[#C8BDB2] leading-relaxed m-0">
                    Cần gói quà số lượng cho công ty, hỗ trợ kích hoạt link thiệp nhanh hoặc tư vấn chọn set quà? Nhắn tin trực tiếp cho shop qua Zalo hoặc Fanpage bên dưới.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <a
                    href={CONFIG.contact.zaloUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[54px] rounded-xl bg-[#E6BE73] hover:bg-[#F0CC88] text-[#1A1208] px-5 py-3 flex items-center justify-center gap-2.5 text-sm font-semibold no-underline transition-colors"
                  >
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    <span className="truncate">Zalo: {CONFIG.contact.zaloPhone}</span>
                  </a>

                  <a
                    href={CONFIG.contact.facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[54px] rounded-xl border border-[#E6BE73]/30 bg-[#231C18] hover:bg-[#2D241F] text-[#F7F1E8] px-5 py-3 flex items-center justify-center gap-2.5 text-sm font-medium no-underline transition-colors"
                  >
                    <Mail className="w-4 h-4 text-[#E6BE73] shrink-0" />
                    <span className="truncate">Facebook: {CONFIG.contact.facebookName}</span>
                  </a>
                </div>

                <p className="text-xs text-[#A89B8E] m-0">
                  Giờ hỗ trợ: {CONFIG.contact.workingHours} · Email: {CONFIG.contact.email}
                </p>
              </div>

              <div className="lg:col-span-5 rounded-2xl border border-[#E6BE73]/15 bg-[#181310] p-6 sm:p-8 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <p className="text-xs font-medium text-[#E6BE73] m-0">
                    Thông tin thanh toán VietQR
                  </p>
                  <h3 className="text-lg font-semibold text-[#F7F1E8] m-0">
                    Tài khoản ngân hàng nhận chuyển khoản
                  </h3>
                  <div className="space-y-2 text-xs sm:text-sm text-[#C8BDB2] pt-2 border-t border-[#E6BE73]/12">
                    <div className="flex justify-between gap-2">
                      <span className="text-[#A89B8E]">Ngân hàng:</span>
                      <span className="font-medium text-right">{CONFIG.bank.bankName}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-[#A89B8E]">Số tài khoản:</span>
                      <span className="font-medium tabular-nums text-right">
                        {CONFIG.bank.accountNumber}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-[#A89B8E]">Chủ tài khoản:</span>
                      <span className="font-medium text-right">{CONFIG.bank.accountHolder}</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-[#A89B8E] leading-relaxed m-0">
                  Ảnh sản phẩm mẫu, nhạc nền hộp nhạc và hiệu ứng hạt 3D được tạo riêng trong dự án — không dùng tài nguyên có bản quyền bên thứ ba.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER TỐI GIẢN */}
      <footer className="border-t border-[#E6BE73]/12 bg-[#110D0B]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#A89B8E]">
          <div>
            © {new Date().getFullYear()} {CONFIG.shopName} · {CONFIG.shopTagline}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => navigateTo('/tai-khoan')}
              className="hover:text-[#F7F1E8] bg-transparent border-0 p-0 text-xs text-[#A89B8E] cursor-pointer"
            >
              Tài khoản của tôi
            </button>
            <button
              type="button"
              onClick={() => navigateTo('/admin')}
              className="hover:text-[#F7F1E8] bg-transparent border-0 p-0 text-xs text-[#A89B8E] cursor-pointer"
            >
              Quản trị (/admin)
            </button>
            <button
              type="button"
              onClick={() => setLegalOpen(true)}
              className="inline-flex items-center gap-1.5 text-[#E6BE73] hover:underline bg-transparent border-0 p-0 text-xs cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Điều khoản &amp; Quyền riêng tư</span>
            </button>
          </div>
        </div>
      </footer>

      {/* WIZARD TẠO WEB THIỆP 3 BƯỚC */}
      <CardCreatorWizard
        isOpen={wizardOpen}
        initialOccasion={wizardOccasion}
        initialTier={wizardTier}
        freeGiftOrderId={freeGiftOrderId}
        pricingTiers={pricingTiers}
        currentUser={currentUser}
        onClose={() => {
          setWizardOpen(false);
          setFreeGiftOrderId(null);
        }}
        onOpenAuth={() => {
          setWizardOpen(false);
          navigateTo('/tai-khoan');
        }}
        onSuccessCreated={(card, order) => {
          setWizardOpen(false);
          setFreeGiftOrderId(null);
          const session = { order, cardCode: card.code };
          setActivePaymentModal(session);
          setSavedCardSession(session);
          try {
            localStorage.setItem('last_webcard_payment_v1', JSON.stringify(session));
          } catch {
            // ignore
          }
        }}
      />

      {/* MODAL VIETQR + LINK THIỆP + MÃ QR + TẠO THIỆP 0Đ */}
      {activePaymentModal && (
        <VietQrModal
          order={activePaymentModal.order}
          cardCode={activePaymentModal.cardCode}
          onClose={() => setActivePaymentModal(null)}
          onOpenCardLink={(code) => {
            setActivePaymentModal(null);
            navigateTo(`/c/${code}`);
          }}
          onCreateFreeGiftCard={(giftOrderId) => {
            setActivePaymentModal(null);
            openWizard('noel', 'custom', giftOrderId);
          }}
        />
      )}

      {/* MODAL ĐIỀU KHOẢN & QUYỀN RIÊNG TƯ */}
      {legalOpen && <LegalModal onClose={() => setLegalOpen(false)} />}
    </div>
  );
}

const LegalModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div
    className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
    onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}
  >
    <div className="w-full max-w-lg rounded-2xl border border-[#E6BE73]/35 bg-[#1B1512] p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-lg font-semibold text-[#F7F1E8] m-0">{CONFIG.legal.title}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng cửa sổ"
          className="min-h-[38px] min-w-[38px] rounded-lg bg-[#261E1A] text-[#F7F1E8] flex items-center justify-center cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <ul className="space-y-2.5 text-sm text-[#C8BDB2] leading-relaxed pl-4 m-0 list-disc">
        {CONFIG.legal.items.map((item, idx) => (
          <li key={idx}>{item}</li>
        ))}
      </ul>

      <div className="pt-2 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[42px] px-5 py-2 rounded-xl bg-[#E6BE73] text-[#1A1208] text-xs sm:text-sm font-semibold cursor-pointer"
        >
          Đã hiểu
        </button>
      </div>
    </div>
  </div>
);
