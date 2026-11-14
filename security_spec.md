# Security Specification: Portfolio Owner-Only Click Analytics

## 1. Data Invariants
- **Public Write, Owner-Only Read:** Unauthenticated and authenticated visitors can only `create` immutable click events under `/click_events/{eventId}`. Only the verified portfolio owner (`tinotendanyabereka@gmail.com` with `email_verified == true`) can `get`, `list`, or `delete` click events.
- **No Updates:** Click events are strictly append-only (`allow update: if false`).
- **No PII:** Click events never store IP addresses, user IDs, emails, or device fingerprints—only `targetId`, `label`, `category`, and server `createdAt`.
- **Server Temporal Integrity:** `createdAt` must strictly equal `request.time`.
- **Strict Shape & Size Bounds:** `targetId` (`1..64`, `^[a-zA-Z0-9_\-]+$`), `label` (`1..120`), `category` (allowlisted enum), and exact key set (`hasAll` + `hasOnly`).

## 2. Dirty Dozen Adversarial Payloads (Must All Return `PERMISSION_DENIED`)
1. **Unauthenticated List Scrape:** Unauthenticated client calls `getDocs(collection(db, 'click_events'))` -> Denied (`isAdmin()` false).
2. **Non-Owner Signed-In Read:** User signed in as `other@gmail.com` calls `getDocs` or `getDoc` on `/click_events/*` -> Denied (`email` != owner email).
3. **Unverified Admin Email Spoof:** Token with `email: 'tinotendanyabereka@gmail.com'` and `email_verified: false` calls `getDocs` -> Denied (`email_verified == true` required).
4. **Public Delete Attack:** Visitor or non-owner calls `deleteDoc(doc(db, 'click_events', 'evt1'))` -> Denied (`isAdmin()` false).
5. **Counter Tampering (Update):** Visitor or owner calls `updateDoc` on `/click_events/evt1` -> Denied (`allow update: if false`).
6. **Shadow Field Injection:** Visitor creates `{ targetId: 'hero-cv', label: 'Download CV', category: 'hero', createdAt: serverTimestamp(), isAdmin: true }` -> Denied (`keys().hasOnly(...)` rejects `isAdmin`).
7. **Missing Required Field:** Visitor creates `{ targetId: 'hero-cv', label: 'Download CV', category: 'hero' }` -> Denied (`keys().hasAll(...)` fails).
8. **Client-Forged Timestamp:** Visitor creates `{ ..., createdAt: new Date('2020-01-01') }` -> Denied (`createdAt == request.time` fails).
9. **Invalid Category Enum:** Visitor creates `{ ..., category: 'admin_hack' }` -> Denied (`category in [...]` fails).
10. **ID Poisoning (Doc ID):** Visitor creates `/click_events/bad$id!!` or 500-char doc ID -> Denied (`isValidId(eventId)` fails).
11. **Oversized Label DoS:** Visitor creates `{ ..., label: 'x'.repeat(500) }` -> Denied (`label.size() <= 120` fails).
12. **Unprotected Collection Write:** Client writes to `/users/123` or `/admins/123` -> Denied (Global catch-all `match /{document=**} { allow read, write: if false; }`).
