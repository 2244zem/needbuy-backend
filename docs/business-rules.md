# Aturan Bisnis — NeedBuy Backend

Sumber aslinya `CLAUDE.md` §4–§5. Dokumen ini menjelaskan bagaimana aturan itu
berperilaku di kode, tanpa mengulangi struktur folder (lihat
[architecture.md](./architecture.md)) atau model keamanan (lihat
[security.md](./security.md)).

---

## 1. Alur inti

```
Need → Analyze → Requirements → Match → Rank → Shopping Plan → Cart → Checkout → Order
```

Marketplace biasa: cari → filter → banding → beli. NeedBuy dimulai dari
kebutuhan yang dinyatakan dalam kalimat bebas.

---

## 2. Need Interpreter

`POST /needs` menyimpan input mentah lalu menjalankannya melalui interpreter.

Implementasi saat ini **rule-based** — deterministik, tanpa biaya, tanpa API
key. Interface `NeedInterpreter` sudah ada supaya adapter LLM kelak menjadi
penambahan, bukan penulisan ulang.

Yang diekstrak:

| Bagian | Cara |
|---|---|
| Budget | `12 juta`, `12jt`, `1,5 juta`, `Rp12.000.000`, `500rb`, `2 milyar` |
| Kategori | pencocokan kata kunci ke `categories.slug` / `name` |
| Requirement | peta kata kunci → `attr_key` (`ram`, `storage`, `prosesor`, `layar`, `baterai`, `kamera`, `warna`, `berat`, `garansi`, `gpu`) |
| Hard vs soft | kata penanda batas bawah: `minimal`, `min`, `wajib`, `harus`, `setidaknya`, `at least` |
| Preference | frasa lunak: `ringan`, `awet`, `hemat baterai`, `murah`, `premium` |

Ambang budget sengaja 10.000 ke atas, supaya "RAM 16" atau "layar 14 inch" tidak
terbaca sebagai budget.

### Klarifikasi

Kalau budget **atau** kategori tidak ditemukan, `needsClarification` bernilai
true dan sistem mengembalikan pertanyaan lanjutan.

**Selama itu true, tidak ada satu baris pun ditulis ke `need_requirements` atau
`need_preferences`.** Hasil parse hanya dikembalikan; persist baru terjadi di
`POST /needs/{id}/confirm`, setelah user berkesempatan mengoreksi.

### Saat interpreter gagal

Response tetap **200** dengan:

```json
{
  "interpreted": false,
  "fallback": "TRADITIONAL_SEARCH",
  "searchEndpoint": "/api/v1/products",
  "suggestedQuery": "..."
}
```

Need tetap tersimpan sebagai `DRAFT` dengan input mentahnya utuh. Analisis
kebutuhan tidak boleh menjadi titik kegagalan tunggal marketplace.

---

## 3. Matching Engine

`POST /needs/{id}/process`. **Urutan saringan ini penting** — fail fast:

1. Kandidat awal: `categoryId` cocok **dan** `isActive = true`
2. Buang `stock <= 0`
3. Buang `price > budget × 1,15`
4. Untuk setiap **hard requirement**: cek ke `product_attributes`.
   **Satu saja tidak terpenuhi → produk langsung gugur, tanpa dihitung skornya**
5. Yang lolos baru masuk scoring

Langkah 1 dan plafon harga didorong ke klausa `where`; langkah 2–4 dijalankan di
memori atas satu hasil query, dibatasi 500 kandidat.

### Pencocokan atribut

Tidak peduli huruf besar-kecil dan spasi di kedua sisi. Kalau **keduanya**
terbaca sebagai angka (`ram = 16GB` vs requirement `ram >= 8GB`), hard
requirement terpenuhi saat nilai produk **lebih besar atau sama dengan** yang
diminta. Selain itu harus sama persis setelah normalisasi.

### Budget kosong

Kalau `needs.budget` bernilai null, saringan harga **dilewati sepenuhnya** dan
`budgetScore` mengembalikan 100 (netral). Need tanpa budget tidak boleh
menyingkirkan seluruh katalog.

### Preference tidak pernah menyaring

Preference hanya masuk lewat `preferenceScore`. Produk dengan portabilitas buruk
tetap muncul selama ia memenuhi semua hard requirement.

---

## 4. Scoring

Enam komponen, masing-masing dinormalisasi 0–100:

| Komponen | Bobot | Dasar |
|---|---|---|
| `categoryScore` | 0,15 | 100 kategori persis, 60 kategori lain |
| `budgetScore` | 0,20 | 100 di bawah/tepat budget, turun linear ke 0 di `budget × 1,15` |
| `requirementScore` | 0,20 | porsi requirement **soft** yang terpenuhi |
| `preferenceScore` | 0,20 | porsi preference terpenuhi, berbobot dan dinormalisasi |
| `qualityScore` | 0,15 | `products.rating / 5 × 100` |
| `sellerScore` | 0,10 | `sellers.rating / 5 × 100`; **0 kalau seller SUSPENDED** |

```
match_score = Σ (komponen × bobot)
```

Bobot ada di `src/lib/scoringWeights.ts` dengan assertion saat modul dimuat bahwa
jumlahnya tepat 1,0 — bobot yang salah tune gagal keras saat boot, bukan
diam-diam memiringkan setiap ranking selamanya.

Need tanpa preference (atau tanpa soft requirement) akan membagi dengan nol;
komponen itu mengembalikan **100 (netral)**, bukan `NaN`. Need yang sederhana
tidak dihukum untuk hal yang tidak pernah disebut penggunanya.

Semua skor dihitung server dan disimpan. Tidak ada nilai skor yang pernah
dibaca dari request.

---

## 5. Ranking dan label

Urut menurun berdasarkan `match_score`, lalu:

| match_score | label |
|---|---|
| ≥ 85 | `BEST_MATCH` |
| 70 – 84,99 | `GOOD_MATCH` |
| < 70 | `ALTERNATIVE` |

`ranking` adalah indeks 1-based setelah pengurutan. Skor seri di-tie-break
dengan id, supaya urutannya deterministik antar-request.

`explanation` menyebut satu atau dua komponen tertinggi dalam bahasa Indonesia,
mis. "Cocok dengan budget dan rating penjual tinggi." Komponen yang bernilai
netral hanya karena user tidak menyebutkannya **dilewati** — menuliskan "sesuai
preferensi kamu" untuk need tanpa preference berarti membohongi user.

Persist-nya `deleteMany` + `createMany` dalam satu transaction, jadi memproses
ulang need bersifat idempoten dan unique `(needId, productId)` tidak pernah bisa
bentrok. Status need menjadi `COMPLETED` di transaction yang sama.

---

## 6. Shopping Plan

```
total     = Σ items.subtotal
remaining = budget − total
status    = remaining < 0 ? NEEDS_ADJUSTMENT : READY
```

`remaining` tepat nol tetap **READY** — budget yang terpakai habis itu sukses,
bukan kelebihan.

Setiap perubahan item (tambah, ubah jumlah, ganti, hapus, ubah budget) memicu
perhitungan ulang **di transaction yang sama**. Total dari client diabaikan
sepenuhnya.

Saat over budget, user punya tiga jalan: naikkan budget (`PATCH`), cari
alternatif lebih murah (`GET /shopping-plans/{id}/alternatives`, mengambil
rekomendasi need yang sama dengan harga lebih rendah), atau hapus item.
Penggantian item menandai `isReplaced = true`.

`POST /shopping-plans/{id}/add-to-cart` melaporkan kegagalan **per item** (stok
kurang, produk nonaktif) alih-alih menggagalkan seluruh operasi — user cukup
membenahi yang bermasalah.

---

## 7. Cart

Satu cart per user; item unik per `(cart_id, product_id)`. Menambahkan produk
yang sudah ada menaikkan jumlahnya, bukan membuat baris kedua.

`priceAtAdd` di-snapshot saat item pertama masuk dan **tidak pernah
diperbarui**. Seller yang mengubah harga tidak boleh diam-diam mengubah isi cart
orang.

Stok dicek langsung ke database pada setiap penambahan/perubahan.

Budget cart bersifat **informatif** — ditampilkan sebagai `budgetCheck`, tidak
memblokir checkout. Cart juga melaporkan `unavailableItems` sebagai peringatan
dini sebelum user sampai ke checkout.

---

## 8. Checkout

Satu transaction (isolation Serializable), urutannya:

1. Validasi ulang stok seluruh item. Ada yang kurang → **batalkan sebelum apa pun
   dibuat**, kembalikan 409 beserta daftar item bermasalah
2. Kelompokkan item berdasarkan `product.sellerId`
3. Per kelompok: satu `orders` + `order_items`, `orderNumber` = `NB-{ts}-{rand}`
4. `subtotal = Σ order_items.subtotal`; `total = subtotal + shippingCost`
5. Kurangi stok lewat conditional update
6. Satu `payments` per order, status `PENDING`, dengan `midtransOrderId` unik
   yang **bukan** `orders.id`
7. Kosongkan `cart_items` yang sudah di-checkout

**Satu order = satu seller.** Cart berisi produk dari tiga seller menghasilkan
tiga order. Tidak pernah ada satu order yang memuat produk lebih dari satu
seller.

`POST /checkout/preview` menjalankan langkah 1–4 di memori dan **tidak menulis
apa pun**.

### Kenapa Snap dibuat setelah commit

`snap.createTransaction()` adalah panggilan HTTPS keluar. Menahan transaction
Postgres selama panggilan itu akan mengunci baris `products` selama round-trip ke
pihak ketiga — cara paling standar mengubah gateway lambat menjadi kemacetan
seluruh database.

Kalau pembuatan Snap gagal, order tetap ada dalam `WAITING_PAYMENT` dengan
payment `PENDING` tanpa token, dan client bisa memanggil
`POST /payments/{orderId}/retry`. Stok sudah dipesan, dan itu memang yang
diinginkan: stok berkurang saat order dibuat, bukan saat dibayar, sehingga
balapan stok selesai lebih awal.

### Snapshot order

`order_items` menyimpan `productName`, `price`, dan `subtotal` pada saat order
dibuat. Riwayat order tidak pernah bergantung pada harga atau nama produk yang
berlaku sekarang. Seller-nya tersimpan di `orders.sellerId`.

---

## 9. Siklus hidup order

```
WAITING_PAYMENT ──→ PROCESSING ──→ SHIPPED ──→ DELIVERED ──→ COMPLETED
       │
       └──→ CANCELLED
```

Transisi lain ditolak 409 `INVALID_STATUS_TRANSITION`. `COMPLETED` dan
`CANCELLED` bersifat terminal. Tidak ada lompatan (mis. `WAITING_PAYMENT` →
`COMPLETED`) dan tidak ada transisi mundur.

Efek samping:

- `DELIVERED` → mengisi `deliveredAt`
- `COMPLETED` → mengisi `completedAt` dan menaikkan `products.soldCount`
- `CANCELLED` → **mengembalikan `products.stock`** di transaction yang sama

`PROCESSING` hanya datang dari webhook pembayaran, tidak pernah dari endpoint
yang dipanggil client.

---

## 10. Pembayaran

Satu Snap transaction per order (Opsi A pada `CLAUDE.md` §6.2), konsisten dengan
relasi 1:1 `payments` ↔ `orders`. Tidak ada tabel `payment_groups`.

`midtransOrderId` sengaja dibuat terpisah dari `orders.id` karena Midtrans
menganggap `order_id` unik selamanya — retry setelah pembayaran gagal butuh id
baru untuk order yang sama.

Ongkir dikirim sebagai line item tersendiri supaya `Σ item_details` sama persis
dengan `gross_amount`; Midtrans menolak transaksi bila keduanya tidak cocok.

### Pemetaan status webhook

| `transaction_status` Midtrans | `PaymentStatus` internal | Efek ke order |
|---|---|---|
| `capture`, `settlement` | `PAID` | → `PROCESSING`, isi `paidAt` |
| `pending` | `PENDING` | — |
| `deny`, `cancel` | `FAILED` | → `CANCELLED`, stok dikembalikan |
| `expire` | `EXPIRED` | → `CANCELLED`, stok dikembalikan |
| `refund`, `partial_refund` | `REFUNDED` | — |
| lainnya | tidak dipetakan | payload disimpan, tidak ada perubahan |

Logic status order **tidak diduplikasi** di webhook — didelegasikan ke
`orders/service.ts`.

---

## 11. Review dan perhitungan ulang rating

Syarat pembuatan review:

1. Pemanggil terautentikasi
2. Order milik pemanggil
3. `orders.status = COMPLETED`
4. `order_item` belum punya review (unique constraint; muncul sebagai 409
   `ALREADY_REVIEWED`)

Setelah review masuk, di **transaction yang sama**:

- `products.rating` = `AVG(rating)` seluruh review produk tersebut
- `sellers.rating` = `AVG(rating)` seluruh review produk milik seller tersebut

Sebuah rating tidak boleh pernah mencerminkan review yang ternyata di-rollback.
Rating yang dihitung ulang ini kembali masuk ke `qualityScore` dan `sellerScore`
pada pencarian berbasis kebutuhan berikutnya — lingkaran penuh alurnya.
