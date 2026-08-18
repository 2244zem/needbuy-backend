# Arsitektur — NeedBuy Backend

Dokumen ini menjelaskan **bagaimana kode disusun**. Aturan bisnisnya ada di
[business-rules.md](./business-rules.md), kontrak API-nya di
[swagger.yaml](./swagger.yaml), model keamanannya di [security.md](./security.md).

---

## 1. Stack

| Layer | Pilihan |
|---|---|
| Bahasa | TypeScript (strict) |
| Runtime | Node.js 20+ |
| HTTP | Express 4 |
| ORM | Prisma (satu-satunya lapisan database) |
| Database | PostgreSQL |
| Validasi | zod |
| Auth | JWT access token + refresh token yang dirotasi |
| Payment | Midtrans Snap — **sandbox saja** |
| Log | pino (JSON terstruktur) |
| Test | `node:test` + `node:assert`, dijalankan lewat `tsx` |

Tidak ada ORM kedua, tidak ada lapisan database kedua, tidak ada framework HTTP
kedua.

---

## 2. Struktur modular

```
src/
├── server.ts              # bootstrap: listen + graceful shutdown
├── app/
│   ├── index.ts           # buildApp(): rantai middleware, mount, error handler
│   └── router.ts          # peta modul -> prefix, sebagai data
├── config/                # env, prisma, midtrans, logger
├── middleware/            # auth, validate, idempotency, rateLimit, error, context
├── lib/                   # fungsi murni: tanpa I/O, tanpa Prisma, tanpa env
├── types/                 # tipe bersama + augmentasi Request Express
└── modules/<domain>/      # routes.ts, controller.ts, service.ts, schema.ts
```

Modul: `auth`, `categories`, `sellers`, `products`, `addresses`,
`saved-products`, `needs`, `recommendations`, `shopping-plans`, `cart`,
`checkout`, `orders`, `payments`, `reviews`.

Tidak ada `routes.ts` global, tidak ada `controller.ts` global, tidak ada
`needbuy.service.ts`. Setiap domain memegang berkasnya sendiri.

---

## 3. Batas tanggung jawab

| Berkas | Tugas | Dilarang |
|---|---|---|
| `routes.ts` | path, verb, komposisi middleware | logic apa pun |
| `controller.ts` | baca `req`, panggil satu fungsi service, balas `ok(...)` | query Prisma; logic transisi status atau harga |
| `service.ts` | business logic, akses Prisma, transaction | menyentuh `req`/`res` |
| `schema.ts` | schema zod | selain itu |
| `lib/*` | fungsi murni | async, baca env, sentuh Prisma |

Arahnya satu arah: **routes → controllers → services → lib**.

### Kenapa tidak ada lapisan repository

Master Rules §4 menjadikannya opsional ("when repository abstraction is used").
Sebuah interface dengan tepat satu implementasi per domain adalah indireksi
tanpa manfaat sekarang; service memakai Prisma langsung. Kalau kelak ada sumber
data kedua, saat itulah repository layak diperkenalkan.

---

## 4. Siklus hidup request

```
request
  → requestContext      (X-Request-Id, dipasang ke semua log & error 500)
  → httpLogger          (pino-http; /health & /ready dilewati)
  → helmet              (header keamanan)
  → cors                (allowlist ALLOWED_ORIGINS, bukan wildcard)
  → express.json        (batas 100kb)
  → /health, /ready     (di luar /api/v1, di luar rate limit)
  → /docs               (Swagger UI)
  → /api/v1
      → globalLimiter
      → router modul
          → authLimiter / writeLimiter   (per rute)
          → requireAuth / requireRole
          → validate({ body, query, params })
          → idempotency                  (checkout, cancel, retry pembayaran)
          → asyncHandler(controller)
  → notFoundHandler
  → errorHandler        (SATU-SATUNYA penulis response error)
```

`buildApp()` sengaja dipisah dari `server.ts` supaya integration test bisa
memasang app yang sama persis tanpa membuka port.

---

## 5. Yang tinggal di `lib/`

Semuanya murni dan bisa diuji tanpa database. Ini disengaja: logic yang paling
mahal kalau salah adalah logic yang paling harus gampang dites.

| Berkas | Isi |
|---|---|
| `apiError.ts` | `AppError` + konstruktor bernama |
| `response.ts` | pembangun envelope `ok()` / `fail()` |
| `pagination.ts` | page/limit → skip/take, pembangun meta |
| `orderNumber.ts` | `NB-{timestamp}-{random}`, id order Midtrans |
| `scoringWeights.ts` | enam bobot + assertion jumlah = 1.0 |
| `scoring.ts` | enam komponen skor + `match_score` |
| `ranking.ts` | ambang label, teks penjelasan, pengurutan |
| `parseBudget.ts` | "12 juta" / "Rp12.000.000" → angka |
| `attributeMatch.ts` | predikat pemenuhan requirement |
| `matchFilters.ts` | saringan stock / budget / hard requirement |
| `planTotals.ts` | aritmetika total / remaining / status plan |
| `orderStatus.ts` | peta transisi status order |
| `midtransSignature.ts` | verifikasi signature + pemetaan status |
| `hash.ts` | sha256, token acak, kanonikalisasi body |

---

## 6. Transaction

Setiap operasi yang menyentuh lebih dari satu tabel dibungkus
`prisma.$transaction`: checkout, pembatalan order (kembalikan stok),
penyelesaian order (naikkan soldCount), perhitungan ulang plan, review +
perhitungan ulang rating, regenerasi rekomendasi, register + pembuatan cart,
rotasi refresh token.

**Tidak ada panggilan jaringan di dalam transaction.** Karena itulah pembuatan
Snap terjadi setelah transaction checkout commit — menahan lock baris `products`
selama round-trip ke gateway adalah cara paling standar mengubah gateway lambat
menjadi kemacetan seluruh database.

---

## 7. Konkurensi stok

Tiga lapis, dari aplikasi sampai database:

1. **Conditional update**: `updateMany({ where: { id, stock: { gte: qty } } })`.
   `count === 0` berarti transaction lain menang balapan, dan seluruh checkout
   dibatalkan. Atomik di level baris; tidak bergantung pada hasil pembacaan
   sebelumnya masih benar.
2. **Isolation Serializable** untuk transaction checkout, dengan retry hingga
   3 kali saat Prisma melaporkan write conflict (`P2034`).
3. **CHECK constraint** `stock >= 0` di tabel `products` — database menolak stok
   negatif sekalipun logic aplikasi keliru.

---

## 8. Observability

- **Request id**: dari header `X-Request-Id` kalau ada, kalau tidak uuid baru.
  Dikembalikan di header respons dan disertakan di body error 500, sehingga
  error yang dilaporkan user bisa dipetakan ke baris log tanpa membocorkan apa
  pun.
- **Log terstruktur**: pino JSON, dengan daftar redaksi yang ditegakkan
  konfigurasi (lihat security.md §6).
- **Query lambat**: query di atas `SLOW_QUERY_MS` (default 300 ms) naik ke level
  `warn` beserta durasinya.
- **Layanan eksternal**: setiap panggilan Midtrans dibungkus timer yang mencatat
  sukses/gagal beserta durasi.
- **Health vs ready**: `/health` menjawab tanpa menyentuh dependency apa pun;
  `/ready` menjalankan `SELECT 1` lewat Prisma. Keduanya hanya mengembalikan
  status, tanpa versi atau detail koneksi.

---

## 9. Versioning

Semua route ada di bawah `/api/v1`, termasuk webhook Midtrans
(`POST /api/v1/payments/midtrans/webhook`). Ini menggantikan jalur tanpa versi
di `CLAUDE.md` §6.3 — perubahannya diambil sebelum ada deployment, saat biayanya
nol.

`API_BASE_URL` dibaca di tepat dua tempat: blok `servers` Swagger dan URL
notifikasi Midtrans. Domain tidak pernah di-hardcode di source.

---

## 10. Testing

`npm test` menjalankan `tsx --test "src/**/*.test.ts"`.

`tsx` bukan kenyamanan, tapi kebutuhan: test runner bawaan Node 20 hanya
menemukan berkas `**/*.test.{js,cjs,mjs}`. `--require ts-node/register` mengubah
cara berkas *dimuat*, bukan berkas mana yang *ditemukan* — suite `.ts` akan
terbaca sebagai nol test dan lulus tanpa menguji apa pun.

Unit test menyasar `lib/` (murni, tanpa database). Test kontrak
(`src/app/contract.test.ts`) memastikan route dan `swagger.yaml` cocok di kedua
arah.
