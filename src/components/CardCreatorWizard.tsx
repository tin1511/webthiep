import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImagePlus,
  Mic,
  Music2,
  Sparkles,
  Trash2,
  UserCheck,
  Volume2,
  X,
} from 'lucide-react';
import {
  CONFIG,
  OccasionId,
  PricingTier,
  PricingTierId,
  formatVnd,
} from '../config';
import {
  ShopOrderRecord,
  WebCardRecord,
  compressImageUnder300KB,
  createWebCardAndOrder,
  isCardCodeAvailable,
  readVoiceFileUnder1MB,
  slugifyCardCode,
} from '../firebase';
import { BGM_PRESETS, bgmPlayer } from '../bgmPlayer';
import { CardExperience3D } from './CardExperience3D';

interface CardCreatorWizardProps {
  isOpen: boolean;
  initialOccasion?: OccasionId;
  initialTier?: PricingTierId;
  freeGiftOrderId?: string | null;
  pricingTiers: PricingTier[];
  currentUser: User | null;
  onClose: () => void;
  onOpenAuth: () => void;
  onSuccessCreated: (card: WebCardRecord, order: ShopOrderRecord) => void;
}

interface DraftPhotoItem {
  id: string;
  file?: File;
  dataUrl: string;
  caption: string;
  sizeKb: number;
}

const ACCENT_SWATCHES = [
  { hex: '#E6BE73', label: 'Vàng Champagne' },
  { hex: '#E26D7A', label: 'Hồng Ruby' },
  { hex: '#F09D8B', label: 'Đào Ấm' },
  { hex: '#E8B85B', label: 'Vàng Mai Tết' },
  { hex: '#9EC5AB', label: 'Xanh Thông Trầm' },
];

export const CardCreatorWizard: React.FC<CardCreatorWizardProps> = ({
  isOpen,
  initialOccasion = 'noel',
  initialTier = 'custom',
  freeGiftOrderId = null,
  pricingTiers,
  currentUser,
  onClose,
  onOpenAuth,
  onSuccessCreated,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [occasion, setOccasion] = useState<OccasionId>(initialOccasion);
  const [tier, setTier] = useState<PricingTierId>(freeGiftOrderId ? 'custom' : initialTier);
  const [recipientName, setRecipientName] = useState<string>('');
  const [senderName, setSenderName] = useState<string>(currentUser?.displayName || '');
  const [greeting, setGreeting] = useState<string>('Giáng Sinh An Lành');
  const [letter, setLetter] = useState<string>('');
  const [accentColor, setAccentColor] = useState<string>('#E6BE73');
  const [bgmId, setBgmId] = useState<string>('preset:we-wish-you');
  const [customSlug, setCustomSlug] = useState<string>('');
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'ok' | 'taken'>('idle');
  const [photos, setPhotos] = useState<DraftPhotoItem[]>([]);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [voiceDataUrl, setVoiceDataUrl] = useState<string>('');
  const [voiceName, setVoiceName] = useState<string>('');
  const [agreedPrivacy, setAgreedPrivacy] = useState<boolean>(false);
  const [previewBgmPlaying, setPreviewBgmPlaying] = useState<boolean>(false);
  const [processingMedia, setProcessingMedia] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Đồng bộ lựa chọn khi mở wizard với dịp / gói mới
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setOccasion(initialOccasion);
    setTier(freeGiftOrderId ? 'custom' : initialTier);
    const occInfo = CONFIG.occasions.find((o) => o.id === initialOccasion);
    if (occInfo) {
      setGreeting(occInfo.sampleGreeting);
      setAccentColor(occInfo.accentHex);
      setBgmId(occInfo.defaultBgmId);
    }
    if (currentUser?.displayName && !senderName) {
      setSenderName(currentUser.displayName);
    }
    setErrorMsg('');
  }, [isOpen, initialOccasion, initialTier, freeGiftOrderId]);

  // Kiểm tra tên đường link riêng (gói Cao cấp)
  useEffect(() => {
    if (tier !== 'premium' || !customSlug.trim()) {
      setSlugStatus('idle');
      return;
    }
    const slug = slugifyCardCode(customSlug);
    if (slug.length < 2) {
      setSlugStatus('idle');
      return;
    }
    setSlugStatus('checking');
    const timer = setTimeout(() => {
      isCardCodeAvailable(slug).then((ok) => setSlugStatus(ok ? 'ok' : 'taken'));
    }, 350);
    return () => clearTimeout(timer);
  }, [customSlug, tier]);

  useEffect(() => {
    return () => {
      bgmPlayer.stop();
    };
  }, []);

  const selectedTierObj = useMemo(
    () => pricingTiers.find((t) => t.id === tier) || pricingTiers[1] || CONFIG.pricing[1],
    [pricingTiers, tier]
  );

  const effectivePrice = freeGiftOrderId ? 0 : selectedTierObj.price;
  const allowMediaUpload = tier !== 'basic';

  const handleSelectOccasion = (id: OccasionId) => {
    setOccasion(id);
    const info = CONFIG.occasions.find((o) => o.id === id);
    if (info) {
      setGreeting(info.sampleGreeting);
      setAccentColor(info.accentHex);
      setBgmId(info.defaultBgmId);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    setErrorMsg('');
    setProcessingMedia(true);

    try {
      const remainingSlots = Math.max(0, 6 - photos.length);
      const selected = files.slice(0, remainingSlots);
      const added: DraftPhotoItem[] = [];
      for (let i = 0; i < selected.length; i++) {
        const file = selected[i];
        const compressed = await compressImageUnder300KB(file);
        added.push({
          id: `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          file,
          dataUrl: compressed.dataUrl,
          caption: `Kỷ niệm ${photos.length + added.length + 1}`,
          sizeKb: Math.round(compressed.sizeBytes / 1024),
        });
      }
      setPhotos((prev) => [...prev, ...added].slice(0, 6));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể xử lý ảnh tải lên.');
    } finally {
      setProcessingMedia(false);
    }
  };

  const handleVoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMsg('');
    try {
      const res = await readVoiceFileUnder1MB(file);
      setVoiceFile(file);
      setVoiceDataUrl(res.dataUrl);
      setVoiceName(`${res.name} (${Math.round(res.sizeBytes / 1024)}KB)`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'File ghi âm không hợp lệ.');
    }
  };

  const handleTogglePreviewMusic = () => {
    if (previewBgmPlaying) {
      bgmPlayer.stop();
      setPreviewBgmPlaying(false);
    } else {
      bgmPlayer.setMuted(false);
      bgmPlayer.setTrack(bgmId);
      bgmPlayer.start();
      setPreviewBgmPlaying(true);
    }
  };

  const previewCard: WebCardRecord = useMemo(
    () => ({
      code: customSlug ? slugifyCardCode(customSlug) || 'xem-truoc' : 'xem-truoc',
      userId: currentUser?.uid || 'guest',
      occasion,
      tier,
      price: effectivePrice,
      recipientName: recipientName.trim() || 'Người thương',
      senderName: senderName.trim() || 'Từ mình',
      greeting: greeting.trim() || 'Chúc mừng',
      letter:
        letter.trim() ||
        'Cảm ơn bạn đã luôn đồng hành cùng mình trong chặng đường vừa qua. Mong rằng mỗi ngày sắp tới của bạn đều thật rực rỡ và bình an.',
      accentColor,
      bgmId,
      photos: allowMediaUpload
        ? photos.map((p) => ({ url: p.dataUrl, caption: p.caption }))
        : [],
      voiceAudioUrl: allowMediaUpload && voiceDataUrl ? voiceDataUrl : undefined,
      status: 'active',
      locked: false,
      orderCode: 'PREVIEW',
      expiresAtMs: null,
      createdAtMs: Date.now(),
    }),
    [
      customSlug,
      currentUser,
      occasion,
      tier,
      effectivePrice,
      recipientName,
      senderName,
      greeting,
      letter,
      accentColor,
      bgmId,
      allowMediaUpload,
      photos,
      voiceDataUrl,
    ]
  );

  const handleGoStep3 = () => {
    setErrorMsg('');
    if (!recipientName.trim()) {
      setErrorMsg('Vui lòng nhập Tên người nhận.');
      return;
    }
    if (!senderName.trim()) {
      setErrorMsg('Vui lòng nhập Tên người gửi.');
      return;
    }
    if (!letter.trim()) {
      setErrorMsg('Vui lòng viết nội dung bức thư gửi tặng.');
      return;
    }
    if (tier === 'premium' && customSlug.trim()) {
      const slug = slugifyCardCode(customSlug);
      if (slug.length < 2) {
        setErrorMsg('Tên link riêng cần ít nhất 2 ký tự (chữ không dấu, số hoặc dấu gạch ngang).');
        return;
      }
      if (slugStatus === 'taken') {
        setErrorMsg('Tên link riêng này đã được dùng, vui lòng chọn tên khác.');
        return;
      }
    }
    bgmPlayer.stop();
    setPreviewBgmPlaying(false);
    setStep(3);
  };

  const handleSubmitCard = async () => {
    setErrorMsg('');
    if (!agreedPrivacy) {
      setErrorMsg('Vui lòng tick đồng ý Điều khoản sử dụng & Quyền riêng tư trước khi tạo thiệp.');
      return;
    }

    // Chống bấm tạo liên tiếp (rate-limit phía giao diện)
    try {
      const lastSubmit = Number(localStorage.getItem('last_card_submit_ms') || '0');
      const elapsed = Date.now() - lastSubmit;
      if (lastSubmit > 0 && elapsed < CONFIG.antiSpamCooldownMs) {
        const waitSec = Math.ceil((CONFIG.antiSpamCooldownMs - elapsed) / 1000);
        setErrorMsg(`Để chống spam, vui lòng chờ thêm ${waitSec} giây trước khi tạo thiệp mới.`);
        return;
      }
    } catch {
      // ignore storage error
    }

    setSubmitting(true);
    try {
      const { card, order } = await createWebCardAndOrder({
        occasion,
        tier,
        price: effectivePrice,
        customSlug: tier === 'premium' ? customSlug : undefined,
        recipientName,
        senderName,
        greeting,
        letter,
        accentColor,
        bgmId,
        photos: allowMediaUpload
          ? photos.map((p) => ({ file: p.file, dataUrl: p.dataUrl, caption: p.caption }))
          : [],
        voiceFile: allowMediaUpload ? voiceFile : null,
        voiceDataUrl: allowMediaUpload ? voiceDataUrl : undefined,
        giftOrderId: freeGiftOrderId || undefined,
      });
      try {
        localStorage.setItem('last_card_submit_ms', String(Date.now()));
      } catch {
        // ignore
      }
      bgmPlayer.stop();
      onSuccessCreated(card, order);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể tạo web thiệp lúc này.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 overflow-y-auto p-2 sm:p-4 flex justify-center">
      <div className="my-auto w-full max-w-4xl rounded-2xl border border-[#E6BE73]/30 bg-[#181310] text-[#F7F1E8] overflow-hidden">
        {/* Header của Wizard 3 bước */}
        <div className="border-b border-[#E6BE73]/15 bg-[#1D1612] px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-xs text-[#E6BE73] font-medium m-0">
              Bước {step}/3 ·{' '}
              {step === 1
                ? 'Chọn dịp & gói thiệp'
                : step === 2
                  ? 'Nội dung, ảnh kỷ niệm & âm thanh'
                  : 'Xem trước 3D & xác nhận'}
            </p>
            <h2 className="text-lg sm:text-xl font-bold m-0">
              {freeGiftOrderId ? 'Tạo Web Thiệp Tặng Kèm (0đ)' : 'Tạo Web Thiệp 3D Theo Yêu Cầu'}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => {
              bgmPlayer.stop();
              onClose();
            }}
            aria-label="Đóng trình tạo thiệp"
            className="min-h-[42px] min-w-[42px] rounded-xl bg-[#271F1A] hover:bg-[#332922] text-[#F7F1E8] flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tiến trình 3 bước trực quan */}
        <div className="grid grid-cols-3 border-b border-[#E6BE73]/12 bg-[#14100E] text-xs font-medium">
          {[
            { num: 1, label: '1. Dịp & Gói' },
            { num: 2, label: '2. Lời chúc & Ảnh' },
            { num: 3, label: '3. Xem trước 3D' },
          ].map((item) => (
            <div
              key={item.num}
              className={`py-2.5 text-center border-b-2 transition-colors ${
                step === item.num
                  ? 'border-[#E6BE73] text-[#E6BE73] font-semibold'
                  : step > item.num
                    ? 'border-emerald-500/60 text-emerald-300'
                    : 'border-transparent text-[#8F8378]'
              }`}
            >
              {item.label}
            </div>
          ))}
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {/* Nhắc nhẹ đăng nhập nếu đang dùng chế độ khách */}
          {!currentUser && (
            <div className="rounded-xl border border-[#E6BE73]/25 bg-[#1F1814] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs text-[#D7CCC0]">
                <UserCheck className="w-4 h-4 text-[#E6BE73] shrink-0 mt-0.5" />
                <span>
                  Bạn vẫn có thể tạo thiệp không cần tài khoản, nhưng <strong>đăng nhập</strong> sẽ giúp lưu lại danh sách link &amp; mã QR để quản lý bất kỳ lúc nào.
                </span>
              </div>
              <button
                type="button"
                onClick={onOpenAuth}
                className="min-h-[38px] px-3.5 rounded-lg border border-[#E6BE73]/40 bg-[#2A201B] text-xs font-semibold text-[#E6BE73] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Đăng nhập / Đăng ký
              </button>
            </div>
          )}

          {freeGiftOrderId && (
            <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/30 p-3.5 text-xs sm:text-sm text-emerald-200">
              Ưu đãi đơn Set quà <strong className="font-mono">{freeGiftOrderId}</strong>: Tặng kèm miễn phí <strong>0đ Gói Tùy Chỉnh</strong> (hỗ trợ tối đa 6 ảnh kỷ niệm + ghi âm giọng nói).
            </div>
          )}

          {/* ==================== BƯỚC 1: CHỌN MẪU & GÓI ==================== */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[#E6BE73] m-0">
                  A. Chọn mẫu hiệu ứng hạt 3D theo dịp
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {CONFIG.occasions.map((occ) => {
                    const active = occasion === occ.id;
                    return (
                      <button
                        key={occ.id}
                        type="button"
                        onClick={() => handleSelectOccasion(occ.id)}
                        className={`text-left rounded-xl border p-4 space-y-1.5 transition-colors cursor-pointer ${
                          active
                            ? 'border-[#E6BE73] bg-[#251D18]'
                            : 'border-[#E6BE73]/15 bg-[#14100E] hover:border-[#E6BE73]/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm text-[#F7F1E8]">{occ.title}</span>
                          {active && <Check className="w-4 h-4 text-[#E6BE73] shrink-0" />}
                        </div>
                        <p className="text-xs text-[#E6BE73] m-0">{occ.particleShapeLabel}</p>
                        <p className="text-xs text-[#A89B8E] m-0 leading-relaxed">{occ.subtitle}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {!freeGiftOrderId && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-[#E6BE73] m-0">
                    B. Chọn gói dịch vụ &amp; thời hạn lưu giữ link
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {pricingTiers.map((t) => {
                      const active = tier === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTier(t.id)}
                          className={`text-left rounded-xl border p-4 flex flex-col justify-between gap-3 transition-colors cursor-pointer ${
                            active
                              ? 'border-[#E6BE73] bg-[#251D18]'
                              : 'border-[#E6BE73]/15 bg-[#14100E] hover:border-[#E6BE73]/40'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-[#F7F1E8]">{t.name}</span>
                              <span className="text-base font-bold text-[#E6BE73] tabular-nums">
                                {formatVnd(t.price)}
                              </span>
                            </div>
                            <p className="text-xs text-[#A89B8E] m-0">{t.durationText}</p>
                            <p className="text-xs text-[#C8BDB2] m-0 pt-1">{t.summary}</p>
                          </div>
                          <div className="text-[11px] text-[#E6BE73] font-medium">
                            {active ? 'Đang chọn gói này' : 'Nhấn để chọn'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="min-h-[46px] px-6 py-2.5 rounded-xl bg-[#E6BE73] hover:bg-[#F0CC88] text-[#1A1208] text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
                >
                  <span>Tiếp tục điền nội dung</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ==================== BƯỚC 2: ĐIỀN THÔNG TIN, ẢNH, NHẠC & GIỌNG NÓI ==================== */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[#D7CCC0]">
                    Tên người nhận <span className="text-[#F09D8B]">*</span>
                  </span>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="VD: Minh Anh / Bố Mẹ yêu"
                    maxLength={120}
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm text-[#F7F1E8]"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[#D7CCC0]">
                    Tên người gửi <span className="text-[#F09D8B]">*</span>
                  </span>
                  <input
                    type="text"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="VD: Đức Thịnh / Người thương của em"
                    maxLength={120}
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm text-[#F7F1E8]"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[#D7CCC0]">Lời chào nổi bật trên hiệu ứng hạt</span>
                  <input
                    type="text"
                    value={greeting}
                    onChange={(e) => setGreeting(e.target.value)}
                    placeholder="VD: Giáng Sinh An Lành / Làm Người Yêu Nhé"
                    maxLength={160}
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm text-[#F7F1E8]"
                  />
                </label>

                <div className="space-y-1.5">
                  <span className="block text-xs font-medium text-[#D7CCC0]">Màu hạt ánh sáng chủ đạo</span>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {ACCENT_SWATCHES.map((sw) => (
                      <button
                        key={sw.hex}
                        type="button"
                        onClick={() => setAccentColor(sw.hex)}
                        title={sw.label}
                        className={`w-9 h-9 rounded-lg border-2 cursor-pointer transition-transform ${
                          accentColor === sw.hex
                            ? 'border-white scale-110'
                            : 'border-transparent opacity-80'
                        }`}
                        style={{ backgroundColor: sw.hex }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Tên đường link riêng cho gói Cao cấp */}
              {tier === 'premium' && (
                <div className="rounded-xl border border-[#E6BE73]/30 bg-[#14100E] p-4 space-y-2">
                  <span className="text-xs font-semibold text-[#E6BE73]">
                    Đường dẫn tùy chọn riêng (Dành riêng cho Gói Cao Cấp)
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm text-[#A89B8E] font-mono">/c/</span>
                    <input
                      type="text"
                      value={customSlug}
                      onChange={(e) => setCustomSlug(e.target.value)}
                      placeholder="gui-em-an (để trống nếu muốn sinh mã ngẫu nhiên)"
                      maxLength={48}
                      className="flex-1 min-h-[42px] px-3 rounded-lg border border-[#E6BE73]/25 bg-[#1D1612] text-sm text-[#F7F1E8]"
                    />
                  </div>
                  {customSlug.trim() && (
                    <p className="text-xs m-0">
                      {slugStatus === 'checking' && <span className="text-[#B8ABA0]">Đang kiểm tra tên đường link...</span>}
                      {slugStatus === 'ok' && (
                        <span className="text-emerald-400">
                          Có thể sử dụng: /c/{slugifyCardCode(customSlug)}
                        </span>
                      )}
                      {slugStatus === 'taken' && (
                        <span className="text-[#F09D8B]">
                          Tên link /c/{slugifyCardCode(customSlug)} đã có người dùng. Vui lòng chọn tên khác.
                        </span>
                      )}
                    </p>
                  )}
                </div>
              )}

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[#D7CCC0]">
                  Nội dung bức thư <span className="text-[#F09D8B]">*</span>
                </span>
                <textarea
                  rows={4}
                  value={letter}
                  onChange={(e) => setLetter(e.target.value)}
                  placeholder="Viết những dòng tâm tình bạn muốn gửi gắm..."
                  maxLength={10000}
                  className="w-full p-3.5 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm text-[#F7F1E8] leading-relaxed"
                />
              </label>

              {/* Chọn nhạc nền có sẵn không bản quyền */}
              <div className="rounded-xl border border-[#E6BE73]/20 bg-[#14100E] p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[#D7CCC0] inline-flex items-center gap-1.5">
                    <Music2 className="w-4 h-4 text-[#E6BE73]" />
                    <span>Nhạc nền hộp nhạc (không bản quyền)</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleTogglePreviewMusic}
                    className="min-h-[34px] px-3 rounded-lg bg-[#251D19] text-xs font-medium text-[#E6BE73] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>{previewBgmPlaying ? 'Dừng nghe thử' : 'Nghe thử'}</span>
                  </button>
                </div>
                <select
                  value={bgmId}
                  onChange={(e) => {
                    setBgmId(e.target.value);
                    if (previewBgmPlaying) bgmPlayer.setTrack(e.target.value);
                  }}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-[#E6BE73]/25 bg-[#1D1612] text-sm text-[#F7F1E8]"
                >
                  {BGM_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tải ảnh kỷ niệm (tối đa 6 ảnh, nén <= 300KB/ảnh) & File ghi âm (<= 1MB) */}
              {allowMediaUpload ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-[#E6BE73]/20 bg-[#14100E] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-[#D7CCC0]">
                        Ảnh kỷ niệm ({photos.length}/6 ảnh · tự nén ≤ 300KB)
                      </span>
                      {photos.length < 6 && (
                        <label className="min-h-[36px] px-3 rounded-lg bg-[#E6BE73] text-[#1A1208] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer">
                          <ImagePlus className="w-3.5 h-3.5" />
                          <span>{processingMedia ? 'Đang nén...' : 'Thêm ảnh'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            disabled={processingMedia}
                            onChange={handlePhotoUpload}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>

                    {photos.length === 0 ? (
                      <p className="text-xs text-[#8F8378] m-0">
                        Chưa có ảnh nào. Có thể chọn tối đa 6 ảnh, hệ thống tự nén gọn để tải nhanh trên 4G.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {photos.map((p, idx) => (
                          <div
                            key={p.id}
                            className="flex items-center gap-2.5 rounded-lg border border-[#E6BE73]/15 bg-[#1B1512] p-2"
                          >
                            <img
                              src={p.dataUrl}
                              alt=""
                              className="w-12 h-12 rounded-md object-cover shrink-0"
                            />
                            <div className="flex-1 min-w-0 space-y-1">
                              <input
                                type="text"
                                value={p.caption}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPhotos((prev) =>
                                    prev.map((item) =>
                                      item.id === p.id ? { ...item, caption: val } : item
                                    )
                                  );
                                }}
                                placeholder={`Chú thích ảnh ${idx + 1}`}
                                maxLength={80}
                                className="w-full px-2 py-1 rounded bg-[#14100E] border border-[#E6BE73]/15 text-xs text-[#F7F1E8]"
                              />
                              <div className="text-[10px] text-[#A89B8E] tabular-nums">
                                Đã nén gọn: {p.sizeKb}KB
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setPhotos((prev) => prev.filter((item) => item.id !== p.id))
                              }
                              aria-label="Xóa ảnh"
                              className="min-h-[34px] min-w-[34px] rounded-lg bg-[#2A1D1B] text-[#F09D8B] flex items-center justify-center cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-[#E6BE73]/20 bg-[#14100E] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-[#D7CCC0]">
                        File ghi âm giọng nói (tùy chọn · ≤ 1MB)
                      </span>
                      <label className="min-h-[36px] px-3 rounded-lg border border-[#E6BE73]/35 bg-[#231B17] text-xs font-medium text-[#E6BE73] inline-flex items-center gap-1.5 cursor-pointer">
                        <Mic className="w-3.5 h-3.5" />
                        <span>Chọn file âm thanh</span>
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={handleVoiceUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                    {voiceDataUrl ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 text-xs text-emerald-300">
                          <span className="truncate">{voiceName}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setVoiceFile(null);
                              setVoiceDataUrl('');
                              setVoiceName('');
                            }}
                            className="text-[#F09D8B] underline bg-transparent border-0 cursor-pointer text-xs"
                          >
                            Gỡ bỏ
                          </button>
                        </div>
                        <audio controls src={voiceDataUrl} className="w-full h-9" />
                      </div>
                    ) : (
                      <p className="text-xs text-[#8F8378] m-0 leading-relaxed">
                        Hỗ trợ MP3, M4A, WAV hoặc file thu âm trực tiếp trên điện thoại (dung lượng tối đa 1MB). Người nhận mở phong thư sẽ thấy nút nghe giọng nói của bạn.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-[#E6BE73]/20 bg-[#14100E] p-3.5 text-xs text-[#B8ABA0] flex items-center justify-between gap-3">
                  <span>
                    <strong>Gói Cơ Bản (19.000đ)</strong> gồm hiệu ứng 3D, thư &amp; nhạc nền. Để tải lên ảnh kỷ niệm &amp; ghi âm giọng nói, bạn có thể chuyển sang Gói Tùy Chỉnh.
                  </span>
                  <button
                    type="button"
                    onClick={() => setTier('custom')}
                    className="px-3 py-1.5 rounded-lg bg-[#E6BE73] text-[#1A1208] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Nâng lên Tùy chỉnh
                  </button>
                </div>
              )}

              {errorMsg && <p className="text-xs text-[#F09D8B] m-0">{errorMsg}</p>}

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="min-h-[44px] px-4 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm font-medium text-[#F7F1E8] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Quay lại</span>
                </button>
                <button
                  type="button"
                  onClick={handleGoStep3}
                  className="min-h-[46px] px-6 rounded-xl bg-[#E6BE73] hover:bg-[#F0CC88] text-[#1A1208] text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
                >
                  <span>Xem trước trực tiếp 3D</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ==================== BƯỚC 3: XEM TRƯỚC TRỰC TIẾP & XÁC NHẬN TẠO ==================== */}
          {step === 3 && (
            <div className="space-y-5">
              <CardExperience3D card={previewCard} isPreview />

              <div className="rounded-xl border border-[#E6BE73]/25 bg-[#14100E] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-[#C8BDB2]">
                    Gói đã chọn: <strong className="text-[#F7F1E8]">{selectedTierObj.name}</strong> ·{' '}
                    {selectedTierObj.durationText}
                  </span>
                  <span className="text-lg font-bold text-[#E6BE73] tabular-nums">
                    {formatVnd(effectivePrice)}
                  </span>
                </div>

                <label className="flex items-start gap-2.5 text-xs text-[#D7CCC0] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedPrivacy}
                    onChange={(e) => setAgreedPrivacy(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#E6BE73]"
                  />
                  <span>
                    Tôi đồng ý với <strong>Điều khoản sử dụng &amp; Quyền riêng tư</strong>: nội dung ảnh, thư và âm thanh tuân thủ pháp luật và chỉ dùng cho thiệp này.
                  </span>
                </label>

                {errorMsg && <p className="text-xs text-[#F09D8B] m-0">{errorMsg}</p>}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="min-h-[46px] px-5 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm font-medium text-[#F7F1E8] inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Chỉnh sửa lại</span>
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmitCard}
                  className="min-h-[48px] px-7 rounded-xl bg-[#E6BE73] hover:bg-[#F0CC88] disabled:opacity-60 text-[#1A1208] text-sm sm:text-base font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {submitting
                      ? 'Đang lưu lên hệ thống...'
                      : effectivePrice === 0
                        ? 'Xác nhận & Nhận link 0đ ngay'
                        : `Xác nhận tạo & Thanh toán ${formatVnd(effectivePrice)}`}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
