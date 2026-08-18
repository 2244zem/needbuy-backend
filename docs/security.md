# Keamanan — NeedBuy Backend

Prinsip dasarnya satu: **backend tidak pernah mengandalkan frontend untuk
keamanan.** Setiap angka uang, setiap cek kepemilikan, setiap status pembayaran
ditentukan server.

---

## 1. Autentikasi

**Access token** — JWT, umur pendek (`JWT_EXPIRES_IN`, default `15m`), berisi
`sub` (user id) dan `role`.

**Refresh token** — nilai acak 256-bit yang buram (bukan JWT), umur
`REFRESH_EXPIRES_IN_DAYS` (default 30 hari). Yang disimpan di database hanya
sha256 hash-nya: kebocoran database tidak boleh menghasilkan token yang bisa
dipakai.

Access token dibuat pendek justru karena ia tidak bisa dicabut. Umur panjang
diletakkan pada refresh token yang bisa dirotasi dan dicabut.

### Rotasi dan deteksi pemakaian ulang

Setiap `POST /auth/refresh` mencabut token yang dipakai dan menerbitkan
penggantinya, dirangkai lewat `replacedById`.

Kalau token yang **sudah dicabut** dipakai lagi, itu indikasi token bocor:
seluruh refresh token milik user tersebut dicabut dan responsnya 401
`TOKEN_REUSE_DETECTED`. Pencuri dan korban sama-sama terlempar; korban tinggal
login ulang, pencuri kehilangan akses.

### Password

bcrypt, cost 12 (`BCRYPT_ROUNDS`). `passwordHash` tidak pernah muncul di
response mana pun — service memilih daftar kolom secara eksplisit alih-alih
mengembalikan record Prisma utuh.

### Anti-enumerasi akun

Login mengembalikan pesan yang **identik** untuk email tidak dikenal maupun
password salah. bcrypt tetap dijalankan terhadap hash dummy saat email tidak
ditemukan, supaya waktu responsnya juga mirip.

---

## 2. Otorisasi

Bukan hanya "sudah login?", tapi "resource ini punya siapa?".

Penegakannya ada di **lapisan service**, bukan di router — router hanya tahu
siapa pemanggilnya, bukan apa yang sedang dia raih. Setiap pembacaan dan
penulisan resource milik user menyertakan `userId` di klausa `where`, bukan
ambil-dulu-bandingkan-belakangan. Dengan begitu pola gagal "fetch, lupa cek,
kembalikan" jadi mustahil secara struktur.

Ber-scope pemilik: `needs`, `recommendations` (lewat need-nya), `carts`,
`cart_items`, `shopping_plans`, `shopping_plan_items`, `orders`, `addresses`,
`saved_products`, `reviews`, `payments` (lewat order-nya).

Ber-scope seller: seller hanya boleh mengubah produk yang `sellerId`-nya sama
dengan miliknya. Ketidakcocokan menghasilkan **403**, bukan 404 — pemanggilnya
seller yang sah, dan menyembunyikan keberadaan produk tidak membeli apa pun.

Transisi status order: `SHIPPED` dan `DELIVERED` hanya oleh seller pemilik
order; `COMPLETED` dan pembatalan hanya oleh buyer pemilik order.

### Admin

`requireRole('ADMIN')` dipasang **sekali di router `/admin`**, bukan diulang per
rute — supaya rute admin baru tidak bisa lupa dilindungi. Aturan yang sama
berlaku untuk CRUD kategori.

**Tidak ada endpoint yang bisa mencetak admin.** Admin pertama datang dari seed
(development) atau dari `UPDATE users SET role = 'ADMIN'` langsung di database.
Endpoint yang bisa menaikkan role dari luar adalah jalur eskalasi hak akses.

Aksi admin yang sensitif tercatat di `audit_logs`: `SELLER_STATUS_CHANGED`,
`CATEGORY_CREATED`, `CATEGORY_UPDATED`, `CATEGORY_DELETED`. Setiap baris memuat
pelaku, aksi, target, IP, dan konteks perubahan.

Dua aturan pada tabel audit:

1. **Tidak punya foreign key ke `users`.** Baris audit harus tetap ada walaupun
   akun pelakunya dihapus — jejak audit yang ikut terhapus bersama pelakunya
   tidak ada gunanya saat menyelidiki insiden.
2. **`metadata` tidak pernah memuat rahasia** — hanya nilai lama, nilai baru,
   dan alasan. Catatan audit yang berisi password atau token berubah dari alat
   investigasi menjadi sumber kebocoran.

Kegagalan menulis audit **tidak** menggagalkan aksi yang sudah berhasil; ia
dicatat ke log aplikasi. Membalikkan suspend toko yang sudah terjadi hanya
karena baris audit gagal ditulis akan menimbulkan masalah yang lebih besar.

---

## 3. Validasi input

Semua endpoint publik divalidasi zod lewat `middleware/validate.ts`. Hasil parse
**menggantikan** `req.body`/`query`/`params`, jadi controller menerima nilai
yang sudah ter-coerce dan bertipe.

Yang divalidasi: field wajib, tipe, panjang string, rentang angka, enum, format
uuid untuk id, format desimal untuk uang, bilangan bulat positif untuk kuantitas,
batas `page`/`limit` (limit maksimal 100), field sort terhadap allowlist, field
filter terhadap allowlist, dan format URL untuk gambar.

Field `sort` sangat penting: tanpa allowlist, nilai dari client masuk langsung ke
`orderBy` Prisma.

---

## 4. Proteksi mass assignment

Dua lapis, sengaja:

1. Semua schema zod memakai `.strict()`, jadi key asing **ditolak**, bukan
   diabaikan. `role: "ADMIN"` di body register gagal di sini.
2. Service merakit payload Prisma **field demi field**. Tidak pernah
   `data: req.body`, tidak pernah menyebarkan input client.

Lapis pertama membuat kesalahan client berbunyi keras; lapis kedua memastikan
kelalaian di schema tidak bisa berubah jadi eskalasi hak akses.

Selalu ditentukan server, tidak pernah diterima dari request: `role`,
`sellerId`, `rating`, `soldCount`, seluruh skor rekomendasi, `payments.status`,
`orders.status`, dan setiap angka uang.

---

## 5. Uang dan stok

**Tidak ada satu pun angka uang yang diterima dari client.** Body cart hanya
membawa `productId` dan `quantity`. Total cart, total plan, subtotal order,
ongkir, dan `gross_amount` yang dikirim ke Midtrans semuanya dihitung ulang di
server dari `products.price` dan snapshot yang tersimpan.

Semua uang bertipe `Prisma.Decimal`, tidak pernah `number`. Aritmetikanya
memakai method Decimal, bukan operator JS.

Stok tidak pernah dipercaya dari client. Setiap penambahan/perubahan item cart
membaca ulang `products.stock` saat itu juga. Pengurangan stok memakai
conditional update dalam transaction Serializable, dengan CHECK constraint
`stock >= 0` di database sebagai penjaga terakhir.

---

## 6. Rate limiting dan pembatasan permintaan

| Limiter | Cakupan | Anggaran |
|---|---|---|
| `authLimiter` | `/auth/login`, `/auth/register`, `/auth/refresh` | 10 / 15 menit per IP |
| `writeLimiter` | operasi tulis terautentikasi | 120 / 15 menit per user |
| `globalLimiter` | seluruh `/api/v1` | 300 / 15 menit (dapat dikonfigurasi) |

Ditambah **throttle per akun** untuk login: 5 kegagalan beruntun pada satu email
mengunci 15 menit, dengan pesan generik yang tidak mengungkap apakah akunnya ada.
Ini melengkapi limiter per-IP — tanpa itu, penyerang dengan banyak IP bisa
menggempur satu akun.

**Webhook Midtrans tidak di-rate-limit.** Retry dari Midtrans adalah lalu lintas
yang sah dan handler-nya idempoten; membatasinya berarti membuang notifikasi
pembayaran yang benar.

Batas ukuran body: `express.json({ limit: "100kb" })`.

> Store limiter dan throttle login berada di memori proses. Benar untuk satu
> instance; pada deployment multi-instance hitungannya jadi terlalu longgar dan
> perlu dipindah ke store bersama (Redis).

---

## 7. Header dan CORS

`helmet()` memasang header keamanan standar. `x-powered-by` dimatikan.

CORS memakai **allowlist** dari `ALLOWED_ORIGINS`, bukan wildcard `cors()` —
karena `credentials: true` tidak boleh dipasangkan dengan origin sembarang.

---

## 8. Idempotency

Berlaku di `POST /checkout`, `POST /orders/{id}/cancel`, dan
`POST /payments/{orderId}/retry`. Header `Idempotency-Key` wajib.

- key sama + hash body sama → response tersimpan diputar ulang, handler tidak jalan
- key sama + hash body beda → 409 `IDEMPOTENCY_KEY_REUSED`
- key baru → handler jalan, response 2xx disimpan

Unique constraint pada kolom `key` sekaligus jadi concurrency guard: dua request
bersamaan, yang kalah mendapat konflik dan berhenti alih-alih menjalankan
checkout kedua. Hanya response 2xx yang disimpan — checkout yang gagal harus
tetap bisa diulang.

Hash body dikanonikalisasi (key objek diurutkan), sehingga `{a:1,b:2}` dan
`{b:2,a:1}` dikenali sebagai request yang sama. Urutan array tetap bermakna.

---

## 9. Pembayaran

Status pembayaran **sepenuhnya dikendalikan server**. Tidak ada endpoint yang
menerima status pembayaran dari client; `payments.status` hanya bisa ditulis
oleh service webhook.

Webhook memverifikasi `sha512(order_id + status_code + gross_amount + serverKey)`
terhadap `signature_key` memakai perbandingan tahan timing attack —
**sebelum membaca field lain apa pun**. Signature tidak cocok → 403, dan tidak
ada satu baris pun yang ditulis.

Handler-nya idempoten: menerapkan status yang sama dua kali tidak melakukan apa
pun, dan tetap membalas 200 supaya Midtrans berhenti mengulang.

Seluruh payload disimpan di `payments.rawResponse` untuk jejak audit, tapi
**tidak pernah diekspos** lewat API.

**Sandbox mutlak**: `config/midtrans.ts` meng-hardcode `isProduction: false`, dan
`config/env.ts` menolak boot kalau `MIDTRANS_SERVER_KEY` tidak diawali
`SB-Mid-server-`. Variabel `MIDTRANS_IS_PRODUCTION` di `.env` hanya dokumentasi
dan tidak pernah dibaca sebagai saklar.

`MIDTRANS_SERVER_KEY` tidak pernah dikirim ke client. Hanya `snapToken` dan
`snapRedirectUrl` yang keluar.

---

## 10. Penanganan error

`middleware/errorHandler.ts` adalah satu-satunya tempat yang menulis response
error. Body-nya dirakit hanya dari tabel pemetaan yang tetap; cabang "error tidak
dikenal" **tidak pernah menyentuh `err.message`**. Inilah yang mencegah stack
trace, connection string, isi query, hash password, token, dan kredensial
gateway bocor ke client.

Kode status yang ditangani: 400, 401, 403, 404, 409, 422, 429, 500, 503.

Error 500 dicatat lengkap di sisi server bersama request id, sementara client
hanya menerima `"Internal server error"` dan request id itu.

---

## 11. Logging

Daftar redaksi ditegakkan konfigurasi pino, bukan kedisiplinan penulis log:
`authorization`, `cookie`, `password`, `passwordHash`, `refreshToken`,
`accessToken`, `tokenHash`, `snapToken`, `signature_key`, `serverKey`,
`JWT_SECRET`, `JWT_REFRESH_SECRET`.

Health check tidak ikut di-log otomatis supaya log tidak tenggelam oleh probe.

---

## 12. AI

Interpreter kebutuhan **bukan sumber kebenaran** (Rules §19). Apa pun
implementasinya — rule-based sekarang, LLM nanti — outputnya divalidasi ulang
terhadap schema zod sebelum boleh dipersist: key dinormalisasi, nilai dipangkas
panjangnya, bobot diklamp ke 0..5, atribut tak dikenal dibuang.

Interpreter tidak pernah menentukan harga, stok, status pembayaran, status
order, otorisasi, kepemilikan seller, atau nominal checkout.

Kegagalan interpreter tidak pernah menjadi 500. Endpoint tetap membalas 200
dengan `interpreted: false` dan arahan fallback ke pencarian produk biasa
(Rules §20).

---

## 13. Belum diimplementasikan

- **Validasi upload berkas** — gambar produk diterima sebagai URL, jadi belum
  ada permukaan upload. Menyusul bersama keputusan penyimpanan.
- **Rate limit terdistribusi** — lihat §6.
- **Layanan pelacakan error eksternal** — log terstruktur dengan request id sudah
  ada; sink eksternalnya menyusul saat deployment.
