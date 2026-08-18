# Panduan API — NeedBuy Backend

Kontrak lengkapnya ada di [swagger.yaml](./swagger.yaml), tersaji sebagai UI di
`/docs`. Dokumen ini panduan praktis memakainya.

Base URL: `{API_BASE_URL}/api/v1` — lokal `http://localhost:4000/api/v1`.

---

## 1. Envelope response

Sukses:

```json
{ "success": true, "data": { }, "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 } }
```

Gagal:

```json
{
  "success": false,
  "error": { "code": "INSUFFICIENT_STOCK", "message": "Stok tidak mencukupi." },
  "requestId": "0f3c…"
}
```

`meta` hanya ada di endpoint berpaginasi. `requestId` disertakan pada error —
sertakan saat melaporkan masalah, itu yang memetakan ke log server.

**Uang selalu berupa string desimal** (`"12000000.00"`). Jangan diparsing sebagai
float; pakai library desimal atau bilangan bulat sen.

---

## 2. Autentikasi

```bash
# Daftar
curl -X POST $BASE/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Rani","email":"rani@example.com","password":"rahasia123"}'

# Login
curl -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"rani@example.com","password":"rahasia123"}'
```

Keduanya mengembalikan:

```json
{ "user": {}, "accessToken": "eyJ…", "refreshToken": "a1b2…", "expiresIn": "15m" }
```

Kirim access token di setiap request terproteksi:

```
Authorization: Bearer <accessToken>
```

Access token berumur 15 menit. Saat menerima 401 `TOKEN_EXPIRED`, panggil
refresh:

```bash
curl -X POST $BASE/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"a1b2…"}'
```

**Simpan refresh token yang baru dan buang yang lama.** Token lama langsung
dicabut. Memakainya lagi akan mencabut seluruh sesi kamu dan mengembalikan
401 `TOKEN_REUSE_DETECTED` — itu perilaku anti-pencurian token, bukan bug.

---

## 2b. Profil dan ganti password

```bash
# Profil lengkap: termasuk data toko dan ringkasan jumlah order/need/alamat
curl $BASE/users/me -H "Authorization: Bearer $TOKEN"

# Ubah profil — hanya name dan phone
curl -X PATCH $BASE/users/me -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"name":"Rani Amelia"}'
```

`role`, `email`, dan `passwordHash` **tidak bisa** dikirim lewat endpoint ini —
body yang memuatnya ditolak `422`, bukan diabaikan diam-diam.

```bash
curl -X POST $BASE/users/me/change-password -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"currentPassword":"rahasia123","newPassword":"rahasiaBaru456"}'
```

Berhasil ganti password akan **mencabut semua refresh token** kamu, termasuk
yang sedang dipakai. Responsnya menyebutkan `revokedSessions`. Semua perangkat
harus login ulang — itu memang tujuannya: orang mengganti password justru
karena curiga akunnya diambil orang lain, dan sesi lama yang tetap hidup
membuat penggantian itu sia-sia.

Password lama yang salah menghasilkan `409 INVALID_CURRENT_PASSWORD`.

`GET /auth/me` tetap ada dan lebih ringan — pakai itu untuk cek sesi setelah
login, `GET /users/me` untuk halaman profil.

---

## 3. Alur berbasis kebutuhan

```bash
# 1. Kirim kebutuhan dalam kalimat bebas
curl -X POST $BASE/needs -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"rawInput":"laptop buat kuliah desain, budget 12 juta, RAM minimal 16GB"}'
```

Responsnya mengembalikan hasil parse **yang belum dipersist**:

```json
{
  "need": { "id": "…", "status": "DRAFT" },
  "interpreted": true,
  "parsed": {
    "budget": 12000000,
    "requirements": [{ "key": "ram", "value": "16GB", "isHard": true }],
    "preferences": []
  },
  "needsClarification": false,
  "clarificationQuestions": []
}
```

Kalau `needsClarification` true, tanyakan `clarificationQuestions` ke user
sebelum lanjut.

Kalau `interpreted` false, responsnya tetap 200 dan berisi arahan fallback:

```json
{ "interpreted": false, "fallback": "TRADITIONAL_SEARCH", "searchEndpoint": "/api/v1/products" }
```

Alihkan user ke pencarian produk biasa. Ini bukan error.

```bash
# 2. Konfirmasi (user boleh mengoreksi lebih dulu) — di sinilah requirement tersimpan
curl -X POST $BASE/needs/$NEED_ID/confirm -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"budget":12000000,"requirements":[{"key":"ram","value":"16GB","isHard":true}],"preferences":[]}'

# 3. Jalankan matching + scoring + ranking
curl -X POST $BASE/needs/$NEED_ID/process -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{}'

# 4. Ambil hasilnya, sudah terurut ranking
curl "$BASE/needs/$NEED_ID/recommendations?page=1&limit=20" -H "Authorization: Bearer $TOKEN"
```

Setiap rekomendasi membawa keenam komponen skor, `matchScore`, `label`
(`BEST_MATCH` / `GOOD_MATCH` / `ALTERNATIVE`), `ranking`, dan `explanation`.
Semuanya dihitung backend — jangan menghitung ulang di frontend.

### Menyunting need setelah dibuat

```bash
# Ubah goal / budget / lokasi
curl -X PATCH $BASE/needs/$NEED_ID -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"budget":15000000}'

# Tambah satu requirement (isHard WAJIB eksplisit)
curl -X POST $BASE/needs/$NEED_ID/requirements -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"key":"storage","value":"512GB","isHard":false}'

# Tambah satu preference
curl -X POST $BASE/needs/$NEED_ID/preferences -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"key":"berat","value":"ringan","weight":2}'

# Hapus
curl -X DELETE $BASE/needs/$NEED_ID/requirements/$REQ_ID …
curl -X DELETE $BASE/needs/$NEED_ID/preferences/$PREF_ID …
curl -X DELETE $BASE/needs/$NEED_ID …
```

Setelah menyunting, jalankan `/process` lagi untuk memperbarui rekomendasi.

Tiga catatan:

- `rawInput` **tidak bisa** diubah. Kalimat asli kamu adalah jejak audit
  interpretasi. Kalau kebutuhannya berubah, buat need baru.
- `status` tidak diterima dari body. Statusnya berubah sendiri lewat
  confirm/process.
- Semua penyuntingan ditolak `409 NEED_PROCESSING` selama need sedang dianalisis.

### Batas rate untuk endpoint analisis

`POST /needs` dan `POST /needs/{id}/process` memakai limiter tersendiri:
**20 request per 15 menit per user**, jauh lebih ketat daripada 120 untuk
operasi tulis biasa. Keduanya menjalankan interpreter dan/atau memindai
kandidat lalu menghitung enam komponen skor per produk. Melebihi batas
menghasilkan `429 TOO_MANY_REQUESTS`.

---

## 4. Shopping plan

```bash
# Buat dari rekomendasi teratas sebuah need
curl -X POST $BASE/shopping-plans -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"budget":15000000,"needId":"'$NEED_ID'","fromRecommendations":true,"maxItems":3}'
```

Perhatikan `status`:

- `READY` — `remaining >= 0`, siap dilanjutkan
- `NEEDS_ADJUSTMENT` — over budget

Saat over budget, tersedia tiga jalan:

```bash
# naikkan budget
curl -X PATCH $BASE/shopping-plans/$PLAN_ID -d '{"budget":18000000}' …

# cari alternatif lebih murah per item
curl $BASE/shopping-plans/$PLAN_ID/alternatives …

# ganti sebuah item
curl -X PUT $BASE/shopping-plans/$PLAN_ID/items/$ITEM_ID/replace \
  -d '{"productId":"'$CHEAPER_ID'"}' …
```

`total`, `remaining`, dan `status` selalu dihitung ulang server. Jangan mengirim
angka total.

```bash
curl -X POST $BASE/shopping-plans/$PLAN_ID/add-to-cart …
```

Responsnya `{ "added": 2, "failed": [{ "productId": "…", "reason": "INSUFFICIENT_STOCK" }] }`
— periksa `failed`, sebagian item bisa gagal tanpa menggagalkan sisanya.

---

## 5. Cart dan checkout

Body cart hanya membawa `productId` dan `quantity`. Harga dan subtotal berasal
dari server:

```bash
curl -X POST $BASE/cart/items -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"productId":"'$PRODUCT_ID'","quantity":1}'
```

Pratinjau lebih dulu — tidak menulis apa pun:

```bash
curl -X POST $BASE/checkout/preview -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"shippingCost":20000}'
```

Periksa `canCheckout` dan `stockProblems` sebelum melanjutkan.

Checkout **wajib** menyertakan `Idempotency-Key`:

```bash
curl -X POST $BASE/checkout -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"addressId":"'$ADDRESS_ID'","shippingCost":20000}'
```

Bangkitkan kunci itu sekali per usaha checkout dan **pakai ulang kunci yang sama
saat mencoba ulang karena jaringan**. Itulah yang mencegah dua set order.

Responsnya berisi satu entri per seller:

```json
{
  "orderCount": 2,
  "orders": [
    { "orderId": "…", "orderNumber": "NB-…", "payment": { "snapToken": "…", "snapRedirectUrl": "https://app.sandbox.midtrans.com/snap/v2/vtweb/…" } }
  ]
}
```

Cart dengan produk dari dua seller menghasilkan **dua order** dan **dua Snap
token**. Frontend harus siap menangani lebih dari satu pembayaran.

Kalau `payment` bernilai null dan ada `paymentError`, panggil
`POST /payments/{orderId}/retry` (juga butuh `Idempotency-Key`).

---

## 6. Pembayaran

Muat Snap.js dengan `clientKey` sandbox lalu buka `snapToken`, atau arahkan user
ke `snapRedirectUrl`.

Status pembayaran **hanya** berubah lewat webhook dari Midtrans. Frontend tidak
bisa dan tidak boleh melaporkan bahwa sesuatu sudah dibayar. Untuk mengetahui
status terbaru, poll:

```bash
curl $BASE/payments/$ORDER_ID -H "Authorization: Bearer $TOKEN"
```

Kartu uji sandbox: `4811 1111 1111 1114`, CVV `123`, kedaluwarsa bebas di masa
depan, OTP `112233`.

---

## 7. Order dan review

```bash
curl "$BASE/orders?status=PROCESSING" -H "Authorization: Bearer $TOKEN"
```

Alur status: `WAITING_PAYMENT → PROCESSING → SHIPPED → DELIVERED → COMPLETED`.

- `SHIPPED`, `DELIVERED` — hanya seller pemilik order
- `COMPLETED` — hanya buyer pemilik order
- `PROCESSING` — hanya dari webhook, tidak bisa diminta client
- pembatalan — hanya dari `WAITING_PAYMENT`, oleh buyer, butuh `Idempotency-Key`

Setelah `COMPLETED`, tiap item boleh direview sekali:

```bash
curl -X POST $BASE/orders/$ORDER_ID/items/$ITEM_ID/review \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"rating":5,"comment":"Sesuai deskripsi"}'
```

Review langsung memicu perhitungan ulang rating produk dan rating seller.

---

## 8. Paginasi

Query `page` (mulai 1) dan `limit` (maks 100, default 20). Metanya:

```json
{ "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
```

Field `sort` dibatasi allowlist. Untuk `/products`: `newest`, `price_asc`,
`price_desc`, `rating`, `sold`. Nilai lain ditolak 422.

---

## 9. Kode error

| Kode | HTTP | Arti |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Body/query tidak valid; lihat `error.fields` |
| `UNAUTHORIZED` | 401 | Token tidak ada atau tidak valid |
| `TOKEN_EXPIRED` | 401 | Access token kedaluwarsa — lakukan refresh |
| `TOKEN_REUSE_DETECTED` | 401 | Refresh token dipakai ulang; semua sesi dicabut |
| `REFRESH_TOKEN_INVALID` | 401 | Refresh token tidak dikenal |
| `INVALID_CREDENTIALS` | 401 | Email atau password salah |
| `ACCOUNT_TEMPORARILY_LOCKED` | 429 | Terlalu banyak login gagal |
| `INVALID_CURRENT_PASSWORD` | 409 | Password lama salah saat ganti password |
| `FORBIDDEN` | 403 | Terautentikasi tapi bukan pemilik/role yang berhak |
| `SELLER_SUSPENDED` | 403 | Toko sedang disuspend |
| `NOT_FOUND` | 404 | Resource tidak ada (atau bukan milikmu) |
| `ROUTE_NOT_FOUND` | 404 | Endpoint tidak ada |
| `EMAIL_ALREADY_REGISTERED` | 409 | Email sudah dipakai |
| `INSUFFICIENT_STOCK` | 409 | Stok kurang; `error.fields` merinci per produk |
| `STOCK_CONFLICT` | 409 | Kalah balapan stok — coba lagi |
| `INVALID_STATUS_TRANSITION` | 409 | Transisi status order tidak sah |
| `ALREADY_REVIEWED` | 409 | Item order sudah pernah direview |
| `ORDER_NOT_COMPLETED` | 409 | Review sebelum order selesai |
| `NEED_PROCESSING` | 409 | Need sedang dianalisis; tunggu selesai sebelum mengubahnya |
| `ALREADY_PAID` | 409 | Order sudah dibayar |
| `ADDRESS_IN_USE` | 409 | Alamat sudah dipakai order, tidak bisa dihapus |
| `IDEMPOTENCY_KEY_REQUIRED` | 400 | Endpoint ini wajib pakai `Idempotency-Key` |
| `IDEMPOTENCY_KEY_REUSED` | 409 | Kunci sama dipakai untuk body berbeda |
| `CART_EMPTY` | 400 | Checkout dengan cart kosong |
| `INVALID_SIGNATURE` | 403 | Signature webhook tidak valid |
| `TOO_MANY_REQUESTS` | 429 | Kena rate limit |
| `INTERNAL_ERROR` | 500 | Kesalahan server; laporkan `requestId` |
| `SERVICE_UNAVAILABLE` | 503 | Database atau dependency tidak tersedia |

---

## 10. Health

- `GET /health` — liveness, tidak menyentuh dependency apa pun
- `GET /ready` — readiness, menjalankan `SELECT 1` ke database

Keduanya di luar `/api/v1` dan di luar rate limit.
