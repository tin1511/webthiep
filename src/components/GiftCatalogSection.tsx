import React, { useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Check,
  Gift,
  Minus,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { CONFIG, GiftSetProduct, OccasionId, formatVnd } from '../config';
import {
  OrderCartItem,
  ShopOrderRecord,
  createGiftSetOrder,
} from '../firebase';

interface GiftCatalogSectionProps {
  giftSets: GiftSetProduct[];
  currentUser: User | null;
  onOrderCreated: (order: ShopOrderRecord) => void;
}

type MainFilterTab = 'all' | 'nu' | 'nam' | 'dip' | 'ngan-sach';
type BudgetRange = 'all' | 'under-300' | '300-500' | 'above-500';

export const GiftCatalogSection: React.FC<GiftCatalogSectionProps> = ({
  giftSets,
  currentUser,
  onOrderCreated,
}) => {
  const [mainTab, setMainTab] = useState<MainFilterTab>('all');
  const [occasionFilter, setOccasionFilter] = useState<OccasionId | 'all'>('all');
  const [budgetFilter, setBudgetFilter] = useState<BudgetRange>('all');
  const [detailProduct, setDetailProduct] = useState<GiftSetProduct | null>(null);
  const [cart, setCart] = useState<OrderCartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState<boolean>(false);

  const [customerName, setCustomerName] = useState<string>(currentUser?.displayName || '');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [wantPrintedQr, setWantPrintedQr] = useState<boolean>(true);
  const [submittingOrder, setSubmittingOrder] = useState<boolean>(false);
  const [orderError, setOrderError] = useState<string>('');

  const filteredProducts = useMemo(() => {
    return giftSets.filter((item) => {
      if (mainTab === 'nu' && item.audience !== 'nu' && item.audience !== 'unisex') return false;
      if (mainTab === 'nam' && item.audience !== 'nam' && item.audience !== 'unisex') return false;
      if (mainTab === 'dip' && occasionFilter !== 'all' && item.occasionTag !== occasionFilter) {
        return false;
      }
      if (mainTab === 'ngan-sach') {
        if (budgetFilter === 'under-300' && item.price >= 300000) return false;
        if (budgetFilter === '300-500' && (item.price < 300000 || item.price > 500000)) {
          return false;
        }
        if (budgetFilter === 'above-500' && item.price <= 500000) return false;
      }
      return true;
    });
  }, [giftSets, mainTab, occasionFilter, budgetFilter]);

  const totalCartItems = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );
  const totalCartAmount = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );

  const addToCart = (product: GiftSetProduct, openDrawerImmediately = false) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        { id: product.id, title: product.title, price: product.price, quantity: 1 },
      ];
    });
    if (openDrawerImmediately) {
      if (!customerName && currentUser?.displayName) {
        setCustomerName(currentUser.displayName);
      }
      setCheckoutOpen(true);
    }
  };

  const updateCartQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const handlePlaceGiftOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError('');
    setSubmittingOrder(true);
    try {
      const order = await createGiftSetOrder({
        customerName,
        customerPhone,
        customerAddress,
        note,
        wantPrintedQr,
        items: cart,
      });
      setCart([]);
      setCheckoutOpen(false);
      onOrderCreated(order);
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Không thể đặt hàng lúc này.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const audienceLabel = (aud: GiftSetProduct['audience']) =>
    aud === 'nu' ? 'Cho Nữ' : aud === 'nam' ? 'Cho Nam' : 'Nam & Nữ';

  return (
    <section id="set-qua" className="py-14 sm:py-16 border-b border-[#E6BE73]/10 bg-[#181310]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Tiêu đề & Thanh bộ lọc Set quà */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-medium text-[#E6BE73] m-0">
              Mảng B · Set quà tuyển chọn Nam &amp; Nữ
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#F7F1E8] m-0">
              Hộp quà chỉn chu — Tặng kèm web thiệp 3D trị giá 59.000đ
            </h2>
            <p className="text-sm text-[#B8ABA0] leading-relaxed m-0">
              Mỗi đơn đặt set quà được tặng ngay 01 web thiệp Gói Tùy Chỉnh với giá 0đ và lựa chọn in sẵn mã QR bỏ gọn trong hộp.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              role="tablist"
              aria-label="Phân loại set quà"
              className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#14100E] border border-[#E6BE73]/15"
            >
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'nu', label: 'Cho Nữ' },
                { id: 'nam', label: 'Cho Nam' },
                { id: 'dip', label: 'Theo dịp' },
                { id: 'ngan-sach', label: 'Ngân sách' },
              ].map((tab) => {
                const active = mainTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setMainTab(tab.id as MainFilterTab)}
                    className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[#E6BE73] text-[#1A1208] font-semibold'
                        : 'text-[#C8BDB2] hover:text-[#F7F1E8]'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {totalCartItems > 0 && (
              <button
                type="button"
                onClick={() => setCheckoutOpen(true)}
                className="min-h-[42px] px-4 rounded-xl bg-[#E6BE73] text-[#1A1208] text-xs sm:text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span className="tabular-nums">
                  Giỏ hàng ({totalCartItems}) · {formatVnd(totalCartAmount)}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Bộ lọc phụ theo dịp hoặc theo ngân sách */}
        {mainTab === 'dip' && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[#A89B8E]">Lọc theo dịp:</span>
            <button
              type="button"
              onClick={() => setOccasionFilter('all')}
              className={`min-h-[36px] px-3 rounded-lg border cursor-pointer ${
                occasionFilter === 'all'
                  ? 'border-[#E6BE73] bg-[#251D18] text-[#E6BE73]'
                  : 'border-[#E6BE73]/15 bg-[#14100E] text-[#C8BDB2]'
              }`}
            >
              Mọi dịp
            </button>
            {CONFIG.occasions.map((occ) => (
              <button
                key={occ.id}
                type="button"
                onClick={() => setOccasionFilter(occ.id)}
                className={`min-h-[36px] px-3 rounded-lg border cursor-pointer ${
                  occasionFilter === occ.id
                    ? 'border-[#E6BE73] bg-[#251D18] text-[#E6BE73]'
                    : 'border-[#E6BE73]/15 bg-[#14100E] text-[#C8BDB2]'
                }`}
              >
                {occ.title}
              </button>
            ))}
          </div>
        )}

        {mainTab === 'ngan-sach' && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[#A89B8E]">Chọn mức giá:</span>
            {[
              { id: 'all', label: 'Tất cả mức giá' },
              { id: 'under-300', label: 'Dưới 300.000đ' },
              { id: '300-500', label: '300.000đ – 500.000đ' },
              { id: 'above-500', label: 'Trên 500.000đ' },
            ].map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBudgetFilter(b.id as BudgetRange)}
                className={`min-h-[36px] px-3 rounded-lg border cursor-pointer ${
                  budgetFilter === b.id
                    ? 'border-[#E6BE73] bg-[#251D18] text-[#E6BE73]'
                    : 'border-[#E6BE73]/15 bg-[#14100E] text-[#C8BDB2]'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        )}

        {/* Lưới sản phẩm Set quà */}
        {filteredProducts.length === 0 ? (
          <div className="rounded-2xl border border-[#E6BE73]/15 bg-[#14100E] p-8 text-center text-sm text-[#A89B8E]">
            Chưa có set quà phù hợp với bộ lọc này. Bạn thử chọn bộ lọc khác nhé.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {filteredProducts.map((product) => (
              <article
                key={product.id}
                className="rounded-2xl border border-[#E6BE73]/18 bg-[#1D1714] overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <button
                    type="button"
                    onClick={() => setDetailProduct(product)}
                    className="block w-full aspect-square bg-[#14100E] overflow-hidden p-0 border-0 cursor-pointer"
                  >
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      className="w-full h-full object-cover hover:scale-105 transition-transform"
                    />
                  </button>

                  <div className="p-4 sm:p-5 space-y-2.5">
                    <div className="text-xs text-[#A89B8E] flex items-center gap-1.5">
                      <span className="text-[#E6BE73] font-medium">
                        {audienceLabel(product.audience)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Tặng web thiệp 0đ</span>
                    </div>

                    <h3 className="text-base font-semibold text-[#F7F1E8] m-0 leading-snug">
                      {product.title}
                    </h3>

                    <div className="text-lg font-bold text-[#E6BE73] tabular-nums">
                      {formatVnd(product.price)}
                    </div>

                    <p className="text-xs text-[#C8BDB2] leading-relaxed m-0 line-clamp-2">
                      {product.description}
                    </p>
                  </div>
                </div>

                <div className="px-4 sm:px-5 pb-5 pt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailProduct(product)}
                    className="min-h-[42px] px-3 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] hover:bg-[#271E1A] text-xs font-medium text-[#F7F1E8] cursor-pointer"
                  >
                    Chi tiết
                  </button>
                  <button
                    type="button"
                    disabled={!product.inStock}
                    onClick={() => addToCart(product, true)}
                    className="flex-1 min-h-[42px] px-4 rounded-xl bg-[#E6BE73] hover:bg-[#F0CC88] disabled:opacity-50 text-[#1A1208] text-xs sm:text-sm font-semibold cursor-pointer"
                  >
                    {product.inStock ? 'Đặt mua' : 'Hết hàng'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Modal chi tiết Set quà */}
      {detailProduct && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetailProduct(null);
          }}
        >
          <div className="my-auto w-full max-w-2xl rounded-2xl border border-[#E6BE73]/30 bg-[#1B1512] overflow-hidden grid grid-cols-1 md:grid-cols-12">
            <div className="md:col-span-5 bg-[#14100E]">
              <img
                src={detailProduct.imageUrl}
                alt={detailProduct.title}
                className="w-full h-full min-h-[240px] object-cover"
              />
            </div>
            <div className="md:col-span-7 p-5 sm:p-6 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-[#E6BE73] font-medium m-0">
                      {audienceLabel(detailProduct.audience)} · Tặng kèm Web thiệp 0đ
                    </p>
                    <h3 className="text-lg font-bold text-[#F7F1E8] m-0 mt-1">
                      {detailProduct.title}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailProduct(null)}
                    className="min-h-[38px] min-w-[38px] rounded-lg bg-[#271F1A] text-[#F7F1E8] flex items-center justify-center cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-2xl font-bold text-[#E6BE73] tabular-nums">
                  {formatVnd(detailProduct.price)}
                </div>

                <p className="text-xs sm:text-sm text-[#C8BDB2] leading-relaxed m-0">
                  {detailProduct.description}
                </p>

                <div className="space-y-1.5 pt-2 border-t border-[#E6BE73]/12">
                  <p className="text-xs font-semibold text-[#F7F1E8] m-0">
                    Thành phần bên trong hộp quà:
                  </p>
                  <ul className="space-y-1.5 text-xs text-[#D7CCC0] pl-0 m-0 list-none">
                    {detailProduct.items.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-[#E6BE73] shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    addToCart(detailProduct, false);
                    setDetailProduct(null);
                  }}
                  className="min-h-[44px] px-4 rounded-xl border border-[#E6BE73]/30 bg-[#14100E] text-xs font-medium text-[#F7F1E8] cursor-pointer"
                >
                  Thêm vào giỏ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    addToCart(detailProduct, true);
                    setDetailProduct(null);
                  }}
                  className="flex-1 min-h-[44px] px-5 rounded-xl bg-[#E6BE73] hover:bg-[#F0CC88] text-[#1A1208] text-sm font-semibold cursor-pointer"
                >
                  Đặt mua ngay
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drawer Giỏ hàng & Form đặt hàng Set quà */}
      {checkoutOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex justify-end"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCheckoutOpen(false);
          }}
        >
          <div className="w-full max-w-lg h-full bg-[#1B1512] border-l border-[#E6BE73]/25 p-5 sm:p-6 overflow-y-auto flex flex-col justify-between gap-6">
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3 border-b border-[#E6BE73]/15 pb-4">
                <div className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-[#E6BE73]" />
                  <h3 className="text-lg font-bold text-[#F7F1E8] m-0">
                    Giỏ hàng &amp; Đặt Set quà
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCheckoutOpen(false)}
                  className="min-h-[40px] min-w-[40px] rounded-xl bg-[#271F1A] text-[#F7F1E8] flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {cart.length === 0 ? (
                <p className="text-sm text-[#A89B8E] py-6 text-center">
                  Giỏ hàng của bạn đang trống. Hãy chọn một Set quà yêu thích nhé.
                </p>
              ) : (
                <>
                  {/* Danh sách sản phẩm trong giỏ */}
                  <div className="space-y-2.5">
                    {cart.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-[#E6BE73]/15 bg-[#14100E] p-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-[#F7F1E8] truncate">
                            {item.title}
                          </div>
                          <div className="text-xs text-[#E6BE73] tabular-nums">
                            {formatVnd(item.price)}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.id, -1)}
                            className="w-8 h-8 rounded-lg bg-[#251D18] text-[#F7F1E8] flex items-center justify-center cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-7 text-center text-sm font-semibold tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.id, 1)}
                            className="w-8 h-8 rounded-lg bg-[#251D18] text-[#F7F1E8] flex items-center justify-center cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.id, -item.quantity)}
                            className="w-8 h-8 rounded-lg bg-[#2A1D1B] text-[#F09D8B] flex items-center justify-center cursor-pointer ml-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Form nhận hàng */}
                  <form onSubmit={handlePlaceGiftOrder} className="space-y-3.5">
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/25 p-3 text-xs text-emerald-200 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span>
                        Đơn hàng này được <strong>tặng kèm 01 Web thiệp Tùy Chỉnh (0đ)</strong> ngay sau khi đặt!
                      </span>
                    </div>

                    <label className="block space-y-1">
                      <span className="text-xs text-[#D7CCC0]">Họ và tên người đặt *</span>
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="VD: Nguyễn Minh An"
                        className="w-full min-h-[42px] px-3 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm text-[#F7F1E8]"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs text-[#D7CCC0]">Số điện thoại nhận hàng / Zalo *</span>
                      <input
                        type="tel"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="VD: 09xx xxx xxx"
                        className="w-full min-h-[42px] px-3 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm text-[#F7F1E8]"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs text-[#D7CCC0]">Địa chỉ giao hàng *</span>
                      <input
                        type="text"
                        required
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
                        className="w-full min-h-[42px] px-3 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm text-[#F7F1E8]"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs text-[#D7CCC0]">Ghi chú cho shop</span>
                      <textarea
                        rows={2}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="VD: Giao giờ hành chính, viết tay thêm lời nhắn ngoài hộp..."
                        className="w-full p-3 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm text-[#F7F1E8]"
                      />
                    </label>

                    <label className="flex items-start gap-2.5 text-xs text-[#D7CCC0] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={wantPrintedQr}
                        onChange={(e) => setWantPrintedQr(e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-[#E6BE73]"
                      />
                      <span>
                        <strong>In sẵn mã QR Web thiệp vào thiệp giấy đặt trong hộp quà</strong> (miễn phí)
                      </span>
                    </label>

                    {orderError && <p className="text-xs text-[#F09D8B] m-0">{orderError}</p>}

                    <div className="pt-3 border-t border-[#E6BE73]/15 space-y-3">
                      <div className="flex items-center justify-between text-base font-bold">
                        <span>Tổng thanh toán:</span>
                        <span className="text-[#E6BE73] tabular-nums">
                          {formatVnd(totalCartAmount)}
                        </span>
                      </div>

                      <button
                        type="submit"
                        disabled={submittingOrder}
                        className="w-full min-h-[48px] rounded-xl bg-[#E6BE73] hover:bg-[#F0CC88] disabled:opacity-60 text-[#1A1208] text-sm font-bold cursor-pointer"
                      >
                        {submittingOrder ? 'Đang tạo đơn hàng...' : 'Xác nhận đặt đơn & Lấy mã QR'}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
