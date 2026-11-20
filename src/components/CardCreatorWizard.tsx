import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Crop,
  ImagePlus,
  Mic,
  Music2,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
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

export interface CropParams {
  zoom: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  fitMode: 'cover' | 'contain';
}

interface DraftPhotoItem {
  id: string;
  dataUrl: string;
  rawSrc: string;
  caption: string;
  crop: CropParams;
  sizeKb: number;
}

const DEFAULT_CROP: CropParams = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  fitMode: 'cover',
};

const OCCASION_HEADLINES: Record<OccasionId, [string, string]> = {
  noel: ['Chúc Mừng', 'Giáng Sinh'],
  'to-tinh': ['Làm Người Yêu', 'Của Anh Nhé'],
  valentine: ['Happy', 'Valentine'],
  tet: ['Chúc Mừng', 'Năm Mới'],
  'sinh-nhat': ['Happy', 'Birthday'],
};

const ACCENT_SWATCHES = [
  { hex: '#ffd98a', label: 'Vàng Ánh Nến (Noelnt)' },
  { hex: '#E26D7A', label: 'Hồng Ruby' },
  { hex: '#F09D8B', label: 'Đào Ấm' },
  { hex: '#E8B85B', label: 'Vàng Mai Tết' },
  { hex: '#9EC5AB', label: 'Xanh Thông Trầm' },
];

function readRawFileDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Không thể đọc file ảnh này.'));
    fr.onload = () => {
      const im = new Image();
      im.onerror = () => reject(new Error('Định dạng ảnh không hợp lệ.'));
      im.onload = () => {
        const maxDim = 1400;
        const longest = Math.max(im.width, im.height);
        if (longest <= maxDim) {
          resolve(fr.result as string);
          return;
        }
        const scale = maxDim / longest;
        const c = document.createElement('canvas');
        c.width = Math.round(im.width * scale);
        c.height = Math.round(im.height * scale);
        const ctx = c.getContext('2d');
        if (ctx) ctx.drawImage(im, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.9));
      };
      im.src = fr.result as string;
    };
    fr.readAsDataURL(file);
  });
}

function drawCroppedToCanvas(
  im: HTMLImageElement,
  crop: CropParams,
  canvas: HTMLCanvasElement,
  showGrid = false
) {
  const size = 720;
  if (canvas.width !== size) canvas.width = size;
  if (canvas.height !== size) canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, size, size);

  // Nền mờ dịu phía sau khi thu nhỏ hoặc chọn Vừa toàn bộ ảnh (contain)
  ctx.save();
  const bgScale = (size / Math.min(im.width, im.height)) * 1.15;
  ctx.filter = 'blur(20px) brightness(0.5)';
  ctx.drawImage(
    im,
    (size - im.width * bgScale) / 2,
    (size - im.height * bgScale) / 2,
    im.width * bgScale,
    im.height * bgScale
  );
  ctx.restore();

  // Ảnh chính đã canh chỉnh (pan, zoom, xoay)
  ctx.save();
  ctx.translate(size / 2 + crop.offsetX * (size / 2), size / 2 + crop.offsetY * (size / 2));
  ctx.rotate((crop.rotation * Math.PI) / 180);
  const baseScale =
    crop.fitMode === 'contain'
      ? size / Math.max(im.width, im.height)
      : size / Math.min(im.width, im.height);
  const totalScale = baseScale * crop.zoom;
  const drawW = im.width * totalScale;
  const drawH = im.height * totalScale;
  ctx.drawImage(im, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  // Lưới căn bố cục 3x3 khi đang chỉnh tay
  if (showGrid) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 247, 236, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(size / 3, 0);
    ctx.lineTo(size / 3, size);
    ctx.moveTo((size * 2) / 3, 0);
    ctx.lineTo((size * 2) / 3, size);
    ctx.moveTo(0, size / 3);
    ctx.lineTo(size, size / 3);
    ctx.moveTo(0, (size * 2) / 3);
    ctx.lineTo(size, (size * 2) / 3);
    ctx.stroke();
    ctx.restore();
  }
}

function estimateDataUrlKb(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] || '';
  return Math.max(1, Math.round((base64.length * 0.75) / 1024));
}

function renderCroppedDataUrl(rawSrc: string, crop: CropParams): Promise<string> {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas');
      drawCroppedToCanvas(im, crop, c, false);
      resolve(c.toDataURL('image/jpeg', 0.84));
    };
    im.onerror = () => resolve(rawSrc);
    im.src = rawSrc;
  });
}

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

  // Các trường chuẩn form Web Thiệp tin1511/noelnt
  const [headline1, setHeadline1] = useState<string>('Chúc Mừng');
  const [headline2, setHeadline2] = useState<string>('Giáng Sinh');
  const [recipientName, setRecipientName] = useState<string>('');
  const [senderName, setSenderName] = useState<string>(currentUser?.displayName || '');
  const [letter, setLetter] = useState<string>('');
  const [accentColor, setAccentColor] = useState<string>('#ffd98a');
  const [bgmId, setBgmId] = useState<string>('preset:we-wish-you');
  const [customSlug, setCustomSlug] = useState<string>('');
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'ok' | 'taken'>('idle');

  // Ảnh kỷ niệm + trình canh chỉnh Polaroid tương tác
  const [photos, setPhotos] = useState<DraftPhotoItem[]>([]);
  const [editingPhotoIdx, setEditingPhotoIdx] = useState<number | null>(null);
  const [showCropGrid, setShowCropGrid] = useState<boolean>(true);
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadedCropImgRef = useRef<HTMLImageElement | null>(null);
  const cropDragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    origOffsetX: number;
    origOffsetY: number;
  }>({ active: false, startX: 0, startY: 0, origOffsetX: 0, origOffsetY: 0 });

  // Ghi âm giọng nói (<= 1MB)
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [voiceDataUrl, setVoiceDataUrl] = useState<string>('');
  const [voiceName, setVoiceName] = useState<string>('');

  const [agreedPrivacy, setAgreedPrivacy] = useState<boolean>(false);
  const [previewBgmPlaying, setPreviewBgmPlaying] = useState<boolean>(false);
  const [processingMedia, setProcessingMedia] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Đồng bộ khi mở wizard với dịp / gói được chọn
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setOccasion(initialOccasion);
    setTier(freeGiftOrderId ? 'custom' : initialTier);
    const defaultPair = OCCASION_HEADLINES[initialOccasion] || ['Chúc Mừng', 'Giáng Sinh'];
    setHeadline1(defaultPair[0]);
    setHeadline2(defaultPair[1]);
    const occInfo = CONFIG.occasions.find((o) => o.id === initialOccasion);
    if (occInfo) {
      setAccentColor(initialOccasion === 'noel' ? '#ffd98a' : occInfo.accentHex);
      setBgmId(occInfo.defaultBgmId);
    }
    if (currentUser?.displayName && !senderName) {
      setSenderName(currentUser.displayName);
    }
    setEditingPhotoIdx(null);
    if (initialOccasion === 'sinh-nhat') {
      setPhotos((prev) => (prev.length > 1 ? prev.slice(0, 1) : prev));
    }
    setErrorMsg('');
  }, [isOpen, initialOccasion, initialTier, freeGiftOrderId]);

  // Kiểm tra tên đường dẫn riêng (Gói Cao Cấp)
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

  // Tải ảnh gốc vào Canvas canh chỉnh Polaroid mỗi khi đổi ảnh đang chọn
  const editingPhoto = editingPhotoIdx !== null ? photos[editingPhotoIdx] : undefined;
  const activeCrop: CropParams = editingPhoto?.crop || DEFAULT_CROP;
  const activeRawSrc = editingPhoto?.rawSrc || editingPhoto?.dataUrl || '';

  useEffect(() => {
    if (editingPhotoIdx === null || !activeRawSrc) {
      loadedCropImgRef.current = null;
      return;
    }
    let cancelled = false;
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => {
      if (cancelled) return;
      loadedCropImgRef.current = im;
      if (cropCanvasRef.current) {
        drawCroppedToCanvas(im, activeCrop, cropCanvasRef.current, showCropGrid);
      }
    };
    im.src = activeRawSrc;
    return () => {
      cancelled = true;
    };
  }, [editingPhotoIdx, activeRawSrc]);

  useEffect(() => {
    if (editingPhotoIdx !== null && loadedCropImgRef.current && cropCanvasRef.current) {
      drawCroppedToCanvas(
        loadedCropImgRef.current,
        activeCrop,
        cropCanvasRef.current,
        showCropGrid
      );
    }
  }, [editingPhotoIdx, activeCrop, showCropGrid]);

  const updateEditingCrop = useCallback(
    (updater: (prevCrop: CropParams) => CropParams) => {
      if (editingPhotoIdx === null) return;
      setPhotos((prev) => {
        const target = prev[editingPhotoIdx];
        if (!target) return prev;
        const nextCrop = updater(target.crop || DEFAULT_CROP);
        const nextList = [...prev];
        let nextDataUrl = target.dataUrl;
        if (loadedCropImgRef.current) {
          const tempCanvas = document.createElement('canvas');
          drawCroppedToCanvas(loadedCropImgRef.current, nextCrop, tempCanvas, false);
          nextDataUrl = tempCanvas.toDataURL('image/jpeg', 0.84);
        }
        nextList[editingPhotoIdx] = {
          ...target,
          crop: nextCrop,
          dataUrl: nextDataUrl,
          sizeKb: estimateDataUrlKb(nextDataUrl),
        };
        return nextList;
      });
    },
    [editingPhotoIdx]
  );

  const handleCropPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    cropDragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origOffsetX: activeCrop.offsetX,
      origOffsetY: activeCrop.offsetY,
    };
  };

  const handleCropPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!cropDragRef.current.active) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const boxSize = Math.max(1, rect.width);
    const dx = (e.clientX - cropDragRef.current.startX) / (boxSize / 2);
    const dy = (e.clientY - cropDragRef.current.startY) / (boxSize / 2);
    const clampedX = Math.max(-1.5, Math.min(1.5, cropDragRef.current.origOffsetX + dx));
    const clampedY = Math.max(-1.5, Math.min(1.5, cropDragRef.current.origOffsetY + dy));
    updateEditingCrop((prev) => ({
      ...prev,
      offsetX: clampedX,
      offsetY: clampedY,
    }));
  };

  const handleCropPointerUp = () => {
    cropDragRef.current.active = false;
  };

  const handleCropWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    updateEditingCrop((prev) => ({
      ...prev,
      zoom: Math.max(0.5, Math.min(3, +(prev.zoom + delta).toFixed(2))),
    }));
  };

  const selectedTierObj = useMemo(
    () => pricingTiers.find((t) => t.id === tier) || pricingTiers[1] || CONFIG.pricing[1],
    [pricingTiers, tier]
  );

  const effectivePrice = freeGiftOrderId ? 0 : selectedTierObj.price;
  const allowMediaUpload = tier !== 'basic';
  const maxPhotos = occasion === 'sinh-nhat' ? 1 : 6;

  const handleSelectOccasion = (id: OccasionId) => {
    setOccasion(id);
    if (id === 'sinh-nhat') {
      setPhotos((prev) => (prev.length > 1 ? prev.slice(0, 1) : prev));
      setEditingPhotoIdx((prev) => (prev !== null && prev >= 1 ? null : prev));
    }
    const pair = OCCASION_HEADLINES[id] || ['Chúc Mừng', 'Giáng Sinh'];
    setHeadline1(pair[0]);
    setHeadline2(pair[1]);
    const info = CONFIG.occasions.find((o) => o.id === id);
    if (info) {
      setAccentColor(id === 'noel' ? '#ffd98a' : info.accentHex);
      setBgmId(info.defaultBgmId);
    }
  };

  const handlePickPhotos = async (
    filesList: FileList | null,
    replaceIndex: number | null = null
  ) => {
    const files = Array.from(filesList || []);
    if (files.length === 0) return;
    setErrorMsg('');
    setProcessingMedia(true);

    try {
      if (replaceIndex !== null) {
        const file = files[0];
        const rawUrl = await readRawFileDataUrl(file);
        const initialCrop: CropParams = { ...DEFAULT_CROP };
        const croppedUrl = await renderCroppedDataUrl(rawUrl, initialCrop);
        setPhotos((prev) =>
          prev.map((item, idx) =>
            idx === replaceIndex
              ? {
                  ...item,
                  dataUrl: croppedUrl,
                  rawSrc: rawUrl,
                  crop: initialCrop,
                  sizeKb: estimateDataUrlKb(croppedUrl),
                }
              : item
          )
        );
        setEditingPhotoIdx(replaceIndex);
      } else {
        const remainingSlots = Math.max(0, maxPhotos - photos.length);
        const selected = files.slice(0, remainingSlots);
        const newItems: DraftPhotoItem[] = [];
        for (let i = 0; i < selected.length; i++) {
          const rawUrl = await readRawFileDataUrl(selected[i]);
          const initialCrop: CropParams = { ...DEFAULT_CROP };
          const croppedUrl = await renderCroppedDataUrl(rawUrl, initialCrop);
          newItems.push({
            id: `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
            dataUrl: croppedUrl,
            rawSrc: rawUrl,
            caption: `Kỷ niệm ${photos.length + i + 1}`,
            crop: initialCrop,
            sizeKb: estimateDataUrlKb(croppedUrl),
          });
        }
        const firstNewIdx = photos.length;
        setPhotos((prev) => [...prev, ...newItems].slice(0, maxPhotos));
        if (newItems.length > 0 && firstNewIdx < maxPhotos) {
          setEditingPhotoIdx(firstNewIdx);
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể xử lý ảnh tải lên.');
    } finally {
      setProcessingMedia(false);
    }
  };

  const handleUploadBgmFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMsg('');
    if (file.size > 420 * 1024) {
      setErrorMsg(
        'File nhạc nền tải trực tiếp cần nhỏ hơn 420KB (hoặc bạn có thể dán đường link MP3 trực tuyến bất kỳ).'
      );
      return;
    }
    const fr = new FileReader();
    fr.onload = () => {
      const dataUrl = String(fr.result || '');
      setBgmId(dataUrl);
      bgmPlayer.setMuted(false);
      bgmPlayer.setTrack(dataUrl);
      bgmPlayer.start();
      setPreviewBgmPlaying(true);
    };
    fr.readAsDataURL(file);
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

  const combinedGreeting = useMemo(() => {
    const l1 = headline1.normalize('NFC').trim() || 'Chúc Mừng';
    const l2 = headline2.normalize('NFC').trim() || 'Giáng Sinh';
    return `${l1}\n${l2}`.slice(0, 160);
  }, [headline1, headline2]);

  const previewCard: WebCardRecord = useMemo(
    () => ({
      code: customSlug ? slugifyCardCode(customSlug) || 'xem-truoc' : 'xem-truoc',
      userId: currentUser?.uid || 'guest',
      occasion,
      tier,
      price: effectivePrice,
      recipientName: recipientName.trim() || 'Người thương',
      senderName: senderName.trim() || 'Từ mình',
      greeting: combinedGreeting,
      letter:
        letter.trim() ||
        'Cảm ơn bạn đã luôn đồng hành cùng mình trong chặng đường vừa qua.\n\nMong rằng mỗi ngày sắp tới của bạn đều thật rực rỡ và bình an.',
      accentColor,
      bgmId,
      photos: allowMediaUpload
        ? photos.slice(0, maxPhotos).map((p) => ({ url: p.dataUrl, caption: p.caption }))
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
      combinedGreeting,
      letter,
      accentColor,
      bgmId,
      allowMediaUpload,
      maxPhotos,
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
      setErrorMsg('Vui lòng nhập Lời ký tên / Người gửi.');
      return;
    }
    if (!letter.trim()) {
      setErrorMsg('Vui lòng viết nội dung lá thư gửi tặng.');
      return;
    }
    if (tier === 'premium' && customSlug.trim()) {
      const slug = slugifyCardCode(customSlug);
      if (slug.length < 2) {
        setErrorMsg('Tên link riêng cần ít nhất 2 ký tự (chữ không dấu, số hoặc gạch ngang).');
        return;
      }
      if (slugStatus === 'taken') {
        setErrorMsg('Tên link riêng này đã được dùng, vui lòng chọn tên khác.');
        return;
      }
    }
    bgmPlayer.stop();
    setPreviewBgmPlaying(false);
    setEditingPhotoIdx(null);
    setStep(3);
  };

  const handleSubmitCard = async () => {
    setErrorMsg('');
    if (!agreedPrivacy) {
      setErrorMsg('Vui lòng tick đồng ý Điều khoản sử dụng & Quyền riêng tư trước khi tạo thiệp.');
      return;
    }

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
        greeting: combinedGreeting,
        letter: letter.normalize('NFC'),
        accentColor,
        bgmId,
        photos: allowMediaUpload
          ? photos.slice(0, maxPhotos).map((p) => ({ dataUrl: p.dataUrl, caption: p.caption }))
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

  const isPresetBgm = BGM_PRESETS.some((p) => p.id === bgmId);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 overflow-y-auto p-2 sm:p-4 flex justify-center">
      <div className="my-auto w-full max-w-4xl rounded-2xl border border-[#E6BE73]/30 bg-[#181310] text-[#F7F1E8] overflow-hidden">
        {/* Header của Trình tạo Web Thiệp */}
        <div className="border-b border-[#E6BE73]/15 bg-[#1D1612] px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-xs text-[#E6BE73] font-medium m-0">
              Bước {step}/3 ·{' '}
              {step === 1
                ? 'Chọn mẫu 3D & gói thiệp'
                : step === 2
                  ? 'Thiết kế nội dung, nhạc & ảnh Polaroid'
                  : 'Xem trước 3D & nhận mã QR Trái Tim'}
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

        {/* Tiến trình 3 bước */}
        <div className="grid grid-cols-3 border-b border-[#E6BE73]/12 bg-[#14100E] text-xs font-medium">
          {[
            { num: 1, label: '1. Dịp & Gói' },
            { num: 2, label: '2. Form Thiệp & Ảnh' },
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
          {!currentUser && (
            <div className="rounded-xl border border-[#E6BE73]/25 bg-[#1F1814] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs text-[#D7CCC0]">
                <UserCheck className="w-4 h-4 text-[#E6BE73] shrink-0 mt-0.5" />
                <span>
                  Bạn có thể tạo thiệp ngay không cần tài khoản, hoặc <strong>đăng nhập</strong> để lưu lại danh sách link &amp; QR Trái Tim trong tài khoản cá nhân.
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
              Ưu đãi đơn Set quà <strong className="font-mono">{freeGiftOrderId}</strong>: Tặng kèm miễn phí <strong>0đ Gói Tùy Chỉnh</strong> ({occasion === 'sinh-nhat' ? '1 ảnh kỷ niệm trong bức thư' : 'tối đa 6 ảnh Polaroid'} + nhạc + ghi âm giọng nói).
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

          {/* ==================== BƯỚC 2: FORM WEB THIỆP CHUẨN TIN1511/NOELNT ==================== */}
          {step === 2 && (
            <div className="space-y-5">
              {/* 2 dòng chữ chúc 3D tụ hạt */}
              <div className="rounded-xl border border-[#E6BE73]/20 bg-[#14100E] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#E6BE73]">
                    Chữ chúc ánh sáng tụ thành hạt 3D (2 dòng)
                  </span>
                  <span className="text-[11px] text-[#A89B8E]">Hiển thị đầu tiên khi mở thiệp</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block space-y-1">
                    <span className="text-xs text-[#D7CCC0]">Dòng chữ chúc thứ nhất</span>
                    <input
                      type="text"
                      value={headline1}
                      onChange={(e) => setHeadline1(e.target.value)}
                      placeholder="VD: Chúc Mừng"
                      maxLength={70}
                      className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#E6BE73]/25 bg-[#1D1612] text-sm text-[#F7F1E8]"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-[#D7CCC0]">Dòng chữ chúc thứ hai</span>
                    <input
                      type="text"
                      value={headline2}
                      onChange={(e) => setHeadline2(e.target.value)}
                      placeholder="VD: Giáng Sinh"
                      maxLength={70}
                      className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#E6BE73]/25 bg-[#1D1612] text-sm text-[#F7F1E8]"
                    />
                  </label>
                </div>
              </div>

              {/* Người nhận, Lời ký tên & Màu hạt */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[#D7CCC0]">
                    Tên người nhận <span className="text-[#F09D8B]">*</span>
                  </span>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="VD: Minh Anh / Công chúa nhỏ"
                    maxLength={120}
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm text-[#F7F1E8]"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[#D7CCC0]">
                    Lời ký tên / Người gửi <span className="text-[#F09D8B]">*</span>
                  </span>
                  <input
                    type="text"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="VD: Đức Thịnh / Ông già Noel của em"
                    maxLength={120}
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm text-[#F7F1E8]"
                  />
                </label>
              </div>

              <div className="space-y-1.5">
                <span className="block text-xs font-medium text-[#D7CCC0]">Màu ánh sáng chủ đạo</span>
                <div className="flex flex-wrap items-center gap-2.5">
                  {ACCENT_SWATCHES.map((sw) => (
                    <button
                      key={sw.hex}
                      type="button"
                      onClick={() => setAccentColor(sw.hex)}
                      title={sw.label}
                      className={`w-9 h-9 rounded-lg border-2 cursor-pointer transition-transform ${
                        accentColor === sw.hex ? 'border-white scale-110' : 'border-transparent opacity-80'
                      }`}
                      style={{ backgroundColor: sw.hex }}
                    />
                  ))}
                </div>
              </div>

              {/* Đường dẫn riêng cho Gói Cao Cấp */}
              {tier === 'premium' && (
                <div className="rounded-xl border border-[#E6BE73]/30 bg-[#14100E] p-4 space-y-2">
                  <span className="text-xs font-semibold text-[#E6BE73]">
                    Đường dẫn tùy chọn riêng (Dành riêng cho Gói Cao Cấp · lưu vĩnh viễn)
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm text-[#A89B8E] font-mono">/c/</span>
                    <input
                      type="text"
                      value={customSlug}
                      onChange={(e) => setCustomSlug(e.target.value)}
                      placeholder="vd: em, linh, gui-nguoi-thuong..."
                      maxLength={48}
                      className="flex-1 min-h-[42px] px-3 rounded-lg border border-[#E6BE73]/25 bg-[#1D1612] text-sm text-[#F7F1E8]"
                    />
                  </div>
                  {customSlug.trim() && (
                    <p className="text-xs m-0">
                      {slugStatus === 'checking' && (
                        <span className="text-[#B8ABA0]">Đang kiểm tra đường dẫn...</span>
                      )}
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

              {/* Nội dung thư (cách đoạn bằng một dòng trống) */}
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[#D7CCC0]">
                  Nội dung thư (cách đoạn bằng một dòng trống) <span className="text-[#F09D8B]">*</span>
                </span>
                <textarea
                  rows={5}
                  value={letter}
                  onChange={(e) => setLetter(e.target.value)}
                  placeholder="Viết những dòng tâm tình bạn muốn gửi gắm khi người nhận mở lá thư..."
                  maxLength={10000}
                  className="w-full p-3.5 rounded-xl border border-[#E6BE73]/25 bg-[#14100E] text-sm text-[#F7F1E8] leading-relaxed"
                />
              </label>

              {/* Nhạc nền (có sẵn hoặc link MP3 / tải file nhạc) */}
              <div className="rounded-xl border border-[#E6BE73]/20 bg-[#14100E] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#D7CCC0] inline-flex items-center gap-1.5">
                    <Music2 className="w-4 h-4 text-[#E6BE73]" />
                    <span>Nhạc nền (chọn giai điệu có sẵn hoặc dùng nhạc riêng)</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleTogglePreviewMusic}
                    className="min-h-[34px] px-3 rounded-lg bg-[#251D19] text-xs font-medium text-[#E6BE73] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>{previewBgmPlaying ? 'Dừng nghe' : 'Nghe thử'}</span>
                  </button>
                </div>

                <select
                  value={isPresetBgm ? bgmId : 'custom'}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'custom') {
                      setBgmId('https://');
                    } else {
                      setBgmId(val);
                      if (previewBgmPlaying) {
                        bgmPlayer.setTrack(val);
                        bgmPlayer.start();
                      }
                    }
                  }}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-[#E6BE73]/25 bg-[#1D1612] text-sm text-[#F7F1E8]"
                >
                  {BGM_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                  <option value="custom">Nhạc tự chọn (Dán link MP3 hoặc tải file nhạc)</option>
                </select>

                {!isPresetBgm && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={bgmId.startsWith('data:audio/') ? '(Đã chọn file nhạc từ thiết bị)' : bgmId}
                      readOnly={bgmId.startsWith('data:audio/')}
                      onChange={(e) => setBgmId(e.target.value)}
                      placeholder="Dán đường link file nhạc .mp3 (https://...)"
                      className="flex-1 min-w-[180px] min-h-[40px] px-3 rounded-lg border border-[#E6BE73]/25 bg-[#1D1612] text-xs text-[#F7F1E8]"
                    />
                    <label className="min-h-[40px] px-3 rounded-lg border border-[#E6BE73]/30 bg-[#251D19] text-xs font-medium text-[#E6BE73] inline-flex items-center gap-1.5 cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Tải file nhạc (≤ 420KB)</span>
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleUploadBgmFile}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Ảnh Polaroid treo cây / mô hình 3D + Trình Canh chỉnh ảnh (noelnt Crop Studio) & Giọng nói */}
              {allowMediaUpload ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-[#E6BE73]/25 bg-[#14100E] p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-semibold text-[#E6BE73] block">
                          {occasion === 'sinh-nhat'
                            ? `Ảnh kỷ niệm trong bức thư (${photos.length}/1 ảnh)`
                            : `Ảnh Polaroid kỷ niệm treo trên mô hình 3D (${photos.length}/6 ảnh)`}
                        </span>
                        <span className="text-[11px] text-[#A89B8E]">
                          {occasion === 'sinh-nhat'
                            ? 'Thiệp sinh nhật không đặt ảnh trong bánh kem — chỉ hiển thị 1 ảnh duy nhất bên trong bức thư (bấm để canh chỉnh 1:1)'
                            : 'Bấm vào ảnh hoặc nút Canh chỉnh để kéo vị trí, phóng to & xoay ảnh vuông 1:1'}
                        </span>
                      </div>

                      {photos.length < maxPhotos && (
                        <label className="min-h-[38px] px-3.5 rounded-lg bg-[#E6BE73] text-[#1A1208] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer">
                          <ImagePlus className="w-4 h-4" />
                          <span>{processingMedia ? 'Đang xử lý...' : 'Thêm ảnh'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple={maxPhotos > 1}
                            disabled={processingMedia}
                            onChange={(e) => {
                              handlePickPhotos(e.target.files, null);
                              e.target.value = '';
                            }}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>

                    {/* Interactive Polaroid Crop Studio từ tin1511/noelnt */}
                    {editingPhotoIdx !== null && editingPhoto && (
                      <div className="rounded-xl border border-[#E6BE73]/40 bg-[#1B1512] p-4 space-y-4">
                        <div className="flex items-center justify-between gap-2 border-b border-[#E6BE73]/15 pb-3">
                          <span className="text-xs sm:text-sm font-semibold text-[#E6BE73] inline-flex items-center gap-1.5">
                            <SlidersHorizontal className="w-4 h-4" />
                            <span>
                              Canh chỉnh Ảnh {editingPhotoIdx + 1}{' '}
                              {editingPhoto.caption ? `— ${editingPhoto.caption}` : ''}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditingPhotoIdx(null)}
                            className="min-h-[34px] px-3.5 rounded-lg bg-[#E6BE73] text-[#1A1208] text-xs font-semibold cursor-pointer"
                          >
                            Xong canh chỉnh
                          </button>
                        </div>

                        <div className="flex flex-col md:flex-row items-center gap-5">
                          {/* Khung Polaroid kéo thả trực tiếp */}
                          <div className="flex flex-col items-center gap-2 shrink-0">
                            <div className="bg-[#fff7ec] p-2.5 pb-7 rounded shadow-xl border border-[#e6d5c3]">
                              <canvas
                                ref={cropCanvasRef}
                                onPointerDown={handleCropPointerDown}
                                onPointerMove={handleCropPointerMove}
                                onPointerUp={handleCropPointerUp}
                                onPointerCancel={handleCropPointerUp}
                                onWheel={handleCropWheel}
                                className="w-[220px] h-[220px] sm:w-[250px] sm:h-[250px] block touch-none cursor-grab active:cursor-grabbing rounded-sm bg-[#14100E]"
                              />
                            </div>
                            <span className="text-[11px] text-[#A89B8E] text-center max-w-[260px]">
                              Kéo trên ảnh để dời vị trí · Lăn chuột để thu phóng
                            </span>
                          </div>

                          {/* Thanh trượt Zoom / Pan X / Pan Y / Rotate & Quick Actions */}
                          <div className="flex-1 w-full space-y-3">
                            <div className="space-y-2 text-xs">
                              <div className="flex items-center gap-3">
                                <span className="w-20 text-[#C8BDB2]">Thu phóng</span>
                                <input
                                  type="range"
                                  min="0.5"
                                  max="3"
                                  step="0.02"
                                  value={activeCrop.zoom}
                                  onChange={(e) => {
                                    const v = parseFloat(e.target.value);
                                    updateEditingCrop((prev) => ({ ...prev, zoom: v }));
                                  }}
                                  className="flex-1 accent-[#E6BE73]"
                                />
                                <span className="w-11 text-right text-[#E6BE73] tabular-nums">
                                  {Math.round(activeCrop.zoom * 100)}%
                                </span>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="w-20 text-[#C8BDB2]">Ngang (X)</span>
                                <input
                                  type="range"
                                  min="-1"
                                  max="1"
                                  step="0.01"
                                  value={activeCrop.offsetX}
                                  onChange={(e) => {
                                    const v = parseFloat(e.target.value);
                                    updateEditingCrop((prev) => ({ ...prev, offsetX: v }));
                                  }}
                                  className="flex-1 accent-[#E6BE73]"
                                />
                                <span className="w-11 text-right text-[#E6BE73] tabular-nums">
                                  {Math.round(activeCrop.offsetX * 100)}%
                                </span>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="w-20 text-[#C8BDB2]">Dọc (Y)</span>
                                <input
                                  type="range"
                                  min="-1"
                                  max="1"
                                  step="0.01"
                                  value={activeCrop.offsetY}
                                  onChange={(e) => {
                                    const v = parseFloat(e.target.value);
                                    updateEditingCrop((prev) => ({ ...prev, offsetY: v }));
                                  }}
                                  className="flex-1 accent-[#E6BE73]"
                                />
                                <span className="w-11 text-right text-[#E6BE73] tabular-nums">
                                  {Math.round(activeCrop.offsetY * 100)}%
                                </span>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="w-20 text-[#C8BDB2]">Góc xoay</span>
                                <input
                                  type="range"
                                  min="-180"
                                  max="180"
                                  step="1"
                                  value={activeCrop.rotation}
                                  onChange={(e) => {
                                    const v = parseInt(e.target.value, 10);
                                    updateEditingCrop((prev) => ({ ...prev, rotation: v }));
                                  }}
                                  className="flex-1 accent-[#E6BE73]"
                                />
                                <span className="w-11 text-right text-[#E6BE73] tabular-nums">
                                  {activeCrop.rotation}°
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={() =>
                                  updateEditingCrop((prev) => ({
                                    ...prev,
                                    fitMode: 'cover',
                                    zoom: 1,
                                    offsetX: 0,
                                    offsetY: 0,
                                  }))
                                }
                                className={`min-h-[34px] px-2.5 rounded-lg border text-[11px] font-medium cursor-pointer ${
                                  activeCrop.fitMode === 'cover'
                                    ? 'bg-[#E6BE73] text-[#1A1208] border-[#E6BE73]'
                                    : 'bg-[#14100E] text-[#D7CCC0] border-[#E6BE73]/25'
                                }`}
                              >
                                Lấp đầy khung (1:1)
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  updateEditingCrop((prev) => ({
                                    ...prev,
                                    fitMode: 'contain',
                                    zoom: 1,
                                    offsetX: 0,
                                    offsetY: 0,
                                  }))
                                }
                                className={`min-h-[34px] px-2.5 rounded-lg border text-[11px] font-medium cursor-pointer ${
                                  activeCrop.fitMode === 'contain'
                                    ? 'bg-[#E6BE73] text-[#1A1208] border-[#E6BE73]'
                                    : 'bg-[#14100E] text-[#D7CCC0] border-[#E6BE73]/25'
                                }`}
                              >
                                Vừa toàn bộ ảnh
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  updateEditingCrop((prev) => ({
                                    ...prev,
                                    rotation: ((prev.rotation - 90 + 540) % 360) - 180,
                                  }))
                                }
                                className="min-h-[34px] px-2.5 rounded-lg border border-[#E6BE73]/25 bg-[#14100E] text-[11px] text-[#D7CCC0] inline-flex items-center gap-1 cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>-90°</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  updateEditingCrop((prev) => ({
                                    ...prev,
                                    rotation: ((prev.rotation + 90 + 540) % 360) - 180,
                                  }))
                                }
                                className="min-h-[34px] px-2.5 rounded-lg border border-[#E6BE73]/25 bg-[#14100E] text-[11px] text-[#D7CCC0] inline-flex items-center gap-1 cursor-pointer"
                              >
                                <RotateCw className="w-3 h-3" />
                                <span>+90°</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowCropGrid((g) => !g)}
                                className="min-h-[34px] px-2.5 rounded-lg border border-[#E6BE73]/25 bg-[#14100E] text-[11px] text-[#D7CCC0] cursor-pointer"
                              >
                                {showCropGrid ? 'Ẩn lưới' : 'Hiện lưới'}
                              </button>
                              <button
                                type="button"
                                onClick={() => updateEditingCrop(() => ({ ...DEFAULT_CROP }))}
                                className="min-h-[34px] px-2.5 rounded-lg border border-[#E6BE73]/25 bg-[#14100E] text-[11px] text-[#F09D8B] cursor-pointer"
                              >
                                Đặt lại
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Danh sách ảnh đã chọn */}
                    {photos.length === 0 ? (
                      <p className="text-xs text-[#8F8378] m-0">
                        {occasion === 'sinh-nhat' ? (
                          <>
                            Chưa có ảnh nào. Hãy bấm <strong>Thêm ảnh</strong> (chỉ 1 ảnh duy nhất đặt trong bức thư), bạn có thể kéo/xoay/thu phóng khung ảnh ngay bên trong trình tạo.
                          </>
                        ) : (
                          <>
                            Chưa có ảnh nào. Hãy bấm <strong>Thêm ảnh</strong> (tối đa 6 ảnh), bạn có thể kéo/xoay/thu phóng từng khung Polaroid ngay bên trong trình tạo.
                          </>
                        )}
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {photos.map((p, idx) => (
                          <div
                            key={p.id}
                            className={`flex items-center gap-2.5 rounded-xl border p-2 transition-colors ${
                              editingPhotoIdx === idx
                                ? 'border-[#E6BE73] bg-[#241B16]'
                                : 'border-[#E6BE73]/15 bg-[#1B1512]'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setEditingPhotoIdx(editingPhotoIdx === idx ? null : idx)
                              }
                              title="Bấm để canh chỉnh ảnh này"
                              className="w-12 h-12 rounded-lg overflow-hidden border border-[#E6BE73]/30 shrink-0 p-0 cursor-pointer bg-black"
                            >
                              <img
                                src={p.dataUrl}
                                alt={p.caption || `Ảnh ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </button>

                            <input
                              type="text"
                              value={p.caption}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPhotos((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, caption: val } : item))
                                );
                              }}
                              placeholder={`Chú thích ${idx + 1}`}
                              maxLength={80}
                              className="flex-1 min-w-0 min-h-[36px] px-2.5 rounded-lg bg-[#14100E] border border-[#E6BE73]/15 text-xs text-[#F7F1E8]"
                            />

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingPhotoIdx(editingPhotoIdx === idx ? null : idx)
                                }
                                title="Canh chỉnh khung ảnh"
                                className={`min-h-[34px] px-2.5 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer ${
                                  editingPhotoIdx === idx
                                    ? 'bg-[#E6BE73] text-[#1A1208] font-semibold'
                                    : 'bg-[#261E19] text-[#E6BE73]'
                                }`}
                              >
                                <Crop className="w-3 h-3" />
                                <span className="hidden sm:inline">Canh</span>
                              </button>

                              <label
                                title="Đổi ảnh khác"
                                className="min-h-[34px] px-2 rounded-lg bg-[#261E19] text-[#D7CCC0] text-[11px] inline-flex items-center cursor-pointer"
                              >
                                <span>Đổi</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    handlePickPhotos(e.target.files, idx);
                                    e.target.value = '';
                                  }}
                                  className="hidden"
                                />
                              </label>

                              <button
                                type="button"
                                onClick={() => {
                                  if (editingPhotoIdx === idx) setEditingPhotoIdx(null);
                                  else if (editingPhotoIdx !== null && editingPhotoIdx > idx)
                                    setEditingPhotoIdx(editingPhotoIdx - 1);
                                  setPhotos((prev) => prev.filter((_, i) => i !== idx));
                                }}
                                aria-label="Xóa ảnh"
                                className="min-h-[34px] min-w-[34px] rounded-lg bg-[#2A1D1B] text-[#F09D8B] flex items-center justify-center cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* File ghi âm giọng nói (<= 1MB) */}
                  <div className="rounded-xl border border-[#E6BE73]/20 bg-[#14100E] p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-medium text-[#D7CCC0]">
                        File ghi âm giọng nói kèm lá thư (tùy chọn · ≤ 1MB)
                      </span>
                      <label className="min-h-[36px] px-3 rounded-lg border border-[#E6BE73]/35 bg-[#231B17] text-xs font-medium text-[#E6BE73] inline-flex items-center gap-1.5 cursor-pointer">
                        <Mic className="w-3.5 h-3.5" />
                        <span>Chọn file ghi âm</span>
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
                        Hỗ trợ MP3, M4A, WAV (≤ 1MB). Khi người nhận mở lá thư sẽ có nút phát giọng nói thật của bạn.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-[#E6BE73]/20 bg-[#14100E] p-3.5 text-xs text-[#B8ABA0] flex items-center justify-between gap-3">
                  <span>
                    <strong>Gói Cơ Bản (19.000đ)</strong> gồm hiệu ứng 3D, chữ chúc 3D, thư &amp; nhạc nền. Để tải ảnh Polaroid treo &amp; giọng nói, chuyển sang Gói Tùy Chỉnh.
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
                        ? 'Xác nhận & Nhận QR Trái Tim (0đ)'
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
