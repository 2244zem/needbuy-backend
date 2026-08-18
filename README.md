# NeedBuy Backend

Marketplace berbasis kebutuhan. Alih-alih *cari → filter → banding → beli*,
alurnya:

```
Need → Analyze → Requirements → Match → Rank → Shopping Plan → Cart → Checkout → Order
```

Backend saja. TypeScript · Express · Prisma · PostgreSQL · Midtrans Snap (sandbox).

| Dokumen | Isi |
|---|---|
| [docs/api.md](docs/api.md) | Panduan pemakaian API + tabel kode error |
| [docs/swagger.yaml](docs/swagger.yaml) | Kontrak OpenAPI (UI di `/docs`) |
| [docs/architecture.md](docs/architecture.md) | Struktur kode dan alasannya |
| [docs/business-rules.md](docs/business-rules.md) | Matching, scoring, budget, order |
| [docs/security.md](docs/security.md) | Auth, otorisasi, rate limit, pembayaran |
| [CLAUDE.md](CLAUDE.md) | Konteks proyek yang dikunci |
| repo `needbuy-submission` | Panduan deploy ke Railway + Supabase + Vercel |

---

## 1. Prasyarat

- **Node.js 20+** — cek: `node -v`
- **PostgreSQL 14+** berjalan di `localhost:5432`
- **ngrok** — hanya untuk pengembangan lokal, agar webhook Midtrans dan
  callback Google bisa menjangkau laptopmu. Tidak dibutuhkan di produksi.
- Akun **Midtrans Sandbox** — <https://dashboard.sandbox.midtrans.com/>

---

## 2. Siapkan database

Konfigurasi di `.env` mengharapkan role `user` dengan password pilihanmu sendiri, dan
dua database: `needbuy_db` (utama) serta `needbuy_test` (integration test).

Masuk ke psql sebagai superuser:

```bash
  psql -U postgres
```

Jalankan:

```sql
CREATE ROLE "user" WITH LOGIN PASSWORD '<password-kamu>' CREATEDB;

CREATE DATABASE needbuy_db   OWNER "user";
CREATE DATABASE needbuy_test OWNER "user";

\q
```

> `user` adalah kata yang di-reserve PostgreSQL, jadi tanda kutip ganda di
> `CREATE ROLE "user"` itu wajib.
>
> `CREATEDB` diberikan karena Prisma Migrate membuat shadow database sementara
> saat menjalankan `migrate dev`.

Uji koneksinya:

```bash
psql "postgresql://user:<password-kamu>@localhost:5432/needbuy_db" -c "SELECT version();"
```

Kalau perintah itu berhasil, `DATABASE_URL` di `.env` sudah benar.

---

## 3. Konfigurasi

`.env` **sudah dibuat** dan berisi kredensial sandbox Midtrans kamu, secret JWT,
serta URL ngrok. File ini masuk `.gitignore` — jangan pernah di-commit.

Yang perlu kamu tahu isinya:

| Variabel | Nilai | Catatan |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:<password-kamu>@localhost:5432/needbuy_db` | dibuat di langkah 2 |
| `API_BASE_URL` | `https://<domain-ngrok-kamu>.ngrok-free.dev` | dipakai Swagger + URL notifikasi |
| `PORT` | `4000` | port yang di-forward ngrok |
| `MIDTRANS_SERVER_KEY` | `SB-Mid-server-…` | **jangan** dibocorkan ke frontend |
| `MIDTRANS_CLIENT_KEY` | `SB-Mid-client-gwY1D…` | ini yang dipakai Snap.js di frontend |
| `LOG_LEVEL` | `info` | ganti ke `silent` kalau berisik |

Server **menolak boot** kalau `MIDTRANS_SERVER_KEY` tidak diawali
`SB-Mid-server-`. Proyek ini terkunci sandbox; itu memang disengaja.

---

## 4. Install, migrate, seed

```bash
npm install
npm run prisma:migrate:dev     # buat semua tabel
npm run prisma:generate        # generate Prisma Client
npm run prisma:seed            # data contoh (opsional tapi disarankan)
```

`prisma:migrate:dev` menjalankan tiga migration:

1. `20260810000000_init` — 20 tabel inti
2. `20260810010000_needbuy_gaps` — `saved_products`, `idempotency_keys`,
   `refresh_tokens`, `order_items.product_name`, CHECK `stock >= 0`
3. `20260810020000_audit_logs` — `audit_logs` untuk jejak aksi admin

Seed membuat tiga akun demo:

| Email | Password | Role |
|---|---|---|
| `admin@needbuy.test` | `admin12345` | ADMIN |
| `seller@needbuy.test` | `password123` | SELLER |

Endpoint `/api/v1/admin/*` dan `POST/PATCH/DELETE /api/v1/categories` butuh
role ADMIN. **Tidak ada endpoint yang bisa mencetak admin dari luar** — itu
lubang keamanan — jadi admin pertama datang dari seed. Di luar development,
naikkan role lewat database:

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'emailkamu@example.com';
```

Kalau Prisma bertanya nama migration, artinya `schema.prisma` berubah dan belum
punya migration — jangan mengedit migration lama, buat yang baru.

Cek isinya lewat GUI kalau perlu:

```bash
npm run prisma:studio
```

---

## 5. Jalankan server

```bash
npm run dev        # ts-node-dev, reload otomatis
```

Atau mode produksi:

```bash
npm run build
npm start
```

Verifikasi cepat:

```bash
curl http://localhost:4000/health
# {"success":true,"data":{"status":"ok"}}

curl http://localhost:4000/ready
# {"success":true,"data":{"status":"ready"}}   <- "ready" = database tersambung
```

Kalau `/ready` menjawab `degraded`, servernya hidup tapi database tidak
tersambung — ulangi langkah 2.

Swagger UI: <http://localhost:4000/docs>

---

## 6. Jalankan ngrok

Di terminal **terpisah** (server harus tetap jalan):

```bash
ngrok http --url=<domain-ngrok-kamu>.ngrok-free.dev 4000
```

Verifikasi dari luar:

```bash
curl https://<domain-ngrok-kamu>.ngrok-free.dev/health
```

Harus mengembalikan JSON yang sama seperti localhost.

**Dua catatan soal ngrok:**

1. **Halaman peringatan browser.** Saat membuka URL ngrok di browser pertama
   kali, ngrok menampilkan halaman interstisial. Klik "Visit Site" satu kali.
   Untuk klien API, lewati dengan header:

   ```bash
   curl -H "ngrok-skip-browser-warning: true" \
     https://<domain-ngrok-kamu>.ngrok-free.dev/api/v1/categories
   ```

   Webhook Midtrans **tidak** terpengaruh — interstisial hanya untuk request
   yang meminta HTML.

2. **Server sudah `trust proxy`.** Jadi rate limiter membaca IP asli dari
   `X-Forwarded-For`, bukan IP ngrok. Tanpa itu semua trafik terhitung satu IP
   dan limitnya langsung habis.

---

## 7. Daftarkan webhook Midtrans

Ini **langkah manual** dan wajib — tanpa ini pembayaran tidak akan pernah
berubah status dari `WAITING_PAYMENT`.

1. Buka <https://dashboard.sandbox.midtrans.com/>
2. **Settings → Configuration**
3. Isi **Payment Notification URL** dengan persis:

   ```
   https://<domain-ngrok-kamu>.ngrok-free.dev/api/v1/payments/midtrans/webhook
   ```

4. **Save**

> Perhatikan `/api/v1`. Jalur lama tanpa versi sudah tidak ada.

Webhook memverifikasi signature sha512 sebelum membaca field lain apa pun.
Payload tanpa signature yang benar dibalas 403 dan **tidak menulis apa-apa** —
jadi kalau status pembayaran tidak berubah, curiga URL-nya salah atau
`MIDTRANS_SERVER_KEY` beda dengan yang dipakai membuat transaksi.

---

## 8. Coba alur lengkap

```bash
BASE=http://localhost:4000/api/v1

# Daftar + ambil token
TOKEN=$(curl -s -X POST $BASE/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Rani","email":"rani@example.com","password":"rahasia123"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.accessToken')

# Kirim kebutuhan dalam kalimat bebas
NEED=$(curl -s -X POST $BASE/needs -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"rawInput":"laptop buat kuliah desain, budget 12 juta, RAM minimal 8GB"}')
echo "$NEED"

NEED_ID=$(echo "$NEED" | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.need.id')

# Konfirmasi requirement, lalu jalankan matching + scoring + ranking
curl -s -X POST $BASE/needs/$NEED_ID/confirm -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"budget":12000000,"requirements":[{"key":"ram","value":"8GB","isHard":true}],"preferences":[]}'

curl -s -X POST $BASE/needs/$NEED_ID/process -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{}'

curl -s "$BASE/needs/$NEED_ID/recommendations" -H "Authorization: Bearer $TOKEN"
```

Untuk alur checkout dan pembayaran lengkap, lihat
[docs/api.md](docs/api.md) §5–§6.

Kartu uji sandbox: `4811 1111 1111 1114`, CVV `123`, expiry bebas di masa depan,
OTP `112233`. Simulator: <https://simulator.sandbox.midtrans.com/>

---

## 9. Test

```bash
npm test
```

Menjalankan unit test (`lib/` murni: scoring, ranking, parsing budget, aritmetika
plan, transisi status order, signature Midtrans) plus test kontrak yang gagal
kalau route dan `docs/swagger.yaml` tidak sinkron di kedua arah.

Test ini **tidak** butuh database.

---

## 10. Skrip npm

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server dev, reload otomatis |
| `npm run build` | Compile ke `dist/` (test tidak ikut) |
| `npm start` | Jalankan hasil build |
| `npm test` | Unit + contract test |
| `npm run prisma:migrate:dev` | Terapkan migration ke DB lokal |
| `npm run prisma:migrate:deploy` | Terapkan migration tanpa prompt (CI/produksi) |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:seed` | Isi data contoh |
| `npm run prisma:studio` | GUI database |

---

## 11. Kalau bermasalah

**`Konfigurasi environment tidak valid`** — pesan errornya menyebut variabel mana
yang salah. Ini validasi zod saat boot; server sengaja berhenti di sini alih-alih
gagal nanti saat request pertama.

**`P1000` / authentication failed** — role atau password di `DATABASE_URL` tidak
cocok. Ulangi langkah 2 dan uji dengan `psql`.

**`P1003` / database does not exist** — `needbuy_db` belum dibuat.

**`prisma migrate dev` gagal soal shadow database** — role `user` belum punya
`CREATEDB`:

```sql
ALTER ROLE "user" CREATEDB;
```

**`/ready` menjawab `degraded`** — server hidup, database tidak. Cek PostgreSQL
berjalan dan `DATABASE_URL` benar.

**Status pembayaran tidak berubah** — urutan pengecekan: ngrok jalan? URL
notifikasi di dashboard persis termasuk `/api/v1`? `MIDTRANS_SERVER_KEY` sama
dengan yang dipakai membuat transaksi? Log server akan mencatat
`midtrans webhook signature invalid` kalau signature-nya yang bermasalah.

**Swagger UI kosong di browser** — pastikan memuat `/docs` (bukan
`/docs/swagger.yaml`). Rute ini punya CSP tersendiri yang mengizinkan script
inline milik Swagger UI; sisa API tetap memakai CSP ketat.

**429 saat testing** — kena rate limit. `/auth/*` dibatasi 10 request per 15
menit per IP, dan login gagal 5 kali beruntun mengunci akun 15 menit. Tunggu,
atau naikkan `RATE_LIMIT_MAX` di `.env` (khusus limiter global).

---

## 12. Yang belum ada

- **Integration test** — `supertest` sudah terpasang, skenarionya sudah
  didaftar di spec, tapi test-nya belum ditulis. Butuh `needbuy_test` yang hidup.
- **Modul admin dan `audit_logs`** — belum ada operasi admin yang
  dispesifikasikan, jadi belum dibangun.
- **Perhitungan ongkir** — `shippingCost` divalidasi dan disimpan, belum dihitung
  dari kurir mana pun.
- **Rate limit terdistribusi** — masih di memori proses, benar untuk satu
  instance.

---

## 13. Deploy

Di-deploy ke **Railway**, dengan database **Supabase**. `Dockerfile` di repo ini
yang dipakai Railway untuk membangun image-nya — begitu Railway melihat
Dockerfile, builder Nixpacks-nya dilewati:

```
build : npm ci → prisma generate (postinstall) → npm run build (tsc)
start : npx prisma migrate deploy && node dist/server.js
```

Migrasi database ikut di `start`, jadi skema selalu menyusul kode yang baru
di-deploy tanpa langkah manual.

Supabase dipilih karena paket gratisnya tidak berbatas waktu — penting untuk
lomba yang penilaiannya bisa berlangsung setelah tenggat.

Supabase butuh **dua** URL. `DATABASE_URL` menunjuk Transaction pooler (port
6543) untuk query aplikasi, `DIRECT_URL` menunjuk Session pooler (port 5432)
khusus untuk `prisma migrate` — pooler mode transaction tidak mendukung
prepared statement dan advisory lock yang dibutuhkan migrasi. Pemisahan ini
sudah disiapkan di `prisma/schema.prisma` lewat `directUrl`.

**Railway memakai model kredit, bukan free tier permanen.** Akun baru dapat
kredit percobaan; begitu habis, service berhenti. Pantau sisa kredit di
dashboard, terutama kalau penilaian lomba berlangsung berminggu-minggu setelah
tenggat. Tidak seperti Render atau Koyeb, service-nya tidak tidur — jadi kredit
terpakai terus-menerus selama service hidup.

Dockerfile-nya sengaja tidak mengikat diri ke Railway. Kalau kredit habis dan
harus pindah host, berkas yang sama jalan di Koyeb, Render, Fly, atau VPS mana
pun tanpa diubah.

Penyimpanan berkas memakai **Supabase Storage**, lewat endpoint
S3-compatible-nya. Variabel `SUPABASE_*` bersifat opsional: kalau kosong,
berkas unggahan kembali disimpan di dalam Postgres dan dilayani lewat
`GET /uploads/:id`. Itu cukup untuk pengembangan lokal.

Di produksi sebaiknya diisi. Paket gratis Supabase memberi **500 MB database
tapi 1 GB storage**, jadi menaruh gambar di database menghabiskan kuota yang
salah lebih dulu. Kuotanya ikut project Supabase yang sama dengan database,
jadi tidak perlu mendaftarkan kartu di layanan mana pun.

URL gambar lama yang sudah terlanjur tersimpan di database tetap dilayani,
jadi mengaktifkan Storage tidak mematikan gambar yang sudah ada.

Langkah lengkap dari nol sampai online ada di repo `needbuy-submission`.

### Yang tidak boleh masuk GitHub

`.env`, Midtrans **server** key, `GOOGLE_CLIENT_SECRET`, App Password Gmail,
dan S3 access key Supabase. Semuanya diisi sebagai *variable* di dashboard
Railway.
Cek cepat sebelum push:

```bash
git ls-files | grep -i env    # hanya .env.example yang boleh muncul
```

Berkas `*.test.ts` sengaja tidak ikut ter-push (lihat `.gitignore`), tapi tetap
ada di laptop dan tetap bisa dijalankan dengan `npm test`.
