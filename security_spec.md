# Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Global Default Deny**: Any path not explicitly matched in `/databases/{database}/documents` is unconditionally denied (`allow read, write: if false;`).
2. **ChristmasCard Ownership & Public QR Access (`/cards/{cardId}`)**:
   - Document ID `cardId` must match `^[a-zA-Z0-9_\-]+$` and be at most 128 characters.
   - Recipients scanning a QR code (`?id=...`) can `get` a specific card document without logging in (`allow get: if isValidId(cardId);`), and `/cards/{cardId}` contains no PII (no email/phone).
   - `list` queries on `/cards` are strictly enforced server-side: only verified signed-in users querying their own cards (`existing().userId == request.auth.uid`) or verified admins (`isAdmin()`) are permitted.
   - On `create`, `incoming().id == cardId`, `incoming().userId == request.auth.uid`, `createdAt == request.time`, and `updatedAt == request.time`.
   - On `update`, `id`, `userId`, and `createdAt` are immutable, `updatedAt == request.time`, and only the owner or an admin may update allowed fields.
3. **Admin Settings (`/settings/{settingId}`)**:
   - Only `settingId == 'adminConfig'` is valid.
   - `isValidAdminConfig` enforces strict keys (`password`, `updatedBy`, `updatedAt`), length bounds (`1..128`), and `updatedAt == request.time`.
   - Only verified users/admins where `incoming().updatedBy == request.auth.uid` can create or update `settings/adminConfig`.
4. **GreetingConfig Ownership & Integrity (`/greetings/{greetingId}`)**:
   - Document ID `greetingId` must match `^[a-zA-Z0-9_\-]+$` and be at most 128 characters.
   - Public visitors can `get` a specific greeting card by ID, while `list` is strictly forbidden (`allow list: if false;`).
   - Only authenticated users with a verified email (`request.auth.token.email_verified == true`) can create a greeting document, and `incoming().ownerId` must equal `request.auth.uid`.
   - `createdAt` and `updatedAt` must equal `request.time` on creation; `createdAt` and `ownerId` are immutable on update, and `updatedAt` must equal `request.time`.
5. **TreePhoto Relational Sync (`/greetings/{greetingId}/photos/{photoId}`)**:
   - A `TreePhoto` cannot exist or be accessed unless its parent `/greetings/{greetingId}` document exists (Master Gate).
   - `incoming().greetingId` must match the path `{greetingId}` and remain immutable.
   - Only the parent greeting's owner or a verified administrator (`isAdmin()`) may create, update, or delete photos under `/greetings/{greetingId}/photos/{photoId}`.
6. **Admin Collection (`/admins/{adminId}`)**:
   - Strictly read-only for the matching authenticated user or existing admin; client writes (`create`, `update`, `delete`) are forbidden (`if false`) to prevent privilege escalation or self-assigned roles.

## 2. The "Dirty Dozen" Payloads

1. **Unauthenticated Write**: Creating `/cards/abc123` with `auth == null`.
2. **Unverified Email Spoof**: Creating `/cards/abc123` with `email: "dthong.design2016@gmail.com"` but `email_verified: false`.
3. **Identity Spoofing on Create**: Creating `/cards/abc123` where `userId != request.auth.uid`.
4. **Shadow Field Injection on Create**: Creating `/cards/abc123` with an extra field `isSuperAdmin: true`.
5. **Shadow Field Injection on Update**: Updating `/cards/abc123` with an extra field `hacked: "yes"`.
6. **Immutable Field Mutation (`userId`)**: Updating `/cards/abc123` to change `userId` to another user.
7. **Immutable Field Mutation (`createdAt`)**: Updating `/cards/abc123` with a modified `createdAt` timestamp.
8. **Future/Past Client Timestamp Forgery**: Creating or updating `/cards/abc123` where `updatedAt != request.time`.
9. **Resource Exhaustion / Oversized Payload**: Updating `/cards/abc123` with `recipientName` exceeding 120 chars or `photoCount` outside `[1, 12]`.
10. **Orphaned Subcollection Write**: Creating `/greetings/nonexistent/photos/photo_0` when `/greetings/nonexistent` does not exist.
11. **Cross-Tenant Subcollection Write**: User B attempting to create/update `/greetings/main/photos/photo_0` when User A owns `/greetings/main`.
12. **Self-Assigned Admin Escalation**: Authenticated user attempting to create `/admins/{uid}` with `{ role: "admin" }`.
