import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Gift,
  QrCode,
  Sparkles,
  X,
} from 'lucide-react';
import { CONFIG, formatVnd } from '../config';
import {
  ShopOrderRecord,
  WebCardRecord,
  buildCardShareUrl,
  notifyCustomerTransferred,
  subscribeToWebCardByCode,
} from '../firebase';
import { generateHeartQrDataUrl } from '../heartQr';

interface VietQrModalProps {
  order: ShopOrderRecord;
  cardCode?: string;
  onClose: () => void;
  onCreateFreeGiftCard?: (giftOrderId: string) => void;
  onOpenCardLink?: (code: string) => void;
}

const PAID_STORAGE_PREFIX = 'paid_req_sent_';

export const VietQrModal: React.FC<VietQrModalProps> = ({
  order,
  cardCode,
  onClose,
  onCreateFreeGiftCard,
  onOpenCardLink,
}) => {
  const [liveCard, setLiveCard] = useState<WebCardRecord | null>(null);
  const [cardQrDataUrl, setCardQrDataUrl] = useState<string>('');
  const [fallbackTransferQrUrl, setFallbackTransferQrUrl] = useState<string>('');
  const [vietQrFailed, setVietQrFailed] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [transferNote, setTransferNote] = useState<string>('');
  const [submittingPaid, setSubmittingPaid] = useState<boolean>(false);
  const [markedPaid, setMarkedPaid] = useState<boolean>(() => {
    if (order.customerMarkedPaid) return true;
    try {
      return localStorage.getItem(`${PAID_STORAGE_PREFIX}${order.orderCode}`) === '1';
    } catch {
      return false;
    }
  });
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Lắng nghe thời gian thực trạng thái duyệt của Admin trên webCards/{cardCode}
  useEffect(() => {
    if (!cardCode) {
      setLiveCard(null);
      return;
    }
    const unsub = subscribeToWebCardByCode(cardCode, (card) => {
      setLiveCard(card);
    });
    return () => unsub();
  }, [cardCode]);

  const isApproved = cardCode
    ? Boolean(liveCard && liveCard.status === 'active' && !liveCard.locked)
    : order.status === 'paid' || order.status === 'delivered';

  const isRejected = cardCode
    ? Boolean(liveCard && (liveCard.locked || liveCard.status === 'expired'))
    : order.status === 'cancelled';

  const shareUrl = cardCode && isApproved ? buildCardShareUrl(cardCode) : '';
  const hasRealBank =
    Boolean(CONFIG.bank.accountNumber) && !CONFIG.bank.accountNumber.includes('[');

  const vietQrImgUrl = hasRealBank
    ? `https://img.vietqr.io/image/${encodeURIComponent(CONFIG.bank.bankId)}-${encodeURIComponent(CONFIG.bank.accountNumber)}-compact2.png?amount=${Math.max(0, order.totalAmount)}&addInfo=${encodeURIComponent(order.orderCode)}&accountName=${encodeURIComponent(CONFIG.bank.accountHolder)}`
    : '';

  // Chỉ tạo QR Trái Tim của thiệp sau khi Admin đã duyệt (isApproved === true)
  useEffect(() => {
    let active = true;
    if (shareUrl && isApproved) {
      try {
        const heartUrl = generateHeartQrDataUrl(shareUrl);
        if (active && heartUrl) setCardQrDataUrl(heartUrl);
      } catch {
        QRCode.toDataURL(shareUrl, {
          width: 520,
          margin: 2,
          color: { dark: '#1A1208', light: '#FFFBF3' },
        })
          .then((url) => {
            if (active) setCardQrDataUrl(url);
          })
          .catch(() => {});
      }
    } else {
      setCardQrDataUrl('');
    }
    return () => {
      active = false;
    };
  }, [shareUrl, isApproved]);

  // Tạo mã QR chuyển khoản thanh toán
  useEffect(() => {
    let active = true;
    const transferText = `CHUYEN KHOAN | ${CONFIG.bank.bankName} | STK: ${CONFIG.bank.accountNumber} | SO TIEN: ${order.totalAmount} | NOI DUNG: ${order.orderCode}`;
    QRCode.toDataURL(transferText, {
      width: 420,
      margin: 2,
      color: { dark: '#1A1208', light: '#FFFBF3' },
    })
      .then((url) => {
        if (active) setFallbackTransferQrUrl(url);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [order.orderCode, order.totalAmount]);

  const handleCopy = async (text: string, type: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'code') {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 1800);
      } else {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 1800);
      }
    } catch {
      // ignore clipboard errors
    }
  };

  const handleDownloadCardQr = () => {
    if (!cardQrDataUrl || !cardCode || !isApproved) return;
    const a = document.createElement('a');
    a.href = cardQrDataUrl;
    a.download = `qr-trai-tim-${cardCode}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleConfirmPayment = async () => {
    setErrorMsg('');
    setSubmittingPaid(true);
    try {
      await notifyCustomerTransferred(order.orderCode, order.totalAmount, transferNote);
      setMarkedPaid(true);
      try {
        localStorage.setItem(`${PAID_STORAGE_PREFIX}${order.orderCode}`, '1');
      } catch {
        // ignore storage errors
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể gửi yêu cầu duyệt thanh toán.');
    } finally {
      setSubmittingPaid(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="my-auto w-full max-w-2xl rounded-2xl border border-[#E6BE73]/35 bg-[#1B1512] p-5 sm:p-7 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#E6BE73]/15 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium text-[#E6BE73] m-0">
                Mã đơn hàng · <span className="tabular-nums font-bold">{order.orderCode}</span>
              </p>
              {isApproved ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-[11px] font-semibold text-emerald-300">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Đã duyệt</span>
                </span>
              ) : isRejected ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/40 text-[11px] font-semibold text-rose-300">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Từ chối duyệt</span>
                </span>
              ) : markedPaid ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-[11px] font-semibold text-amber-300">
                  <Clock className="w-3 h-3 animate-spin" />
                  <span>Chờ duyệt</span>
                </span>
              ) : null}
            </div>
            <h3 className="text-xl font-bold text-[#F7F1E8] m-0">
              {isApproved
                ? 'Đã duyệt thanh toán · Nhận Link Web thiệp & Mã QR'
                : order.orderType === 'gift_set'
                  ? 'Thanh toán đơn Set quà VietQR'
                  : 'Thanh toán & Chờ Admin duyệt Web thiệp'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="min-h-[42px] min-w-[42px] rounded-xl bg-[#271F1A] hover:bg-[#332822] text-[#F7F1E8] flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CHỈ HIỂN THỊ LINK WEB THIỆP VÀ MÃ QR KHI ADMIN ĐÃ DUYỆT (isApproved === true) */}
        {cardCode && isApproved && (
          <div className="rounded-xl border border-emerald-500/40 bg-[#14100E] p-4 sm:p-5 space-y-4">
            <div className="rounded-lg bg-emerald-950/40 border border-emerald-500/30 px-3.5 py-2.5 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Admin đã duyệt thanh toán!</strong> Dưới đây là Link web thiệp riêng và Mã QR của bạn:
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {cardQrDataUrl && (
                <div className="w-28 h-28 rounded-xl bg-[#FFFBF3] p-1.5 shrink-0 mx-auto sm:mx-0">
                  <img
                    src={cardQrDataUrl}
                    alt={`Mã QR của thiệp ${cardCode}`}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              <div className="flex-1 min-w-0 space-y-2.5 text-center sm:text-left">
                <div className="text-xs text-[#B8ABA0]">
                  Link web thiệp riêng (chỉ hiển thị thiệp 3D, không hiện menu bán hàng · thêm{' '}
                  <code className="text-[#E6BE73]">?to=Tên</code> để đổi tên người nhận)
                </div>
                <div className="px-3 py-2 rounded-lg bg-[#1E1815] border border-[#E6BE73]/20 text-xs sm:text-sm text-[#E6BE73] font-mono break-all">
                  {shareUrl}
                </div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(shareUrl, 'link')}
                    className="min-h-[40px] px-3.5 rounded-lg bg-[#E6BE73] text-[#1A1208] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Đã sao chép' : 'Sao chép link'}</span>
                  </button>

                  {cardQrDataUrl && (
                    <button
                      type="button"
                      onClick={handleDownloadCardQr}
                      className="min-h-[40px] px-3.5 rounded-lg border border-[#F09D8B]/40 bg-[#2A181B] text-[#FDE2E4] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-[#F09D8B]" />
                      <span>Tải QR Trái Tim (.PNG)</span>
                    </button>
                  )}

                  {onOpenCardLink && (
                    <button
                      type="button"
                      onClick={() => onOpenCardLink(cardCode)}
                      className="min-h-[40px] px-3.5 rounded-lg border border-[#E6BE73]/30 bg-[#231B17] text-[#F7F1E8] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[#E6BE73]" />
                      <span>Xem link thiệp riêng</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quà tặng kèm Web thiệp 0đ khi đặt Set quà */}
        {order.orderType === 'gift_set' && onCreateFreeGiftCard && (
          <div className="rounded-xl border border-[#E6BE73]/45 bg-[#231A14] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E6BE73]">
                <Gift className="w-4 h-4" />
                <span>Ưu đãi đi kèm đơn Set quà</span>
              </div>
              <h4 className="text-base font-bold text-[#F7F1E8] m-0">
                Tặng kèm 01 Web thiệp 3D Gói Tùy Chỉnh (0đ)
              </h4>
              <p className="text-xs text-[#C8BDB2] m-0 leading-relaxed">
                Tạo ngay để có mã QR {order.wantPrintedQr ? 'in bỏ vào hộp quà' : 'gửi kèm người nhận'}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onCreateFreeGiftCard(order.orderCode)}
              className="min-h-[46px] px-5 py-2.5 rounded-xl bg-[#E6BE73] hover:bg-[#F0CC88] text-[#1A1208] text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Tạo web thiệp tặng kèm</span>
            </button>
          </div>
        )}

        {/* KHỐI THANH TOÁN VIETQR & GỬI LỆNH DUYỆT CHO ADMIN (Khi chưa được duyệt) */}
        {!isApproved && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center rounded-xl border border-[#E6BE73]/20 bg-[#14100E] p-4 sm:p-5">
            <div className="md:col-span-5 flex flex-col items-center justify-center gap-2">
              <div className="w-48 h-48 rounded-xl bg-[#FFFBF3] p-2 flex items-center justify-center overflow-hidden">
                {vietQrImgUrl && !vietQrFailed ? (
                  <img
                    src={vietQrImgUrl}
                    alt="Mã chuyển khoản VietQR"
                    onError={() => setVietQrFailed(true)}
                    className="w-full h-full object-contain"
                  />
                ) : fallbackTransferQrUrl ? (
                  <img
                    src={fallbackTransferQrUrl}
                    alt="QR thông tin chuyển khoản"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <QrCode className="w-16 h-16 text-[#1A1208]" />
                )}
              </div>
              <span className="text-[11px] text-[#A89B8E] text-center">
                {hasRealBank && !vietQrFailed
                  ? 'Quét bằng app Ngân hàng bất kỳ (VietQR)'
                  : 'Cập nhật STK trong CONFIG để bật ảnh VietQR tự động'}
              </span>
            </div>

            <div className="md:col-span-7 space-y-3">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-[#A89B8E]">Ngân hàng:</span>
                  <span className="font-medium text-right">{CONFIG.bank.bankName}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#A89B8E]">Số tài khoản:</span>
                  <span className="font-semibold tabular-nums text-right">
                    {CONFIG.bank.accountNumber}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#A89B8E]">Chủ tài khoản:</span>
                  <span className="font-medium text-right">{CONFIG.bank.accountHolder}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#A89B8E]">Số tiền:</span>
                  <span className="font-bold text-[#E6BE73] tabular-nums text-base">
                    {formatVnd(order.totalAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[#A89B8E]">Nội dung CK:</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(order.orderCode, 'code')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#251E1A] text-[#E6BE73] font-mono text-xs font-bold cursor-pointer"
                  >
                    <span>{order.orderCode}</span>
                    {copiedCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {isRejected ? (
                <div className="space-y-2.5 pt-1">
                  <div className="rounded-xl border border-rose-500/40 bg-rose-950/35 p-3 text-xs text-rose-200 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                    <div className="space-y-1">
                      <div className="font-bold text-rose-300">
                        Trạng thái: Admin đã từ chối duyệt thanh toán
                      </div>
                      <div>
                        Link web thiệp và mã QR chưa được cấp. Nếu bạn đã chuyển khoản đúng nội dung{' '}
                        <strong className="font-mono">{order.orderCode}</strong>, vui lòng ghi chú và bấm{' '}
                        <strong>Thanh toán</strong> để gửi lại lệnh duyệt cho Admin.
                      </div>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={transferNote}
                    onChange={(e) => setTransferNote(e.target.value)}
                    placeholder="Ghi chú (VD: Tên người chuyển / SĐT liên hệ)"
                    maxLength={120}
                    className="w-full min-h-[42px] px-3 rounded-xl border border-[#E6BE73]/25 bg-[#1B1512] text-xs sm:text-sm text-[#F7F1E8] placeholder:text-[#7E7266]"
                  />
                  {errorMsg && <p className="text-xs text-[#F09D8B] m-0">{errorMsg}</p>}
                  <button
                    type="button"
                    disabled={submittingPaid}
                    onClick={handleConfirmPayment}
                    className="w-full min-h-[46px] rounded-xl bg-[#E6BE73] hover:bg-[#F0CC88] disabled:opacity-60 text-[#1A1208] text-sm font-semibold cursor-pointer"
                  >
                    {submittingPaid ? 'Đang gửi lệnh duyệt...' : 'Thanh toán'}
                  </button>
                </div>
              ) : markedPaid ? (
                <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3.5 text-xs text-amber-100 flex items-start gap-2.5">
                  <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-400 animate-spin" />
                  <div className="space-y-1">
                    <div className="font-bold text-amber-300 text-sm">
                      Trạng thái: Chờ duyệt
                    </div>
                    <div className="leading-relaxed">
                      Đã gửi lệnh duyệt đơn <strong className="font-mono">{order.orderCode}</strong> cho Admin. Ngay khi Admin duyệt,{' '}
                      <strong>Link web thiệp và Mã QR của thiệp</strong> sẽ tự động hiển thị tại đây.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 pt-1">
                  <input
                    type="text"
                    value={transferNote}
                    onChange={(e) => setTransferNote(e.target.value)}
                    placeholder="Ghi chú (VD: Tên người chuyển / SĐT liên hệ)"
                    maxLength={120}
                    className="w-full min-h-[42px] px-3 rounded-xl border border-[#E6BE73]/25 bg-[#1B1512] text-xs sm:text-sm text-[#F7F1E8] placeholder:text-[#7E7266]"
                  />
                  {errorMsg && <p className="text-xs text-[#F09D8B] m-0">{errorMsg}</p>}
                  <button
                    type="button"
                    disabled={submittingPaid}
                    onClick={handleConfirmPayment}
                    className="w-full min-h-[46px] rounded-xl bg-[#E6BE73] hover:bg-[#F0CC88] disabled:opacity-60 text-[#1A1208] text-sm font-semibold cursor-pointer"
                  >
                    {submittingPaid ? 'Đang gửi lệnh duyệt...' : 'Thanh toán'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

