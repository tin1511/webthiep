/**
 * ============================================================================
 * CẤU HÌNH TRUNG TÂM WEBSITE BÁN HÀNG (CONFIG)
 * Mọi thông số chung: Tên shop, Zalo, Facebook, Tài khoản ngân hàng, Bảng giá,
 * Thời hạn link, Email Admin, Set quà mẫu & Câu hỏi thường gặp đều nằm tại đây.
 * ============================================================================
 */
import giftSetWomenImg from './assets/images/gift_set_women_candle_1794884852967.jpg';
import giftSetMenImg from './assets/images/gift_set_men_leather_1794884852868.jpg';
import giftSetValentineImg from './assets/images/gift_set_valentine_rose_1794884853393.jpg';
import giftSetBirthdayImg from './assets/images/gift_set_birthday_warm_1794884854172.jpg';

export type OccasionId = 'noel' | 'to-tinh' | 'valentine' | 'tet' | 'sinh-nhat';
export type PricingTierId = 'basic' | 'custom' | 'premium';
export type GiftAudience = 'nu' | 'nam' | 'unisex';

export interface PricingTier {
  id: PricingTierId;
  name: string;
  price: number;
  priceText: string;
  durationText: string;
  durationDays: number | null; // null = giữ vĩnh viễn
  highlighted?: boolean;
  summary: string;
  features: string[];
  ctaLabel: string;
}

export interface OccasionInfo {
  id: OccasionId;
  title: string;
  subtitle: string;
  description: string;
  particleShapeLabel: string;
  accentHex: string;
  secondaryHex: string;
  sampleGreeting: string;
  sampleRecipient: string;
  defaultBgmId: string;
}

export interface GiftSetProduct {
  id: string;
  title: string;
  audience: GiftAudience;
  occasionTag: OccasionId | 'all';
  price: number;
  imageUrl: string;
  description: string;
  items: string[];
  inStock: boolean;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const CONFIG = {
  // 1. THÔNG TIN CỬA HÀNG (Thay placeholder [...] bằng thông tin thật của bạn)
  shopName: '[DTD]',
  shopTagline: 'Quà tặng cảm xúc & Web thiệp 3D theo yêu cầu',
  shopStory:
    'Mỗi hộp quà trao tay đi kèm một trang web thiệp 3D riêng tư — nơi lưu giữ ảnh kỷ niệm, giọng nói và bức thư bạn tự tay viết.',

  // 2. CẤU HÌNH QUẢN TRỊ VIÊN (/admin) - KHÔNG BAO GIỜ LƯU MẬT KHẨU TRONG CODE
  // Thay '[EMAIL_ADMIN_CUA_BAN]' bằng email bạn tạo cho tài khoản "admin" trong Firebase Console -> Authentication
  adminEmail: 'lettersdtd@gmail.com',
  // Danh sách email Google được phép vào /admin (bên cạnh tài khoản có document trong Firestore collection "admins/<UID>")
  adminAllowedEmails: ['lettersdtd@gmail.com'],
  adminMaxFailedAttempts: 5,
  adminLockoutMs: 5 * 60 * 1000, // Khóa 5 phút sau 5 lần đăng nhập sai liên tiếp

  // 3. LIÊN HỆ ZALO / FACEBOOK (Điền sau)
  contact: {
    zaloPhone: '[0788205852]',
    zaloUrl: 'https://zalo.me/0788205852',
    facebookName: '[DTDLetters]',
    facebookUrl: 'https://www.facebook.com/profile.php?id=61596760138650',
    email: '[lettersdtd@gmail.com]',
    workingHours: '08:30 – 22:00 hàng ngày (kể cả Cuối tuần & Lễ)',
  },

  // 4. THÔNG TIN NGÂN HÀNG & VIETQR
  // Để mã VietQR tự sinh ảnh chuẩn ngân hàng, điền mã ngân hàng theo chuẩn VietQR (VD: MB, VCB, TCB, ACB, BIDV, VPB, TPB)
  bank: {
    bankId: 'MB',
    bankName: '[TÊN NGÂN HÀNG — VD: MB Bank]',
    accountNumber: '[SO_TAI_KHOAN]',
    accountHolder: '[TEN_CHU_TAI_KHOAN]',
    transferPrefix: 'THIEP',
  },

  // 5. THỜI HẠN LINK THEO GÓI & CHỐNG SPAM TẠO THIỆP
  linkDays: {
    basic: 30,
    custom: 90,
    premium: null as number | null, // Vĩnh viễn
  },
  antiSpamCooldownMs: 15000, // Chống bấm tạo liên tiếp trong 15 giây

  // 6. BẢNG GIÁ WEB THIỆP (Mặc định — Admin có thể chỉnh sửa trực tiếp trong Firestore settings/pricing)
  pricing: [
    {
      id: 'basic',
      name: 'Gói Cơ Bản',
      price: 19000,
      priceText: '19.000đ',
      durationText: 'Lưu giữ link 30 ngày',
      durationDays: 30,
      highlighted: false,
      summary: 'Nhanh gọn, đủ cảm xúc cho lời chúc bất ngờ.',
      features: [
        'Chọn 1 mẫu hiệu ứng hạt 3D theo dịp',
        'Tùy chỉnh tên người nhận, lời chào & bức thư',
        'Nhạc nền không bản quyền theo chủ đề dịp lễ',
        'Kèm link /c/<mã> & mã QR để in hoặc gửi',
      ],
      ctaLabel: 'Chọn gói Cơ Bản',
    },
    {
      id: 'custom',
      name: 'Gói Tùy Chỉnh',
      price: 59000,
      priceText: '59.000đ',
      durationText: 'Lưu giữ link 90 ngày · Tặng 0đ khi mua Set quà',
      durationDays: 90,
      highlighted: true,
      summary: 'Đầy đủ ảnh kỷ niệm và giọng nói thật của riêng bạn.',
      features: [
        'Toàn bộ tính năng của Gói Cơ Bản',
        'Tải lên tối đa 6 ảnh kỷ niệm (tự nén <= 300KB/ảnh)',
        'Đính kèm 1 đoạn ghi âm giọng nói riêng (<= 1MB)',
        'Miễn phí 0đ khi đặt kèm bất kỳ Set quà nào của shop',
      ],
      ctaLabel: 'Chọn gói Tùy Chỉnh',
    },
    {
      id: 'premium',
      name: 'Gói Cao Cấp',
      price: 129000,
      priceText: '129.000đ',
      durationText: 'Lưu giữ vĩnh viễn',
      durationDays: null,
      highlighted: false,
      summary: 'Đường link mang tên riêng làm kỷ niệm lâu dài.',
      features: [
        'Toàn bộ tính năng của Gói Tùy Chỉnh',
        'Tự chọn tên đường link riêng (VD: /c/gui-em-an)',
        'Lưu giữ vĩnh viễn không lo hết hạn đường link',
        'Ưu tiên hỗ trợ căn chỉnh & xuất mã QR in chất lượng cao',
      ],
      ctaLabel: 'Chọn gói Cao Cấp',
    },
  ] as PricingTier[],

  // 7. CÁC DỊP THIẾT KẾ WEB THIỆP
  occasions: [
    {
      id: 'noel',
      title: 'Giáng Sinh (Noel)',
      subtitle: 'Cây thông ánh sáng & phong thư lau sương',
      description:
        'Hàng ngàn hạt vàng tụ thành chữ chúc, lời chào, phong thư lau sương ấm và cây thông treo ảnh kỷ niệm xoay chậm.',
      particleShapeLabel: 'Cây thông Noel 3D',
      accentHex: '#E6BE73',
      secondaryHex: '#B83B4A',
      sampleGreeting: 'Giáng Sinh An Lành',
      sampleRecipient: 'Gửi người thương',
      defaultBgmId: 'preset:we-wish-you',
    },
    {
      id: 'to-tinh',
      title: 'Tỏ Tình',
      subtitle: 'Hiệu ứng hạt câu hỏi & nút "Suy nghĩ lại" tự né',
      description:
        'Những hạt sao ấm kết thành lời ngỏ ý, kèm khoảnh khắc hồi hộp với hai lựa chọn Đồng ý và Suy nghĩ lại đầy dí dỏm.',
      particleShapeLabel: 'Vòm sao lời ngỏ',
      accentHex: '#F09D8B',
      secondaryHex: '#C94A5A',
      sampleGreeting: 'Làm Người Yêu Nhé',
      sampleRecipient: 'Có điều muốn nói với cậu',
      defaultBgmId: 'preset:first-blush',
    },
    {
      id: 'valentine',
      title: 'Valentine 14/2',
      subtitle: 'Trái tim hạt 3D đập theo nhịp cảm xúc',
      description:
        'Hạt ánh sáng kết thành trái tim 3D đập dịu dàng giữa không gian tối ấm, mở ra album kỷ niệm hai người.',
      particleShapeLabel: 'Trái tim 3D nhịp đập',
      accentHex: '#E26D7A',
      secondaryHex: '#F2C185',
      sampleGreeting: 'Happy Valentine',
      sampleRecipient: 'Mãi bên nhau nhé',
      defaultBgmId: 'preset:love-serenade',
    },
    {
      id: 'tet',
      title: 'Tết Sum Vầy',
      subtitle: 'Sắc hoa mai đào & lời chúc đầu xuân',
      description:
        'Cánh hoa vàng đỏ bay nhẹ trong không gian 3D, mang theo phong bao lời chúc an khang dành cho gia đình và người thân.',
      particleShapeLabel: 'Đèn lồng & hoa xuân',
      accentHex: '#E8B85B',
      secondaryHex: '#C63D3D',
      sampleGreeting: 'Chúc Mừng Năm Mới',
      sampleRecipient: 'Gia đình bình an',
      defaultBgmId: 'preset:spring-blossom',
    },
    {
      id: 'sinh-nhat',
      title: 'Sinh Nhật',
      subtitle: 'Ánh nến & pháo sáng tuổi mới',
      description:
        'Ánh sáng tụ thành ngọn nến lung linh và vòng xoáy chúc mừng tuổi mới, lưu lại lời chúc từ bạn bè và người yêu.',
      particleShapeLabel: 'Bánh nến tuổi mới',
      accentHex: '#E9C57E',
      secondaryHex: '#D97B66',
      sampleGreeting: 'Happy Birthday',
      sampleRecipient: 'Tuổi mới thật rực rỡ',
      defaultBgmId: 'preset:happy-birthday',
    },
  ] as OccasionInfo[],

  // 8. DANH MỤC TỔNG QUAN & SET QUÀ MẪU (Ảnh sản phẩm tạo sẵn tại src/assets/images, Admin có thể nạp/sửa trong Firestore)
  giftCategories: [
    {
      id: 'nu',
      title: 'Set quà cho Nữ',
      summary: 'Nến thơm thủ công, khăn lụa, trà hoa ấm và thiệp QR 3D tặng kèm 0đ.',
      priceFrom: 'Từ 249.000đ',
    },
    {
      id: 'nam',
      title: 'Set quà cho Nam',
      summary: 'Ví da tối giản, nước hoa tông gỗ ấm, cà phê rang mộc kèm web thiệp riêng.',
      priceFrom: 'Từ 289.000đ',
    },
    {
      id: 'dip',
      title: 'Set quà Theo Dịp',
      summary: 'Noel, Valentine, Sinh nhật, Kỷ niệm yêu — đóng hộp ruy băng sẵn sàng trao.',
      priceFrom: 'Từ 269.000đ',
    },
    {
      id: 'ngan-sach',
      title: 'Chọn Theo Ngân Sách',
      summary: 'Tùy chọn linh hoạt dưới 300k, 300k–500k hoặc hộp quà cao cấp trên 500k.',
      priceFrom: 'Từ 199.000đ',
    },
  ],

  defaultGiftSets: [
    {
      id: 'set-nu-nen-lua',
      title: 'Hộp Quà Nàng Thơ · Nến Thơm & Khăn Lụa',
      audience: 'nu',
      occasionTag: 'noel',
      price: 349000,
      imageUrl: giftSetWomenImg,
      description:
        'Thiết kế tinh tế tông vàng kem ấm áp cho bạn gái, vợ hoặc mẹ. Kèm 01 Web thiệp 3D Gói Tùy Chỉnh (0đ) và thiệp giấy in mã QR đặt gọn trong hộp.',
      items: [
        '01 Hũ nến thơm sáp đậu nành hương vani gỗ tuyết tùng (180g)',
        '01 Khăn lụa satin hoa nhí màu champagne',
        '01 Lọ trà hoa cúc mật ong sấy lạnh',
        '01 Hộp quà cứng nắp nam châm + ruy băng & thiệp QR 3D tặng kèm',
      ],
      inStock: true,
    },
    {
      id: 'set-nam-lich-lam',
      title: 'Hộp Quà Quý Ông · Ví Da & Nước Hoa Gỗ',
      audience: 'nam',
      occasionTag: 'sinh-nhat',
      price: 469000,
      imageUrl: giftSetMenImg,
      description:
        'Tông nâu espresso nam tính, tối giản và hữu dụng mỗi ngày cho bạn trai, chồng hoặc đồng nghiệp. Tặng kèm Web thiệp 3D cá nhân hóa 0đ.',
      items: [
        '01 Ví da bò tối giản khâu thủ công (màu nâu trầm)',
        '01 Nước hoa mini tông gỗ tuyết tùng & hổ phách (15ml)',
        '01 Túi cà phê phin giấy đặc sản rang mộc',
        '01 Hộp đen nhám thắt nơ + thiệp QR 3D tặng kèm 0đ',
      ],
      inStock: true,
    },
    {
      id: 'set-valentine-hong-nhung',
      title: 'Hộp Quà Hẹn Ước · Hoa Hồng Sáp & Socola',
      audience: 'nu',
      occasionTag: 'valentine',
      price: 289000,
      imageUrl: giftSetValentineImg,
      description:
        'Lựa chọn lãng mạn cho ngày Valentine, tỏ tình hoặc kỷ niệm yêu nhau. Gói gọn trong hộp đỏ rượu vang kèm thiệp trái tim 3D đập theo nhịp.',
      items: [
        '01 Bó hoa hồng sáp nhung thơm lưu hương',
        '01 Hộp Socola tươi Bỉ vị cacao đậm 8 viên',
        '01 Nến thơm hương hoa hồng & gỗ đàn hương',
        '01 Thiệp giấy in sẵn mã QR mở web thiệp Tùy Chỉnh (0đ)',
      ],
      inStock: true,
    },
    {
      id: 'set-sinh-nhat-am-ap',
      title: 'Hộp Quà Tuổi Mới · Bình Giữ Nhiệt & Sổ Tay',
      audience: 'unisex',
      occasionTag: 'sinh-nhat',
      price: 529000,
      imageUrl: giftSetBirthdayImg,
      description:
        'Phù hợp cho cả nam và nữ trong dịp Sinh nhật, Tết hoặc tri ân. Đóng gói sẵn sàng trao tay cùng Web thiệp ánh nến và giọng nói ghi âm.',
      items: [
        '01 Bình giữ nhiệt inox 304 phủ nhám màu champagne (500ml)',
        '01 Sổ tay bìa da + bút ký kim loại vàng đồng',
        '01 Nến thơm mini & hộp bánh quy bơ thủ công',
        '01 Hộp quà cao cấp + Web thiệp 3D Gói Tùy Chỉnh (0đ)',
      ],
      inStock: true,
    },
  ] as GiftSetProduct[],

  // 9. CÂU HỎI THƯỜNG GẶP (FAQ)
  faqs: [
    {
      id: 'faq-1',
      question: 'Tạo một web thiệp theo yêu cầu mất bao lâu?',
      answer:
        'Chỉ khoảng 2–3 phút. Bạn chọn mẫu dịp lễ, nhập lời chúc, tải tối đa 6 ảnh kỷ niệm (ảnh tự nén <= 300KB ngay trên điện thoại), xem trước trực tiếp rồi bấm xác nhận để nhận link /c/<mã> và mã QR.',
    },
    {
      id: 'faq-2',
      question: 'Người nhận mở link trên điện thoại có cần tải app hay đăng nhập không?',
      answer:
        'Không cần. Người nhận chỉ cần chạm vào đường link hoặc quét mã QR bằng camera điện thoại là xem được ngay hiệu ứng hạt 3D, đọc thư và nghe giọng nói/nhạc nền.',
    },
    {
      id: 'faq-3',
      question: 'Khi mua Set quà thì web thiệp tặng kèm hoạt động thế nào?',
      answer:
        'Mỗi đơn đặt Set quà đều được tặng kèm 01 web thiệp Gói Tùy Chỉnh trị giá 59.000đ với giá 0đ (hỗ trợ tối đa 6 ảnh và 1 đoạn ghi âm giọng nói), kèm lựa chọn in sẵn mã QR vào thiệp giấy đặt trong hộp quà.',
    },
    {
      id: 'faq-4',
      question: 'Ảnh và file ghi âm tôi gửi lên có được giữ riêng tư không?',
      answer:
        'Có. Hình ảnh và giọng nói bạn tải lên chỉ được dùng duy nhất để hiển thị trên trang web thiệp của bạn. Nếu đăng nhập tài khoản, bạn có thể quản lý hoặc tự xóa toàn bộ thiệp và dữ liệu của mình bất cứ lúc nào.',
    },
    {
      id: 'faq-5',
      question: 'Thanh toán chuyển khoản xong bao lâu thì web thiệp được mở khóa?',
      answer:
        'Sau khi bạn quét mã VietQR chuyển khoản (nội dung = mã đơn) và bấm "Đã chuyển khoản", quản trị viên sẽ đối chiếu và cập nhật trạng thái đơn trong trang /admin.',
    },
  ] as FaqItem[],

  // 10. ĐIỀU KHOẢN & QUYỀN RIÊNG TƯ
  legal: {
    title: 'Điều khoản sử dụng & Chính sách quyền riêng tư',
    items: [
      'Ảnh kỷ niệm và file ghi âm giọng nói khách hàng gửi lên chỉ phục vụ mục đích hiển thị trên web thiệp của đơn hàng đó, không sử dụng cho mục đích quảng cáo hay chia sẻ cho bên thứ ba.',
      'Thời hạn lưu trữ đường link phụ thuộc vào gói đã chọn: Cơ bản (30 ngày), Tùy chỉnh (90 ngày), Cao cấp (lưu giữ vĩnh viễn theo vòng đời hệ thống).',
      'Khách hàng có tài khoản có thể tự xóa tài khoản và toàn bộ dữ liệu liên quan ngay trong trang "Tài khoản của tôi", hoặc liên hệ shop để được hỗ trợ xóa nhanh.',
      'Nội dung thư, hình ảnh và âm thanh tải lên phải tuân thủ thuần phong mỹ tục và pháp luật Việt Nam; quản trị viên có quyền khóa hoặc xóa các nội dung vi phạm.',
    ],
  },
};

export function formatVnd(amount: number): string {
  if (amount <= 0) return '0đ';
  return `${amount.toLocaleString('vi-VN')}đ`;
}
