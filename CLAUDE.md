# CLAUDE.md — NeedBuy Backend

Dokumen ini adalah context utama untuk Claude (Claude Code) setiap kali mengerjakan
repo ini. Baca dulu sebelum generate/edit kode apa pun. Tujuannya supaya setiap
sesi kerja — walau terpisah-pisah — tetap` konsisten dengan arsitektur, skema
database, dan business flow yang sudah dikunci di bawah ini.

> Scope proyek ini: **backend only**. Frontend tidak dibahas di sini.

---

## 1. Tech Stack

| Layer            | Pilihan                                                   |
|-------------------|------------------------------------------------------------|
| Bahasa            | TypeScript (strict mode)                                   |
| Runtime           | Node.js 20+                                                 |
| Framework HTTP    | Express.js                                                  |
| ORM               | Prisma ORM                                                  |
| Database          | PostgreSQL                                                  |
| Auth              | JWT (access token), password hash pakai bcrypt              |
| Payment gateway   | **Midtrans Snap — SANDBOX ONLY**, via `midtrans-client`      |
| Validasi input    | zod                                                          |
| Package manager   | npm                                                          |

**Aturan keras soal Midtrans:** proyek ini **tidak pernah** memakai kredensial
production Midtrans. `MIDTRANS_IS_PRODUCTION` **wajib** `false` di semua environment
(dev, staging, bahkan "demo"). Semua Server Key / Client Key yang dipakai harus
diawali `SB-Mid-server-` / `SB-Mid-client-` **atau** `Mid-server-` / `Mid-client-`
(format sandbox di akun ini tidak memakai prefix `SB-`; validasi di
`src/config/env.ts` menerima dua-duanya). Kalau suatu saat mau ke production,
itu perubahan konfigurasi terpisah yang butuh keputusan eksplisit dari user —
jangan diam-diam diubah oleh Claude.

---

## 2. Struktur Folder

> **Diamandemen 2026-08-10** oleh Master Engineering Rules §3 & §5 (modular per
> domain). Struktur flat `src/routes|controllers|services` yang sebelumnya
> dikunci di sini sudah diganti layout modular di bawah. Detail lengkapnya di
> `docs/architecture.md`.

```
needbuy-backend/
├── CLAUDE.md
├── .env.example
├── package.json
├── tsconfig.json
├── docs/                         # swagger.yaml, api.md, architecture.md,
│                                 #  security.md, business-rules.md
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
│       ├── 20260810000000_init/migration.sql
│       └── 20260810010000_needbuy_gaps/migration.sql
└── src/
    ├── server.ts                 # bootstrap: listen + graceful shutdown
    ├── app/
    │   ├── index.ts              # buildApp(): middleware, mount, error handler
    │   └── router.ts             # peta modul -> prefix (sebagai data)
    ├── config/                   # env, prisma singleton, midtrans, logger
    ├── middleware/               # auth, validate, idempotency, rateLimit,
    │                             #  errorHandler, requestContext
    ├── lib/                      # fungsi MURNI: tanpa I/O, tanpa Prisma, tanpa env
    │                             #  (scoring, ranking, parseBudget, planTotals,
    │                             #   orderStatus, midtransSignature, hash, dll)
    ├── types/                    # shared TS types / DTO
    └── modules/<domain>/         # routes.ts, controller.ts, service.ts, schema.ts
        ├── auth/  categories/  sellers/  products/  addresses/
        ├── saved-products/  needs/  recommendations/  shopping-plans/
        └── cart/  checkout/  orders/  payments/  reviews/
```

**Prinsip wajib (tidak berubah):** controller **tidak boleh** berisi query Prisma
langsung untuk logic yang kompleks (matching engine, budget check, checkout).
Semua logic itu harus ada di `service.ts` modulnya, supaya bisa di-unit-test
terpisah dari HTTP layer.

**Tambahan:** logic murni yang tidak butuh database (scoring, ranking, aritmetika
budget, peta transisi status, verifikasi signature) diletakkan di `lib/` supaya
bisa diuji tanpa Prisma maupun env. Tidak ada `routes.ts` global, tidak ada
`controller.ts` global, dan tidak ada satu file service raksasa.

---

## 3. Skema Database (Prisma + PostgreSQL)

Source of truth skema ada di `prisma/schema.prisma`. Ringkasan tabel & relasi:

### Identitas
- **users** — akun (buyer/seller/admin), `role` enum `UserRole`.
- **sellers** — profil toko, 1:1 ke `users` (`user_id` unique). Punya `rating`
  dan `status` (`ACTIVE`/`SUSPENDED`) yang dipakai di `seller_score` matching engine.
- **addresses** — banyak alamat per user, dipakai saat checkout.

### Katalog
- **categories** — self-relation (`parent_id`) untuk sub-kategori.
- **products** — milik satu `seller`, satu `category`. Field kunci: `price`,
  `stock`, `is_active`, `rating`, `sold_count`.
- **product_images** — banyak gambar per produk.
- **product_attributes** — key-value (`attr_key`/`attr_value`), ini yang dipakai
  Matching Engine buat cek **hard requirement** (contoh: `ram` = `8GB`).
- **reviews** — 1:1 ke `order_items` (satu review per item yang dibeli), lalu
  dipakai untuk hitung ulang `products.rating` dan `sellers.rating`.

### Need-Based Search (jantung fitur NeedBuy)
- **needs** — hasil input bebas user (`raw_input`), lalu di-parse AI Interpreter
  jadi `goal`, `budget`, `location`. Status: `DRAFT → PROCESSING → COMPLETED`.
- **need_requirements** — pecahan dari `needs`, per baris punya
  `is_hard_requirement` (true = wajib dipenuhi produk, false = nice-to-have).
- **need_preferences** — soft preference dengan `weight` (float), dipakai buat
  bobot scoring, **tidak pernah** meng-exclude produk.
- **recommendations** — hasil akhir Matching + Ranking Engine. Satu baris per
  kandidat produk yang lolos hard requirement, unique per `(need_id, product_id)`.
  Simpan 6 komponen skor + `match_score` gabungan + `label` + `ranking`.

### Shopping Plan (budgeting)
- **shopping_plans** — opsional terhubung ke `need_id`, punya `budget`, `total`,
  `remaining`, `status` (`DRAFT`/`READY`/`NEEDS_ADJUSTMENT`).
- **shopping_plan_items** — item di dalam plan, punya `is_replaced` flag kalau
  user ganti produk karena over-budget.

### Cart & Checkout
- **carts** — 1:1 per user.
- **cart_items** — unique per `(cart_id, product_id)`.
- **orders** — **satu order = satu seller** (lihat §5, hasil grouping saat
  checkout). Status lifecycle: `WAITING_PAYMENT → PROCESSING → SHIPPED →
  DELIVERED → COMPLETED`, atau `CANCELLED`.
- **order_items** — snapshot `price` & `subtotal` saat order dibuat (jangan
  pernah baca ulang `products.price` untuk order lama).
- **payments** — 1:1 ke `orders`. Menyimpan `midtrans_order_id`,
  `midtrans_transaction_id`, `snap_token`, `snap_redirect_url`, `raw_response`
  (JSON mentah dari Midtrans, buat audit trail).

### Tabel tambahan (migration `20260810010000_needbuy_gaps`, 2026-08-10)

Ditambahkan atas persetujuan eksplisit user, menutup celah antara schema awal
dan Master Engineering Rules:

- **saved_products** — wishlist. Unique `(user_id, product_id)`. Rules §6
  mencantumkannya sebagai entitas inti tapi belum ada di schema awal.
- **idempotency_keys** — `key` unique, `request_hash`, `status_code`,
  `response_body`. Rules §18. Tanpa ini, checkout yang di-double-click membuat
  dua set order dan mengurangi stock dua kali.
- **refresh_tokens** — hanya sha256 hash yang disimpan, dirangkai lewat
  `replaced_by_id` untuk deteksi pemakaian ulang. Rules §10.
- **order_items.product_name** — kolom baru, snapshot nama produk saat order
  dibuat. Rules §27.
- **CHECK `products.stock >= 0`** — penjaga terakhir di level database. Rules §17.

### Tabel tambahan (migration `20260810020000_audit_logs`, 2026-08-10)

- **audit_logs** — jejak aksi admin sensitif (Rules §10, §31). Sengaja TIDAK
  punya foreign key ke `users`: barisnya harus tetap ada walaupun akun pelakunya
  dihapus. `metadata` hanya memuat konteks perubahan, tidak pernah kredensial.

### Tabel tambahan (migration `20260812000000_coupons_chat_sale`, 2026-08-12)

Ditambahkan atas permintaan eksplisit user (kupon, chat penjual, sale di home):

- **coupons** — katalog promo: `code` unique, `type` (`PERCENT`/`FIXED`), `value`,
  `minSpend`, `maxDiscount`, `quota`/`usedCount`, `startsAt`/`expiresAt`.
- **user_coupons** — klaim per user. Unique `(user_id, coupon_id)`; `usedAt`
  menandai kupon yang sudah dipakai. Kuota global dijaga lewat compare-and-set
  di `coupons.usedCount` dalam satu transaction.
- **conversations** — chat pembeli ↔ penjual. Unique `(buyer_id, seller_id)`
  membuat "mulai chat" idempoten tanpa cek-lalu-insert yang bisa balapan.
- **messages** — isi percakapan, `readAt` untuk status dibaca. Realtime
  dilayani polling `GET /messages/conversations/:id/messages?after=<iso>`,
  belum WebSocket.
- **products.discount_percent** — kolom baru (0-90, CHECK di level DB) untuk
  rail promo di home. `price` tetap harga jual; harga coret dihitung di client.

### Tabel tambahan (migration `20260812010000_notifications_product_views`, 2026-08-12)

Ditambahkan atas permintaan eksplisit user (dashboard seller + bel notifikasi):

- **notifications** — isi bel di header seller. Penerima disimpan sebagai
  `user_id` (bukan `seller_id`) supaya baris yang sama bisa dipakai buyer nanti
  tanpa tabel kedua. `order_id` opsional dan di-join saat dibaca — isi order
  (nomor, tipe/metode bayar, daftar barang) tidak pernah disalin ke sini supaya
  tidak bisa basi. `read_at` NULL = belum dibaca.
- **product_views** — satu baris per kunjungan produk, sumber card "Product
  Views". `seller_id` didenormalisasi dari produk supaya hitung per toko cukup
  satu index scan. `user_id` NULL untuk guest, jadi hanya pengunjung login yang
  bisa dihitung unik.

### Tabel & kolom tambahan (migration `20260812050000_product_detail_upgrade`, 2026-08-12)

Ditambahkan atas permintaan eksplisit user (halaman detail produk):

- **products.bulk_min_qty / bulk_discount_percent** — diskon grosir ("beli
  minimal N, potong X%"). Nullable dan selalu sepasang (CHECK di DB + refine di
  zod). Rumus potongannya HANYA ada di `lib/bulkPrice.ts` dan dipakai cart
  maupun checkout — kalau dihitung ulang di tempat lain, harga di halaman
  produk dan yang ditagih checkout bisa berbeda.
- **cart_items.variant / order_items.variant** — model yang dipilih pembeli,
  disimpan sebagai teks siap tampil (`"warna: Hitam"`). Varian di proyek ini
  berasal dari `product_attributes` (beberapa baris dengan `attr_key` sama),
  BUKAN tabel varian dengan stok sendiri. Di `order_items` nilainya snapshot,
  sama alasannya dengan `product_name`.
- **review_media** — foto/video lampiran ulasan, `kind` enum `MediaKind`
  (`IMAGE`/`VIDEO`). Tabel sendiri, bukan kolom array, karena tiap berkas punya
  jenis dan urutan tampil.
- **seller_follows** — pembeli mengikuti toko. Unique `(user_id, seller_id)`
  membuat follow/unfollow idempoten tanpa cek-lalu-insert yang bisa balapan.

Perubahan terkait di modul lain:

- `POST /uploads/image` sekarang juga menerima video (MP4/WebM, batas 20 MB).
  Jenis berkas tetap ditentukan dari magic bytes, bukan header client.
- **Gambar produk penjual**: `POST /invent` dan `PATCH /invent/:id` menerima
  `images` (URL hasil upload) dan `attributes`. Route `POST /invent/:id/images`
  DIHAPUS — handler-nya tidak pernah ada, dan itu sebabnya produk buatan
  penjual tampil tanpa gambar di halaman pembeli.

**WebSocket** `/ws/notifications?token=<accessToken>` (bukan di bawah `/api/v1`,
dipasang di `server.ts` bukan `buildApp()` supaya integration test tetap bisa
merakit app tanpa membuka port). Registry socket in-memory ada di
`modules/notifications/hub.ts` — kalau backend di-scale ke lebih dari satu
instance, `publish()` harus diganti Redis pub/sub. Notifikasi ditulis DI DALAM
transaction checkout, tapi di-push ke socket hanya SETELAH commit: frame yang
sudah terkirim tidak bisa ditarik kalau transaction-nya rollback.

Diagram relasi lengkap: lihat `prisma/schema.prisma` (komentar di tiap model
menjelaskan alasan desainnya, termasuk kenapa `Order` per-seller).

---

## 4. Business Flow — Master Flow

Ringkasan alur end-to-end (detail lengkap ada di riwayat percakapan / file
mermaid flow yang sudah dikunci bareng user — **jangan diubah urutannya** tanpa
konfirmasi eksplisit dari user):

1. **Home** → guest atau login → user bisa: Traditional Search, Need-Based
   Search, lihat Category, Cart, atau Shopping Plans.
2. **Traditional Search**: keyword → filter/sort → detail produk → bisa
   compare, add to cart, atau buy now.
3. **Need-Based Search**:
   `Need Input → validasi → AI Need Interpreter → Need Confirmation → 
   Requirement Engine → Smart Filter → Product Matching → Ranking Engine →
   Need Result`. Dari hasil ini user bisa lihat detail produk, compare, bikin
   Shopping Plan, atau ubah kebutuhan (looping balik ke Need Input).
4. **Shopping Plan**: generate dari Need → cek `total <= budget` → kalau over
   budget, user bisa naikkan budget / optimasi (cari alternatif) / cancel →
   kalau valid, user bisa replace item, remove item, lihat detail produk, atau
   add all to cart.
5. **Cart**: hitung subtotal → cek terhadap budget cart (opsional) → lanjut
   checkout atau continue shopping.
6. **Checkout**: pastikan login → pilih address → shipping → payment →
   order summary (preview) → confirm → **create order (grouped by seller)** →
   payment simulation via Midtrans → sukses/gagal.
7. **Order lifecycle**: `waiting_payment → processing → shipped → delivered →
   completed` (atau `cancelled`, stock dikembalikan). Saat `completed`, user
   bisa kasih review yang trigger update rating produk & seller.

---

## 5. Business Logic Detail (Algorithm Flow)

Ini bagian yang **wajib** diimplementasikan sebagai pure function di
`src/services/`, supaya gampang di-test.

### 5.1 Need Interpreter (`services/needInterpreter.service.ts`)
- Input: `raw_input` (teks bebas dari user).
- Output: `{ goal, budget, location, requirements[], preferences[] }`.
- Kalau hasil parse tidak cukup lengkap (misal budget tidak ketemu), balikan
  flag `needsClarification: true` + pertanyaan tambahan — **jangan** langsung
  simpan ke `NEED_REQUIREMENTS` kalau belum confirmed oleh user.
- Boleh dibungkus manggil LLM (mis. lewat Anthropic API) atau rule-based dulu
  untuk MVP; desain service-nya supaya keduanya bisa saling gantikan
  (interface yang sama).

### 5.2 Matching Engine (`services/matchingEngine.service.ts`)
Alur filter kandidat produk, **urutan ini penting** (fail fast):
1. Kandidat awal: `products.category` cocok dengan `need` **dan**
   `is_active = true`.
2. Exclude kalau `stock <= 0`.
3. Exclude kalau `price` di luar rentang budget (+ toleransi, misal 10-15%
   di atas budget masih boleh masuk sebagai kandidat "alternative").
4. Loop tiap `need_requirements` yang `is_hard_requirement = true` → cek ke
   `product_attributes`. **Kalau ada satu saja hard requirement yang tidak
   terpenuhi, produk langsung di-exclude** — tidak lanjut ke scoring.
5. Produk yang lolos semua hard requirement baru dihitung skornya.

### 5.3 Scoring Formula
6 komponen skor (masing-masing dinormalisasi 0–100) disimpan terpisah di
`recommendations`, lalu digabung jadi `match_score`:

```
match_score = (categoryScore   * 0.15)
            + (budgetScore     * 0.20)
            + (requirementScore* 0.20)   // soft requirement yang terpenuhi
            + (preferenceScore * 0.20)   // sesuai NEED_PREFERENCES.weight
            + (qualityScore    * 0.15)   // dari products.rating
            + (sellerScore     * 0.10)   // dari sellers.rating & status
```

> Bobot di atas adalah default MVP — taruh di satu konstanta
> (`src/lib/scoringWeights.ts`) supaya gampang di-tune tanpa ubah logic.
> **Total bobot harus selalu 1.0.**

### 5.4 Ranking & Labeling (`services/ranking.service.ts`)
- Urutkan `recommendations` DESC berdasarkan `match_score`.
- Label:
  - `match_score >= 85` → `BEST_MATCH`
  - `70 <= match_score < 85` → `GOOD_MATCH`
  - `< 70` → `ALTERNATIVE`
- Set `ranking` (integer, 1-based) sesuai urutan.
- `explanation` = string singkat yang menyebut 1-2 komponen skor tertinggi
  (contoh: "Cocok dengan budget dan rating penjual tinggi").

### 5.5 Shopping Plan Budget Check (`services/shoppingPlan.service.ts`)
- `total = SUM(shopping_plan_items.subtotal)`.
- `remaining = budget - total`.
- `remaining < 0` → status `NEEDS_ADJUSTMENT`, tawarkan opsi: naikkan budget,
  cari alternatif (query ulang `recommendations` dengan harga lebih rendah),
  atau hapus item.
- `remaining >= 0` → status `READY`.
- Setiap perubahan item (replace/remove) **wajib** recalculate `total` &
  `remaining` dalam satu transaction Prisma (`prisma.$transaction`).

### 5.6 Cart Validation (`services/cart.service.ts`)
- Setiap add/update item: cek `quantity <= product.stock` **saat itu juga**
  (jangan percaya stock yang di-cache di client).
- `subtotal` per item = `quantity * price_at_add` (snapshot harga saat
  ditambahkan, bukan `products.price` real-time — biar harga cart tidak
  berubah-ubah kalau seller update harga).

### 5.7 Checkout & Order Creation (`services/checkout.service.ts`)
Langkah wajib, semua dalam **satu Prisma transaction**:
1. Validasi ulang stock semua `cart_items` (stock bisa berubah sejak masuk
   cart). Kalau ada yang tidak cukup → return daftar item bermasalah, **jangan**
   lanjut create order.
2. Group `cart_items` berdasarkan `product.seller_id`.
3. Untuk tiap group, buat satu row `orders` + baris `order_items` terkait.
   `order_number` di-generate unik (misal `NB-{timestamp}-{random}`).
   Status order tergantung metode bayar: `paymentMethod=MIDTRANS` →
   `WAITING_PAYMENT`, `paymentMethod=COD` → langsung `PROCESSING` (tidak
   menunggu bayar di muka; pembayaran COD dilakukan saat barang tiba).
4. `subtotal = SUM(order_items.subtotal)`, `total = subtotal + shipping_cost`.
5. Kurangi `products.stock` sesuai quantity yang di-order.
6. Buat satu row `payments` per order dengan status `PENDING` dan `method`
   sesuai `paymentMethod` yang dipilih (`MIDTRANS`/`COD`). Order COD **tidak**
   pernah dibuatkan Snap transaction.
7. Kosongkan `cart_items` yang sudah di-checkout.

### 5.8 Payment Result Handling
- Sukses: `payments.status = PAID`, `paid_at = now()`, `orders.status =
  PROCESSING`. Stock **sudah** dikurangi di step create order (bukan di sini)
  supaya race condition stock ke-handle lebih awal.
- Gagal / expired: `payments.status = FAILED`/`EXPIRED`. Kalau user tidak
  retry, `orders.status = CANCELLED` dan `products.stock` **dikembalikan**
  (rollback).

### 5.9 Order Status Lifecycle
`WAITING_PAYMENT → PROCESSING → SHIPPED → DELIVERED → COMPLETED`, dengan
`CANCELLED` sebagai exit path dari `WAITING_PAYMENT` dan `PROCESSING`
(PROCESSING → CANCELLED dipakai order COD yang langsung masuk PROCESSING;
pembeli masih boleh membatalkan sebelum dikirim). Transisi status hanya
lewat service layer (`services/order.service.ts`), jangan update `status`
langsung dari controller.

### 5.10 Review & Rating Recalculation (`services/review.service.ts`)
- Review hanya bisa dibuat kalau `orders.status = COMPLETED` dan
  `order_item` belum punya review (`reviews.order_item_id` unique).
- Setelah insert review: recalculate `AVG(rating)` untuk `products.rating`
  (scoped ke `product_id`) dan `sellers.rating` (scoped ke semua review produk
  milik seller itu). Lakukan dalam transaction yang sama dengan insert review.

---

## 6. Integrasi Midtrans (SANDBOX)

### 6.1 Setup
- Pakai package resmi `midtrans-client`.
- Ambil `MIDTRANS_SERVER_KEY` & `MIDTRANS_CLIENT_KEY` dari
  [dashboard sandbox Midtrans](https://dashboard.sandbox.midtrans.com/) —
  **bukan** dari akun production.
- Inisialisasi client di `src/config/midtrans.ts`, contoh:

```ts
import midtransClient from "midtrans-client";

export const snap = new midtransClient.Snap({
  isProduction: false, // HARDCODE false di project ini, jangan baca dari env
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
  clientKey: process.env.MIDTRANS_CLIENT_KEY!,
});
```

### 6.2 Flow Create Transaction
Setelah `orders` + `payments` (status `PENDING`) dibuat di `checkout.service.ts`:

**Opsi A — satu Snap transaction per order (direkomendasikan, konsisten
dengan model `payments` 1:1 `orders`):**
```ts
const transaction = await snap.createTransaction({
  transaction_details: {
    order_id: payment.midtransOrderId, // BUKAN orders.id langsung, generate id unik terpisah
    gross_amount: order.total,
  },
  customer_details: {
    first_name: user.name,
    email: user.email,
    phone: user.phone,
  },
  item_details: order.items.map((i) => ({
    id: i.productId,
    price: i.price,
    quantity: i.quantity,
    name: product.name,
  })),
});
// simpan transaction.token -> payments.snapToken
// simpan transaction.redirect_url -> payments.snapRedirectUrl
```

**Opsi B — kalau checkout menghasilkan beberapa order sekaligus (multi-seller)
dan mau satu kali bayar**, buat satu "payment umbrella" row terpisah yang
menaungi beberapa `orders` (butuh tabel tambahan `payment_groups` — belum ada
di schema sekarang, tambahkan hanya kalau memang dibutuhkan user). **Default
project ini pakai Opsi A** supaya tetap sesuai skema yang sudah dikunci.

### 6.3 Webhook / Notification Handler
- Endpoint: `POST /api/v1/payments/midtrans/webhook` (harus **publicly reachable**
  saat testing — kalau dev lokal, pakai tool tunnel seperti ngrok dan daftarkan
  URL-nya di dashboard sandbox Midtrans, field "Payment Notification URL").

  > **Diamandemen 2026-08-10** oleh Master Engineering Rules §32: seluruh route
  > sekarang berada di bawah `/api/v1`, termasuk webhook ini. Jalur lama
  > `/api/payments/midtrans/webhook` **tidak ada lagi**. `.env.example`
  > (`MIDTRANS_NOTIFICATION_URL`) sudah ikut diperbarui, tapi URL di dashboard
  > sandbox Midtrans **harus didaftarkan ulang secara manual**.
- **Selalu verifikasi signature** sebelum percaya payload:
  ```ts
  import crypto from "crypto";
  const expected = crypto
    .createHash("sha512")
    .update(order_id + status_code + gross_amount + process.env.MIDTRANS_SERVER_KEY)
    .digest("hex");
  if (expected !== signature_key) return res.status(403).send("invalid signature");
  ```
- Mapping `transaction_status` Midtrans → `PaymentStatus` internal:
  - `capture` / `settlement` → `PAID`
  - `pending` → `PENDING`
  - `deny` / `cancel` → `FAILED`
  - `expire` → `EXPIRED`
  - `refund` / `partial_refund` → `REFUNDED`
- Setelah update `payments.status`, panggil `order.service.ts` untuk update
  `orders.status` sesuai §5.8 — **jangan** duplikasi logic status di webhook
  handler langsung.
- Simpan seluruh payload notifikasi ke `payments.rawResponse` (Json) untuk
  audit/debug.

### 6.4 Simulasi Sandbox
- Untuk test manual tanpa kartu asli, pakai
  [Midtrans Simulator](https://simulator.sandbox.midtrans.com/) dengan
  `order_id` yang sama seperti yang dikirim ke Snap.
- Kartu test umum: `4811 1111 1111 1114`, CVV `123`, expiry apa saja di masa
  depan, OTP `112233`.
- Jangan pernah expose `MIDTRANS_SERVER_KEY` ke client — hanya `clientKey`
  yang boleh dipakai di frontend untuk load Snap.js.

---

## 7. Konvensi Kode

- Semua nama tabel & kolom di database `snake_case` (via `@map` di Prisma),
  semua nama field di TypeScript/Prisma Client tetap `camelCase` — **jangan**
  ubah salah satu tanpa update yang lain.
- ID pakai `uuid` (string), **bukan** auto-increment integer.
- Uang selalu `Decimal` (Prisma `Decimal` type / `@db.Decimal`), **jangan**
  pernah pakai `Float`/`Number` buat harga atau total — resiko rounding error.
- Setiap operasi yang menyentuh lebih dari satu tabel (checkout, budget
  recalculation, review + rating update) **wajib** dibungkus
  `prisma.$transaction(...)`.
- Response API konsisten: `{ success: boolean, data?: T, error?: { code, message } }`.
- Validasi request body pakai `zod` di layer `middlewares/validate.ts`, jangan
  divalidasi manual di controller.

---

## 8. Cara Menjalankan (Lokal)

```bash
cp .env.example .env
# isi DATABASE_URL dengan Postgres lokal/Docker, dan credential sandbox Midtrans

npm install
npm run prisma:migrate:dev   # apply migration ke DB lokal (generate ulang kalau schema berubah)
npm run prisma:generate      # generate Prisma Client
npm run dev                  # jalankan server dengan ts-node-dev
```

> **Catatan penting soal migration:** file
> `prisma/migrations/20260810000000_init/migration.sql` di repo ini ditulis
> manual (mirror 1:1 dari `schema.prisma`) karena di lingkungan pembuatannya
> tidak ada akses ke binary engine Prisma untuk menjalankan `prisma migrate
> dev` langsung. **Jalankan `npm run prisma:migrate:dev` di mesin kamu**
> sebagai langkah pertama — Prisma akan memverifikasi migration ini cocok
> dengan `schema.prisma`. Kalau kamu ubah `schema.prisma` di kemudian hari,
> selalu generate migration baru lewat `prisma migrate dev --name <deskripsi>`,
> jangan edit file migration lama.

---

## 9. Yang HARUS Diingat Claude Setiap Sesi

1. **Jangan ubah urutan/struktur business flow** (§4 dan §5) tanpa konfirmasi
   eksplisit — itu sudah dikunci bareng user dari flowchart mermaid asli.
2. **Jangan tambah/hapus tabel** di luar yang sudah ada di §3 tanpa
   konfirmasi — kalau butuh field baru, tambahkan kolom ke model yang sudah
   ada dulu kalau memungkinkan.
3. **Midtrans selalu sandbox.** Kalau lihat kredensial atau URL yang mengarah
   ke production (`api.midtrans.com` tanpa `sandbox`), itu bug — perbaiki.
4. Semua business logic berat (matching, scoring, budget, checkout) ada di
   `services/`, bukan di controller atau di route handler.
5. Order **selalu di-split per seller** saat checkout — satu `orders` row
   tidak pernah berisi produk dari lebih dari satu seller.
