import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  deleteUser,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  getDocFromServer,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
} from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';
import {
  CONFIG,
  GiftAudience,
  GiftSetProduct,
  OccasionId,
  PricingTier,
  PricingTierId,
} from './config';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  if (error instanceof Error && error.message.startsWith('{"error":')) {
    throw error;
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export interface WebCardPhoto {
  url: string;
  caption: string;
}

export interface WebCardRecord {
  code: string;
  userId: string;
  occasion: OccasionId;
  tier: PricingTierId;
  price: number;
  recipientName: string;
  senderName: string;
  greeting: string;
  letter: string;
  accentColor: string;
  bgmId: string;
  photos: WebCardPhoto[];
  voiceAudioUrl?: string;
  status: 'pending_payment' | 'active' | 'expired';
  locked: boolean;
  orderCode: string;
  giftOrderId?: string;
  expiresAtMs: number | null;
  createdAtMs: number;
}

export interface OrderCartItem {
  id: string;
  title: string;
  price: number;
  quantity: number;
}

export interface ShopOrderRecord {
  orderCode: string;
  orderType: 'web_card' | 'gift_set';
  userId: string;
  customerEmail?: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  note?: string;
  wantPrintedQr?: boolean;
  items: OrderCartItem[];
  totalAmount: number;
  cardCode?: string;
  giftFreeCardClaimed?: boolean;
  status: 'pending_payment' | 'paid' | 'delivered' | 'cancelled';
  customerMarkedPaid: boolean;
  createdAtMs: number;
}

export interface PaymentNotificationRecord {
  id: string;
  orderCode: string;
  amount: number;
  note?: string;
  createdAtMs: number;
}

export interface CustomerProfileRecord {
  uid: string;
  displayName: string;
  email: string;
  provider: string;
  agreedTerms: boolean;
  createdAtMs: number;
}

export function slugifyCardCode(raw: string): string {
  const withoutAccents = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
  return withoutAccents
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 48);
}

export function generateRandomCode(length = 6): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[buf[i] % chars.length];
  }
  return out;
}

export function generateOrderCode(prefix = CONFIG.bank.transferPrefix || 'THIEP'): string {
  const safePrefix = slugifyCardCode(prefix).toUpperCase().replace(/-/g, '').slice(0, 8) || 'THIEP';
  const suffix = generateRandomCode(5).toUpperCase();
  return `${safePrefix}${suffix}`;
}

export function buildCardShareUrl(code: string): string {
  return `${window.location.origin}/c/${encodeURIComponent(code)}`;
}

// ============================================================================
// NÉN ẢNH TRÊN TRÌNH DUYỆT (<= 300KB/ẢNH) & KIỂM TRA FILE GHI ÂM (<= 1MB)
// ============================================================================
export interface CompressedMediaResult {
  blob: Blob;
  dataUrl: string;
  sizeBytes: number;
}

function canvasToBlobPromise(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Không thể nén ảnh.'));
      },
      'image/jpeg',
      quality
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không thể đọc dữ liệu file.'));
    reader.readAsDataURL(blob);
  });
}

export async function compressImageUnder300KB(
  file: File,
  maxBytes = 295 * 1024
): Promise<CompressedMediaResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Vui lòng chỉ chọn tệp hình ảnh (JPG, PNG, WEBP).');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Không thể đọc file ảnh này.'));
      el.src = objectUrl;
    });

    let maxDim = 1280;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh.');

    let chosenBlob: Blob | null = null;
    for (let pass = 0; pass < 3; pass++) {
      const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
      canvas.width = Math.max(1, Math.round(img.width * ratio));
      canvas.height = Math.max(1, Math.round(img.height * ratio));
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.85, 0.74, 0.62, 0.5, 0.38]) {
        const blob = await canvasToBlobPromise(canvas, quality);
        chosenBlob = blob;
        if (blob.size <= maxBytes) {
          const dataUrl = await blobToDataUrl(blob);
          return { blob, dataUrl, sizeBytes: blob.size };
        }
      }
      maxDim = Math.round(maxDim * 0.72);
    }

    if (!chosenBlob) throw new Error('Không thể nén ảnh xuống dưới 300KB.');
    const dataUrl = await blobToDataUrl(chosenBlob);
    return { blob: chosenBlob, dataUrl, sizeBytes: chosenBlob.size };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function readVoiceFileUnder1MB(file: File): Promise<{
  blob: Blob;
  dataUrl: string;
  sizeBytes: number;
  name: string;
}> {
  if (!file.type.startsWith('audio/')) {
    throw new Error('Vui lòng chọn tệp âm thanh hợp lệ (MP3, M4A, WAV, OGG).');
  }
  const MAX_BYTES = 1024 * 1024; // 1MB
  if (file.size > MAX_BYTES) {
    throw new Error(
      `File ghi âm vượt quá 1MB (${(file.size / (1024 * 1024)).toFixed(2)}MB). Vui lòng chọn file gọn hơn.`
    );
  }
  const dataUrl = await blobToDataUrl(file);
  return { blob: file, dataUrl, sizeBytes: file.size, name: file.name };
}

async function uploadMediaWithTimeout(
  path: string,
  blob: Blob,
  contentType: string,
  ownerId: string,
  timeoutMs = 7000
): Promise<string> {
  const ref = storageRef(storage, path);
  const uploadPromise = (async () => {
    await uploadBytes(ref, blob, {
      contentType,
      customMetadata: { ownerId },
    });
    return getDownloadURL(ref);
  })();
  const timeoutPromise = new Promise<string>((_, reject) =>
    setTimeout(() => reject(new Error('Storage upload timeout')), timeoutMs)
  );
  return Promise.race([uploadPromise, timeoutPromise]);
}

// ============================================================================
// XÁC THỰC KHÁCH HÀNG (GIAI ĐOẠN 2.5)
// ============================================================================
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return 'Mật khẩu phải có tối thiểu 8 ký tự.';
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Mật khẩu phải bao gồm cả chữ cái và chữ số.';
  }
  return null;
}

export function isGoogleOnlyAccount(user: User | null): boolean {
  if (!user) return false;
  const providers = user.providerData.map((p) => p.providerId);
  return providers.includes('google.com') && !providers.includes('password');
}

export async function consumePendingGoogleRedirect(): Promise<User | null> {
  try {
    const res = await getRedirectResult(auth);
    if (res?.user) {
      await ensureCustomerProfile(res.user, 'google', true);
      return res.user;
    }
  } catch (err) {
    console.warn('Redirect sign-in note:', err);
  }
  return null;
}

export async function ensureCustomerProfile(
  user: User,
  provider: string,
  agreedTerms = true
): Promise<void> {
  const path = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(userRef);
    const displayName = (user.displayName || user.email?.split('@')[0] || 'Khách hàng')
      .trim()
      .slice(0, 140);
    const email = (user.email || `${user.uid}@user.local`).trim().slice(0, 200);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName,
        email,
        provider: provider.slice(0, 30),
        agreedTerms: Boolean(agreedTerms),
        createdAtMs: Date.now(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        displayName,
        email,
        provider: provider.slice(0, 30),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    console.warn(`Không thể đồng bộ ${path}:`, err);
  }
}

export async function registerCustomerAccount(input: {
  displayName: string;
  email: string;
  password: string;
  agreedTerms: boolean;
}): Promise<{ user: User; verificationSent: boolean }> {
  const name = input.displayName.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) throw new Error('Vui lòng nhập họ và tên.');
  if (!email.includes('@')) throw new Error('Email không hợp lệ.');
  const passErr = validatePasswordStrength(input.password);
  if (passErr) throw new Error(passErr);
  if (!input.agreedTerms) {
    throw new Error('Vui lòng đồng ý với Điều khoản sử dụng để đăng ký.');
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, input.password);
    await updateProfile(cred.user, { displayName: name.slice(0, 120) }).catch(() => {});
    let verificationSent = false;
    try {
      await sendEmailVerification(cred.user);
      verificationSent = true;
    } catch {
      verificationSent = false;
    }
    await ensureCustomerProfile(cred.user, 'password', true);
    return { user: cred.user, verificationSent };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/email-already-in-use') {
      throw new Error('Email này đã được đăng ký. Bạn hãy chuyển sang tab Đăng nhập nhé.');
    }
    if (code === 'auth/weak-password') {
      throw new Error('Mật khẩu chưa đủ mạnh (tối thiểu 8 ký tự gồm chữ và số).');
    }
    if (code === 'auth/invalid-email') {
      throw new Error('Định dạng Email không hợp lệ.');
    }
    if (code === 'auth/operation-not-allowed') {
      throw new Error(
        'Đăng nhập Email/Mật khẩu chưa được bật trong Firebase Console -> Authentication -> Sign-in method.'
      );
    }
    throw new Error(err instanceof Error ? err.message : 'Không thể đăng ký tài khoản.');
  }
}

export async function loginCustomerWithEmail(email: string, password: string): Promise<User> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !password) {
    throw new Error('Vui lòng nhập đầy đủ Email và Mật khẩu.');
  }
  try {
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
    await ensureCustomerProfile(cred.user, 'password', true);
    return cred.user;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || '';
    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      code === 'auth/user-not-found'
    ) {
      throw new Error('Email hoặc mật khẩu không chính xác.');
    }
    if (code === 'auth/too-many-requests') {
      throw new Error('Bạn đã thử đăng nhập quá nhiều lần. Vui lòng chờ ít phút.');
    }
    throw new Error(err instanceof Error ? err.message : 'Đăng nhập thất bại.');
  }
}

export async function loginCustomerWithGoogleSmart(): Promise<User | null> {
  const isMobileBrowser = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    await ensureCustomerProfile(cred.user, 'google', true);
    return cred.user;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || '';
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/popup-closed-by-user' ||
      (isMobileBrowser && code === 'auth/cancelled-popup-request')
    ) {
      if (code === 'auth/popup-closed-by-user') {
        throw new Error('Bạn đã đóng cửa sổ đăng nhập Google.');
      }
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    if (code === 'auth/unauthorized-domain') {
      throw new Error(
        'Domain này chưa được thêm vào Authorized domains trong Firebase Console -> Authentication -> Settings.'
      );
    }
    throw new Error(err instanceof Error ? err.message : 'Đăng nhập Google thất bại.');
  }
}

export async function sendPasswordResetForEmail(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail.includes('@')) {
    throw new Error('Vui lòng nhập địa chỉ Email hợp lệ để nhận liên kết đặt lại mật khẩu.');
  }
  try {
    await sendPasswordResetEmail(auth, cleanEmail);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/invalid-email') {
      throw new Error('Địa chỉ Email không hợp lệ.');
    }
    throw new Error('Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại sau.');
  }
}

export async function changeCustomerPassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }
  if (isGoogleOnlyAccount(user)) {
    throw new Error('Tài khoản Google không sử dụng mật khẩu riêng.');
  }
  const err = validatePasswordStrength(newPassword);
  if (err) throw new Error(err);

  try {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code || '';
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      throw new Error('Mật khẩu hiện tại không chính xác.');
    }
    throw new Error(e instanceof Error ? e.message : 'Không thể đổi mật khẩu.');
  }
}

export async function deleteCustomerAccountAndData(currentPassword?: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Bạn chưa đăng nhập.');
  const uid = user.uid;

  // Nếu tài khoản email+mật khẩu cung cấp mật khẩu hiện tại, xác thực lại trước khi xóa dữ liệu
  if (!isGoogleOnlyAccount(user) && user.email && currentPassword) {
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
  }

  // 1. Xóa các Web thiệp thuộc sở hữu UID này
  try {
    const cardsSnap = await getDocs(query(collection(db, 'webCards'), where('userId', '==', uid)));
    for (const cDoc of cardsSnap.docs) {
      const code = cDoc.id;
      try {
        const folderRef = storageRef(storage, `cards/${code}`);
        const files = await listAll(folderRef);
        await Promise.all(files.items.map((item) => deleteObject(item).catch(() => {})));
      } catch {
        // Bỏ qua nếu Storage không có file hoặc chưa bật Storage
      }
      await deleteDoc(doc(db, 'webCards', code));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `webCards (userId=${uid})`);
  }

  // 2. Xóa các đơn hàng thuộc sở hữu UID này
  try {
    const ordersSnap = await getDocs(query(collection(db, 'orders'), where('userId', '==', uid)));
    for (const oDoc of ordersSnap.docs) {
      await deleteDoc(doc(db, 'orders', oDoc.id));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `orders (userId=${uid})`);
  }

  // 3. Xóa hồ sơ users/<UID>
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
  }

  // 4. Xóa tài khoản Firebase Auth
  try {
    await deleteUser(user);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/requires-recent-login') {
      throw new Error(
        'Để bảo mật, vui lòng nhập lại mật khẩu hiện tại (hoặc đăng xuất rồi đăng nhập lại Google) trước khi xóa tài khoản.'
      );
    }
    throw new Error(err instanceof Error ? err.message : 'Không thể xóa tài khoản.');
  }
}

export async function logoutAccount(): Promise<void> {
  await signOut(auth);
}

// ============================================================================
// XÁC THỰC QUẢN TRỊ VIÊN (/admin) — TUYỆT ĐỐI KHÔNG VIẾT CỨNG MẬT KHẨU
// ============================================================================
export interface AdminAccessStatus {
  isAdmin: boolean;
  mustChangePassword: boolean;
  reason?: string;
}

export async function checkAdminPrivilege(user: User | null): Promise<AdminAccessStatus> {
  if (!user) return { isAdmin: false, mustChangePassword: false };

  try {
    const [adminSnap, tokenResult] = await Promise.all([
      getDoc(doc(db, 'admins', user.uid)).catch(() => null),
      user.getIdTokenResult().catch(() => null),
    ]);

    const hasAdminDoc = Boolean(adminSnap && adminSnap.exists());
    const hasAdminClaim = Boolean(tokenResult?.claims?.admin === true);

    if (!hasAdminDoc && !hasAdminClaim) {
      return {
        isAdmin: false,
        mustChangePassword: false,
        reason: 'Tài khoản này chưa được cấp quyền trong collection Firestore "admins".',
      };
    }

    // Nếu đăng nhập bằng Google, kiểm tra thêm danh sách allowlist (nếu admin đã cấu hình thật)
    const isGoogle = user.providerData.some((p) => p.providerId === 'google.com');
    const configuredAllowlist = CONFIG.adminAllowedEmails
      .map((e) => e.replace(/^\[+|\]+$/g, '').trim().toLowerCase())
      .filter((e) => e && e.includes('@'));
    if (isGoogle && configuredAllowlist.length > 0 && user.email) {
      if (!configuredAllowlist.includes(user.email.toLowerCase()) && !hasAdminClaim) {
        return {
          isAdmin: false,
          mustChangePassword: false,
          reason: 'Email Google này không nằm trong danh sách quản trị viên được phép.',
        };
      }
    }

    const data = adminSnap?.exists() ? adminSnap.data() : {};
    return {
      isAdmin: true,
      mustChangePassword: Boolean(data?.mustChangePassword === true),
    };
  } catch {
    return { isAdmin: false, mustChangePassword: false };
  }
}

export async function signInAdminWithUsernameOrEmail(
  usernameOrEmail: string,
  password: string
): Promise<{ user: User; status: AdminAccessStatus }> {
  const raw = usernameOrEmail.replace(/^\[+|\]+$/g, '').trim().toLowerCase();
  if (!raw || !password) {
    throw new Error('Thông tin đăng nhập không hợp lệ.');
  }

  let resolvedEmail = raw;
  if (raw === 'admin') {
    const cfgEmail = CONFIG.adminEmail.replace(/^\[+|\]+$/g, '').trim();
    if (!cfgEmail || !cfgEmail.includes('@')) {
      throw new Error(
        'Chưa điền CONFIG.adminEmail trong src/config.ts. Vui lòng tạo tài khoản admin trong Firebase Console và điền email vào CONFIG.adminEmail.'
      );
    }
    resolvedEmail = cfgEmail.toLowerCase();
  }

  if (!resolvedEmail.includes('@')) {
    throw new Error('Thông tin đăng nhập không hợp lệ.');
  }

  const cred = await signInWithEmailAndPassword(auth, resolvedEmail, password);
  const status = await checkAdminPrivilege(cred.user);
  if (!status.isAdmin) {
    await signOut(auth).catch(() => {});
    throw new Error('Thông tin đăng nhập không hợp lệ hoặc tài khoản chưa có quyền quản trị.');
  }
  return { user: cred.user, status };
}

export async function signInAdminWithGoogle(): Promise<{ user: User; status: AdminAccessStatus }> {
  const cred = await signInWithPopup(auth, googleProvider);
  const status = await checkAdminPrivilege(cred.user);
  if (!status.isAdmin) {
    await signOut(auth).catch(() => {});
    throw new Error('Tài khoản Google này không có quyền truy cập trang quản trị.');
  }
  return { user: cred.user, status };
}

export async function changeAdminPasswordAndClearFirstFlag(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error('Phiên đăng nhập quản trị đã hết hạn.');
  }
  if (newPassword !== confirmPassword) {
    throw new Error('Mật khẩu mới nhập lại lần 2 không khớp.');
  }
  const passErr = validatePasswordStrength(newPassword);
  if (passErr) throw new Error(passErr);

  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);

  const adminRef = doc(db, 'admins', user.uid);
  try {
    const snap = await getDoc(adminRef);
    if (snap.exists()) {
      await updateDoc(adminRef, {
        mustChangePassword: false,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `admins/${user.uid}`);
  }
}

// ============================================================================
// WEB THIỆP 3D: TẠO, ĐỌC (/c/<code>), KIỂM TRA HẾT HẠN & QUẢN LÝ
// ============================================================================
export interface CreateWebCardInput {
  occasion: OccasionId;
  tier: PricingTierId;
  price: number;
  customSlug?: string;
  recipientName: string;
  senderName: string;
  greeting: string;
  letter: string;
  accentColor: string;
  bgmId: string;
  photos: { file?: File; dataUrl: string; caption: string }[];
  voiceFile?: File | null;
  voiceDataUrl?: string;
  giftOrderId?: string;
}

export async function isCardCodeAvailable(rawSlug: string): Promise<boolean> {
  const slug = slugifyCardCode(rawSlug);
  if (slug.length < 2) return false;
  try {
    const snap = await getDoc(doc(db, 'webCards', slug));
    return !snap.exists();
  } catch {
    return true;
  }
}

async function compressDataUrlUnderMaxBytes(
  dataUrl: string,
  maxBytes = 280 * 1024
): Promise<CompressedMediaResult> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Không thể đọc dữ liệu ảnh đã chỉnh sửa.'));
    el.src = dataUrl;
  });

  let maxDim = 960;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh.');

  let chosenBlob: Blob | null = null;
  for (let pass = 0; pass < 3; pass++) {
    const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
    canvas.width = Math.max(1, Math.round(img.width * ratio));
    canvas.height = Math.max(1, Math.round(img.height * ratio));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.85, 0.72, 0.6, 0.48, 0.36]) {
      const blob = await canvasToBlobPromise(canvas, quality);
      chosenBlob = blob;
      if (blob.size <= maxBytes) {
        const outUrl = await blobToDataUrl(blob);
        return { blob, dataUrl: outUrl, sizeBytes: blob.size };
      }
    }
    maxDim = Math.round(maxDim * 0.72);
  }

  if (!chosenBlob) throw new Error('Không thể nén ảnh.');
  const outUrl = await blobToDataUrl(chosenBlob);
  return { blob: chosenBlob, dataUrl: outUrl, sizeBytes: chosenBlob.size };
}

export async function createWebCardAndOrder(
  input: CreateWebCardInput
): Promise<{ card: WebCardRecord; order: ShopOrderRecord }> {
  const uid = auth.currentUser ? auth.currentUser.uid : 'guest';
  const email = auth.currentUser?.email || '';

  let code =
    input.tier === 'premium' && input.customSlug
      ? slugifyCardCode(input.customSlug)
      : generateRandomCode(6);

  if (code.length < 2) {
    code = generateRandomCode(6);
  }

  // Nếu gói cao cấp chọn slug đã trùng, báo lỗi rõ ràng
  if (input.tier === 'premium' && input.customSlug) {
    const existing = await getDoc(doc(db, 'webCards', code)).catch(() => null);
    if (existing && existing.exists()) {
      throw new Error(`Tên đường link "/c/${code}" đã có người sử dụng. Vui lòng chọn tên khác.`);
    }
  } else {
    // Đảm bảo mã ngẫu nhiên chưa trùng
    for (let attempt = 0; attempt < 3; attempt++) {
      const existing = await getDoc(doc(db, 'webCards', code)).catch(() => null);
      if (!existing || !existing.exists()) break;
      code = generateRandomCode(6);
    }
  }

  // Nén ảnh đã canh chỉnh & tải lên Storage (hoặc lưu bản nén gọn nếu Storage chưa bật)
  const uploadedPhotos: WebCardPhoto[] = [];
  const rawPhotos = input.photos.slice(0, 6);
  for (let i = 0; i < rawPhotos.length; i++) {
    const p = rawPhotos[i];
    const caption = (p.caption || `Kỷ niệm ${i + 1}`).trim().slice(0, 100);
    if (p.dataUrl && p.dataUrl.startsWith('data:image/')) {
      const compressed = await compressDataUrlUnderMaxBytes(p.dataUrl, 280 * 1024);
      let finalUrl = compressed.dataUrl;
      try {
        finalUrl = await uploadMediaWithTimeout(
          `cards/${code}/photo_${i}_${Date.now()}.jpg`,
          compressed.blob,
          'image/jpeg',
          uid
        );
      } catch {
        // Fallback: giữ bản nén gọn < 110KB nếu Storage chưa bật để vừa Firestore 1MB
        if (compressed.sizeBytes > 110 * 1024) {
          const compact = await compressDataUrlUnderMaxBytes(p.dataUrl, 105 * 1024);
          finalUrl = compact.dataUrl;
        }
      }
      uploadedPhotos.push({ url: finalUrl, caption });
    } else if (p.file) {
      const compressed = await compressImageUnder300KB(p.file, 280 * 1024);
      let finalUrl = compressed.dataUrl;
      try {
        finalUrl = await uploadMediaWithTimeout(
          `cards/${code}/photo_${i}_${Date.now()}.jpg`,
          compressed.blob,
          'image/jpeg',
          uid
        );
      } catch {
        if (compressed.sizeBytes > 110 * 1024) {
          const compact = await compressImageUnder300KB(p.file, 105 * 1024);
          finalUrl = compact.dataUrl;
        }
      }
      uploadedPhotos.push({ url: finalUrl, caption });
    } else if (p.dataUrl) {
      uploadedPhotos.push({ url: p.dataUrl, caption });
    }
  }

  let finalVoiceUrl = input.voiceDataUrl || '';
  if (input.voiceFile) {
    const voice = await readVoiceFileUnder1MB(input.voiceFile);
    try {
      finalVoiceUrl = await uploadMediaWithTimeout(
        `cards/${code}/voice_${Date.now()}.audio`,
        voice.blob,
        voice.blob.type || 'audio/mpeg',
        uid
      );
    } catch {
      finalVoiceUrl = voice.dataUrl;
    }
  }

  // Nếu nhạc nền là file data:audio tải lên từ máy -> ưu tiên đẩy lên Storage lấy URL gọn
  let finalBgmId = (input.bgmId || 'preset:we-wish-you').trim();
  if (finalBgmId.startsWith('data:audio/')) {
    try {
      const resp = await fetch(finalBgmId);
      const blob = await resp.blob();
      if (blob.size <= 1024 * 1024) {
        finalBgmId = await uploadMediaWithTimeout(
          `cards/${code}/bgm_${Date.now()}.audio`,
          blob,
          blob.type || 'audio/mpeg',
          uid
        );
      }
    } catch {
      // Giữ nguyên data:audio/ nếu vừa giới hạn Firestore
    }
  }

  const now = Date.now();
  const durationDays =
    input.tier === 'premium'
      ? CONFIG.linkDays.premium
      : input.tier === 'custom'
        ? CONFIG.linkDays.custom
        : CONFIG.linkDays.basic;
  const expiresAtMs =
    typeof durationDays === 'number' ? now + durationDays * 24 * 60 * 60 * 1000 : null;

  const orderCode = generateOrderCode();
  const photosJson = JSON.stringify(uploadedPhotos).slice(0, 890000);
  const cleanRecipient = input.recipientName.trim().slice(0, 120) || 'Bạn yêu quý';
  const cleanSender = input.senderName.trim().slice(0, 120) || 'Người thương';
  const cleanGreeting = input.greeting.trim().slice(0, 160) || 'Chúc Mừng\nGiáng Sinh';
  const cleanLetter = input.letter.trim().slice(0, 10000) || 'Gửi đến bạn những lời chúc ấm áp nhất.';
  const cleanAccent = (input.accentColor || '#E6BE73').slice(0, 20);
  const cleanBgm = (finalBgmId || 'preset:we-wish-you').slice(0, 595000);

  const cardPayload: Record<string, unknown> = {
    code,
    userId: uid,
    occasion: input.occasion,
    tier: input.tier,
    price: Math.max(0, Number(input.price) || 0),
    recipientName: cleanRecipient,
    senderName: cleanSender,
    greeting: cleanGreeting,
    letter: cleanLetter,
    accentColor: cleanAccent,
    bgmId: cleanBgm,
    photosJson,
    status: 'pending_payment',
    locked: false,
    orderCode,
    expiresAtMs,
    createdAtMs: now,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (finalVoiceUrl) {
    cardPayload.voiceAudioUrl = finalVoiceUrl.slice(0, 1490000);
  }
  if (input.giftOrderId) {
    cardPayload.giftOrderId = input.giftOrderId.slice(0, 64);
  }

  const cardPath = `webCards/${code}`;
  try {
    await setDoc(doc(db, 'webCards', code), cardPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, cardPath);
  }

  const orderItems: OrderCartItem[] = [
    {
      id: `card-${input.tier}`,
      title: `Web thiệp ${input.occasion} (${input.tier === 'basic' ? 'Cơ bản' : input.tier === 'custom' ? 'Tùy chỉnh' : 'Cao cấp'})`,
      price: Math.max(0, Number(input.price) || 0),
      quantity: 1,
    },
  ];

  const orderPayload: Record<string, unknown> = {
    orderCode,
    orderType: 'web_card',
    userId: uid,
    customerEmail: email,
    customerName: cleanSender,
    itemsJson: JSON.stringify(orderItems),
    totalAmount: Math.max(0, Number(input.price) || 0),
    cardCode: code,
    status: 'pending_payment',
    customerMarkedPaid: input.price === 0,
    createdAtMs: now,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const orderPath = `orders/${orderCode}`;
  try {
    await setDoc(doc(db, 'orders', orderCode), orderPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, orderPath);
  }

  // Nếu tạo từ quà tặng Set quà, đánh dấu đã nhận thiệp tặng kèm trên đơn Set quà (nếu chủ đơn đang đăng nhập)
  if (input.giftOrderId && auth.currentUser) {
    try {
      await updateDoc(doc(db, 'orders', input.giftOrderId), {
        giftFreeCardClaimed: true,
        cardCode: code,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Bỏ qua nếu đặt hàng ở chế độ khách không đăng nhập
    }
  }

  const card: WebCardRecord = {
    code,
    userId: uid,
    occasion: input.occasion,
    tier: input.tier,
    price: Math.max(0, Number(input.price) || 0),
    recipientName: cleanRecipient,
    senderName: cleanSender,
    greeting: cleanGreeting,
    letter: cleanLetter,
    accentColor: cleanAccent,
    bgmId: cleanBgm,
    photos: uploadedPhotos,
    voiceAudioUrl: finalVoiceUrl || undefined,
    status: 'pending_payment',
    locked: false,
    orderCode,
    giftOrderId: input.giftOrderId,
    expiresAtMs,
    createdAtMs: now,
  };

  const order: ShopOrderRecord = {
    orderCode,
    orderType: 'web_card',
    userId: uid,
    customerEmail: email,
    customerName: cleanSender,
    items: orderItems,
    totalAmount: Math.max(0, Number(input.price) || 0),
    cardCode: code,
    status: 'pending_payment',
    customerMarkedPaid: input.price === 0,
    createdAtMs: now,
  };

  return { card, order };
}

function docToWebCard(id: string, d: Record<string, unknown>): WebCardRecord {
  let photos: WebCardPhoto[] = [];
  try {
    const parsed = JSON.parse(String(d.photosJson || '[]'));
    if (Array.isArray(parsed)) {
      photos = parsed
        .filter((item) => item && typeof item.url === 'string')
        .map((item) => ({
          url: String(item.url),
          caption: String(item.caption || ''),
        }));
    }
  } catch {
    photos = [];
  }
  const createdTs = d.createdAt as Timestamp | undefined;
  return {
    code: String(d.code || id),
    userId: String(d.userId || 'guest'),
    occasion: (d.occasion as OccasionId) || 'noel',
    tier: (d.tier as PricingTierId) || 'basic',
    price: Number(d.price || 0),
    recipientName: String(d.recipientName || 'Bạn yêu quý'),
    senderName: String(d.senderName || 'Người thương'),
    greeting: String(d.greeting || 'Chúc mừng'),
    letter: String(d.letter || ''),
    accentColor: String(d.accentColor || '#E6BE73'),
    bgmId: String(d.bgmId || 'preset:we-wish-you'),
    photos,
    voiceAudioUrl: typeof d.voiceAudioUrl === 'string' ? d.voiceAudioUrl : undefined,
    status: (d.status as WebCardRecord['status']) || 'pending_payment',
    locked: Boolean(d.locked),
    orderCode: String(d.orderCode || ''),
    giftOrderId: typeof d.giftOrderId === 'string' ? d.giftOrderId : undefined,
    expiresAtMs: typeof d.expiresAtMs === 'number' ? d.expiresAtMs : null,
    createdAtMs:
      typeof d.createdAtMs === 'number'
        ? d.createdAtMs
        : createdTs?.toMillis
          ? createdTs.toMillis()
          : Date.now(),
  };
}

export async function fetchWebCardByCode(rawCode: string): Promise<WebCardRecord | null> {
  const code = slugifyCardCode(rawCode);
  if (!code) return null;
  const path = `webCards/${code}`;
  try {
    const snap = await getDoc(doc(db, 'webCards', code));
    if (!snap.exists()) return null;
    return docToWebCard(snap.id, snap.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeToWebCardByCode(
  rawCode: string,
  onUpdate: (card: WebCardRecord | null) => void
): () => void {
  const code = slugifyCardCode(rawCode);
  if (!code) {
    onUpdate(null);
    return () => {};
  }
  const ref = doc(db, 'webCards', code);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
      } else {
        onUpdate(docToWebCard(snap.id, snap.data()));
      }
    },
    () => {
      // Fallback: ignore transient snapshot errors
    }
  );
}

export async function fetchMyWebCards(uid: string): Promise<WebCardRecord[]> {
  const path = 'webCards';
  try {
    const q = query(collection(db, 'webCards'), where('userId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => docToWebCard(d.id, d.data()))
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function subscribeToMyWebCards(
  uid: string,
  onUpdate: (cards: WebCardRecord[]) => void
): () => void {
  const q = query(collection(db, 'webCards'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => docToWebCard(d.id, d.data()))
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
      onUpdate(list);
    },
    () => {}
  );
}

// ============================================================================
// SET QUÀ, ĐƠN HÀNG & THANH TOÁN VIETQR (GIAI ĐOẠN 3 & 4)
// ============================================================================
function docToGiftSet(id: string, d: Record<string, unknown>): GiftSetProduct {
  let items: string[] = [];
  try {
    const parsed = JSON.parse(String(d.itemsJson || '[]'));
    if (Array.isArray(parsed)) items = parsed.map((x) => String(x));
  } catch {
    items = [];
  }
  return {
    id: String(d.id || id),
    title: String(d.title || ''),
    audience: (d.audience as GiftAudience) || 'unisex',
    occasionTag: (d.occasionTag as OccasionId | 'all') || 'all',
    price: Number(d.price || 0),
    imageUrl: String(d.imageUrl || ''),
    description: String(d.description || ''),
    items,
    inStock: Boolean(d.inStock !== false),
  };
}

export async function fetchGiftSets(): Promise<GiftSetProduct[]> {
  try {
    const snap = await getDocs(collection(db, 'giftSets'));
    if (snap.empty) {
      return CONFIG.defaultGiftSets;
    }
    return snap.docs.map((d) => docToGiftSet(d.id, d.data()));
  } catch (error) {
    console.warn('Fallback gift sets:', error);
    return CONFIG.defaultGiftSets;
  }
}

function docToOrder(id: string, d: Record<string, unknown>): ShopOrderRecord {
  let items: OrderCartItem[] = [];
  try {
    const parsed = JSON.parse(String(d.itemsJson || '[]'));
    if (Array.isArray(parsed)) {
      items = parsed.map((x) => ({
        id: String(x.id || ''),
        title: String(x.title || ''),
        price: Number(x.price || 0),
        quantity: Number(x.quantity || 1),
      }));
    }
  } catch {
    items = [];
  }
  return {
    orderCode: String(d.orderCode || id),
    orderType: d.orderType === 'web_card' ? 'web_card' : 'gift_set',
    userId: String(d.userId || 'guest'),
    customerEmail: typeof d.customerEmail === 'string' ? d.customerEmail : undefined,
    customerName: String(d.customerName || ''),
    customerPhone: typeof d.customerPhone === 'string' ? d.customerPhone : undefined,
    customerAddress: typeof d.customerAddress === 'string' ? d.customerAddress : undefined,
    note: typeof d.note === 'string' ? d.note : undefined,
    wantPrintedQr: Boolean(d.wantPrintedQr),
    items,
    totalAmount: Number(d.totalAmount || 0),
    cardCode: typeof d.cardCode === 'string' ? d.cardCode : undefined,
    giftFreeCardClaimed: Boolean(d.giftFreeCardClaimed),
    status: (d.status as ShopOrderRecord['status']) || 'pending_payment',
    customerMarkedPaid: Boolean(d.customerMarkedPaid),
    createdAtMs: Number(d.createdAtMs || Date.now()),
  };
}

export async function createGiftSetOrder(input: {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  note?: string;
  wantPrintedQr: boolean;
  items: OrderCartItem[];
}): Promise<ShopOrderRecord> {
  const uid = auth.currentUser ? auth.currentUser.uid : 'guest';
  const email = auth.currentUser?.email || '';
  const orderCode = generateOrderCode('QUA');
  const now = Date.now();
  const totalAmount = input.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const cleanName = input.customerName.trim().slice(0, 140);
  const cleanPhone = input.customerPhone.trim().slice(0, 30);
  const cleanAddr = input.customerAddress.trim().slice(0, 400);
  const cleanNote = (input.note || '').trim().slice(0, 600);

  if (!cleanName || !cleanPhone || !cleanAddr) {
    throw new Error('Vui lòng nhập đầy đủ Họ tên, Số điện thoại và Địa chỉ giao hàng.');
  }
  if (input.items.length === 0) {
    throw new Error('Giỏ hàng đang trống.');
  }

  const orderPath = `orders/${orderCode}`;
  try {
    await setDoc(doc(db, 'orders', orderCode), {
      orderCode,
      orderType: 'gift_set',
      userId: uid,
      customerEmail: email,
      customerName: cleanName,
      customerPhone: cleanPhone,
      customerAddress: cleanAddr,
      note: cleanNote,
      wantPrintedQr: Boolean(input.wantPrintedQr),
      itemsJson: JSON.stringify(input.items).slice(0, 19000),
      totalAmount,
      giftFreeCardClaimed: false,
      status: 'pending_payment',
      customerMarkedPaid: false,
      createdAtMs: now,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, orderPath);
  }

  return {
    orderCode,
    orderType: 'gift_set',
    userId: uid,
    customerEmail: email,
    customerName: cleanName,
    customerPhone: cleanPhone,
    customerAddress: cleanAddr,
    note: cleanNote,
    wantPrintedQr: Boolean(input.wantPrintedQr),
    items: input.items,
    totalAmount,
    giftFreeCardClaimed: false,
    status: 'pending_payment',
    customerMarkedPaid: false,
    createdAtMs: now,
  };
}

export async function fetchMyOrders(uid: string): Promise<ShopOrderRecord[]> {
  try {
    const q = query(collection(db, 'orders'), where('userId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => docToOrder(d.id, d.data()))
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'orders');
  }
}

export function subscribeToMyOrders(
  uid: string,
  onUpdate: (orders: ShopOrderRecord[]) => void
): () => void {
  const q = query(collection(db, 'orders'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => docToOrder(d.id, d.data()))
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
      onUpdate(list);
    },
    () => {}
  );
}

export async function notifyCustomerTransferred(
  orderCode: string,
  amount: number,
  note = ''
): Promise<void> {
  const notifId = `${slugifyCardCode(orderCode)}_${Date.now().toString(36)}`;
  const notifPath = `paymentNotifications/${notifId}`;
  try {
    await setDoc(doc(db, 'paymentNotifications', notifId), {
      orderCode: slugifyCardCode(orderCode).toUpperCase() || orderCode,
      amount: Math.max(0, Number(amount) || 0),
      note: note.trim().slice(0, 300),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, notifPath);
  }

  if (auth.currentUser) {
    try {
      await updateDoc(doc(db, 'orders', orderCode), {
        customerMarkedPaid: true,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Nếu đơn tạo ở chế độ guest trước khi đăng nhập thì vẫn đã có paymentNotification cho Admin
    }
  }
}

// ============================================================================
// BẢNG GIÁ ĐỘNG TỪ FIRESTORE (settings/pricing)
// ============================================================================
export async function fetchPricingTiers(): Promise<PricingTier[]> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'pricing'));
    if (snap.exists()) {
      const parsed = JSON.parse(String(snap.data().tiersJson || '[]'));
      if (Array.isArray(parsed) && parsed.length === 3) {
        return parsed as PricingTier[];
      }
    }
  } catch {
    // Fallback về CONFIG.pricing
  }
  return CONFIG.pricing;
}

// ============================================================================
// HÀM QUẢN TRỊ VIÊN (/admin)
// ============================================================================
export async function fetchAllOrdersForAdmin(): Promise<ShopOrderRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'orders'));
    return snap.docs
      .map((d) => docToOrder(d.id, d.data()))
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'orders');
  }
}

export async function fetchAllPaymentNotificationsForAdmin(): Promise<PaymentNotificationRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'paymentNotifications'));
    return snap.docs
      .map((d) => {
        const data = d.data();
        const ts = data.createdAt as Timestamp | undefined;
        return {
          id: d.id,
          orderCode: String(data.orderCode || ''),
          amount: Number(data.amount || 0),
          note: typeof data.note === 'string' ? data.note : undefined,
          createdAtMs: ts?.toMillis ? ts.toMillis() : Date.now(),
        };
      })
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'paymentNotifications');
  }
}

export async function updateOrderStatusAdmin(
  orderCode: string,
  newStatus: ShopOrderRecord['status'],
  linkedCardCode?: string
): Promise<void> {
  const path = `orders/${orderCode}`;
  try {
    await updateDoc(doc(db, 'orders', orderCode), {
      status: newStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }

  // Nếu đơn là web thiệp & vừa duyệt đã thanh toán -> mở trạng thái 'active' trên webCard tương ứng
  if (linkedCardCode) {
    try {
      const cardStatus =
        newStatus === 'paid' || newStatus === 'delivered'
          ? 'active'
          : newStatus === 'pending_payment'
            ? 'pending_payment'
            : 'expired';
      await updateDoc(doc(db, 'webCards', linkedCardCode), {
        status: cardStatus,
        locked: newStatus === 'cancelled',
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Bỏ qua nếu thiệp đã bị xóa
    }
  }
}

export async function fetchAllWebCardsForAdmin(): Promise<WebCardRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'webCards'));
    return snap.docs
      .map((d) => docToWebCard(d.id, d.data()))
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'webCards');
  }
}

export async function toggleWebCardLockAdmin(
  code: string,
  locked: boolean,
  status?: WebCardRecord['status'],
  linkedOrderCode?: string
): Promise<void> {
  const path = `webCards/${code}`;
  const targetStatus: WebCardRecord['status'] =
    status || (locked ? 'expired' : 'active');
  try {
    await updateDoc(doc(db, 'webCards', code), {
      locked,
      status: targetStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }

  if (linkedOrderCode) {
    try {
      const orderStatus: ShopOrderRecord['status'] =
        locked || targetStatus === 'expired'
          ? 'cancelled'
          : targetStatus === 'active'
            ? 'paid'
            : 'pending_payment';
      await updateDoc(doc(db, 'orders', linkedOrderCode), {
        status: orderStatus,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Bỏ qua nếu không tìm thấy đơn hàng liên kết
    }
  }
}

export async function deleteWebCardAdmin(code: string): Promise<void> {
  const path = `webCards/${code}`;
  try {
    const folderRef = storageRef(storage, `cards/${code}`);
    const files = await listAll(folderRef).catch(() => null);
    if (files) {
      await Promise.all(files.items.map((item) => deleteObject(item).catch(() => {})));
    }
  } catch {
    // ignore storage errors
  }
  try {
    await deleteDoc(doc(db, 'webCards', code));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveGiftSetAdmin(gift: GiftSetProduct): Promise<void> {
  const id = slugifyCardCode(gift.id) || `set-${generateRandomCode(5)}`;
  const path = `giftSets/${id}`;
  try {
    const snap = await getDoc(doc(db, 'giftSets', id));
    const payload: Record<string, unknown> = {
      id,
      title: gift.title.trim().slice(0, 140),
      audience: gift.audience,
      occasionTag: String(gift.occasionTag || 'all').slice(0, 40),
      price: Math.max(0, Number(gift.price) || 0),
      imageUrl: gift.imageUrl.trim().slice(0, 500000),
      description: gift.description.trim().slice(0, 1500),
      itemsJson: JSON.stringify(gift.items.filter(Boolean)).slice(0, 4000),
      inStock: Boolean(gift.inStock),
      updatedAt: serverTimestamp(),
    };
    if (!snap.exists()) {
      payload.createdAt = serverTimestamp();
      await setDoc(doc(db, 'giftSets', id), payload);
    } else {
      await updateDoc(doc(db, 'giftSets', id), payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteGiftSetAdmin(id: string): Promise<void> {
  const path = `giftSets/${id}`;
  try {
    await deleteDoc(doc(db, 'giftSets', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function seedDefaultGiftSetsAdmin(): Promise<void> {
  for (const item of CONFIG.defaultGiftSets) {
    await saveGiftSetAdmin(item);
  }
}

export async function savePricingTiersAdmin(tiers: PricingTier[]): Promise<void> {
  const uid = auth.currentUser?.uid || 'admin';
  const path = 'settings/pricing';
  try {
    await setDoc(doc(db, 'settings', 'pricing'), {
      tiersJson: JSON.stringify(tiers).slice(0, 15000),
      updatedBy: uid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchAllCustomersForAdmin(): Promise<CustomerProfileRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          uid: String(data.uid || d.id),
          displayName: String(data.displayName || 'Khách hàng'),
          email: String(data.email || ''),
          provider: String(data.provider || 'password'),
          agreedTerms: Boolean(data.agreedTerms),
          createdAtMs: Number(data.createdAtMs || Date.now()),
        };
      })
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'users');
  }
}
