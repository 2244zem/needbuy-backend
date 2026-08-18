# NeedBuy — AI Rule-Based, Konsolidasi ke Node, dan Lapisan DTO

Tanggal: 2026-08-11
Status: disetujui, siap masuk implementation plan

## Masalah

Tiga keluhan yang saling terkait:

1. **AI-nya tidak merespon.** `ai-service/` menghasilkan satu tembakan interpretasi
   lalu berhenti. `clarification_questions` dibuat, dikirim ke client, dan tidak
   ada apa pun yang menampung jawabannya — jadi user tidak pernah bisa menjawab.
2. **Tidak nyambung dengan backend lain.** `aiBridge.service.ts` memanggil service
   Python lewat HTTP dan menelan **setiap** kegagalan menjadi data palsu
   (`goal: raw_input.slice(0,50)`, `confidence: 0.2`). Saat service Python mati,
   API tetap membalas 200 berisi sampah. Kegagalan jadi tidak terlihat.
3. **Tipe-tipenya semrawut.** Ada tiga sumber tipe yang tidak saling kenal: zod
   schema, 17 file `*.interface.ts` (1.231 baris, **nol** yang meng-import), dan
   tipe Prisma yang bocor sampai ke JSON response (`Prisma.Decimal` muncul di
   `CartResponse`).

## Keputusan yang sudah dikunci

| Pertanyaan | Keputusan |
|---|---|
| Mesin AI | **Tetap rule-based**, tanpa LLM, tanpa API key, tanpa biaya per request |
| Arti "merespon" | Dialog klarifikasi bertahap · ekstraksi lebih luas · endpoint tanya-jawab produk |
| Sumber kebenaran tipe | **Zod tunggal**, input dan output, tipe lahir dari `z.infer` |
| State dialog | **Tabel baru** `need_clarifications` |
| Service Python | **Dihapus**, semua aturan pindah ke Node |

Batas yang diterima sadar: tanpa LLM, sistem tidak akan pernah bisa menjawab
pertanyaan bebas yang tidak punya aturan. "Merespon sesuai yang ditanya"
dibatasi pada tiga hal di baris "Arti merespon" di atas. Penjelasan rekomendasi
per produk **tidak** masuk lingkup ini.

## Fase 0 — Perbaikan drift database (SELESAI 2026-08-11)

Ditemukan saat mengerjakan spec ini, bukan bagian dari desain aslinya.

Gejala: `DELETE /api/v1/products/:id` → 500, `P2022 products.sku does not exist`.

Akar masalah: database dibangun dengan `prisma db push`, bukan `prisma migrate`.
Tabel `_prisma_migrations` tidak pernah ada, sehingga keempat file migration di
repo berstatus belum teraplikasi padahal 23 tabelnya sudah berdiri. `db push`
terakhir dijalankan sebelum `sku` masuk ke `schema.prisma`, jadi kolomnya
tertinggal.

Drift sebenarnya lebih luas dari yang dilaporkan: selain `products.sku`, tabel
`admin_configs` dan `admin_profiles` juga belum pernah dibuat — modul admin akan
gagal dengan error serupa begitu dipakai.

Ranjau yang dihindari: `20260810151551_mig` baris 18 berisi
`ADD COLUMN "username" TEXT NOT NULL` tanpa default. Dijalankan di tabel `users`
berisi 8 baris, itu pasti gagal. Karena kolomnya sudah ada di database, migration
tersebut ditandai `applied` **tanpa dieksekusi**.

Yang dikerjakan:

1. `prisma migrate resolve --applied` untuk keempat migration lama — membuat
   riwayat migration tanpa menjalankan satu pun SQL.
2. Migration baru `20260811000000_sku_and_admin_tables`, seluruhnya aditif:
   `products.sku` (nullable, UNIQUE — Postgres mengizinkan banyak NULL, jadi 12
   produk lama tetap lolos), `admin_configs`, `admin_profiles`.
3. `prisma migrate deploy`.

Terverifikasi: `product.findFirst({select:{sku}})` berhasil, `adminConfig` dan
`adminProfile` terbaca, 8 users dan 12 products utuh.

Sisa: `npx prisma generate` gagal `EPERM` karena dev server memegang file engine.
Hentikan dev server lalu jalankan sekali.

Aturan yang berlaku setelah ini: **`prisma db push` tidak dipakai lagi di repo
ini.** Setiap perubahan schema lewat migration, supaya drift senyap seperti ini
tidak terulang.

## Arsitektur

`ai-service/` dihapus seluruhnya. Aturannya pindah ke tempat yang sudah
ditentukan CLAUDE.md §2 — logic murni di `src/lib/` (tanpa I/O, tanpa Prisma,
tanpa env), orkestrasi di `src/modules/`.

| Dari (Python) | Ke (TypeScript) |
|---|---|
| `lib/keyword_extractor.py` | `src/lib/needParsing.ts` (sudah ada, diperluas) |
| `lib/absurd_detector.py` + `lib/spec_base.py` | `src/lib/needSanity.ts` (sudah ada, diperluas) |
| `lib/text_quality.py` | `src/lib/textQuality.ts` (baru) |
| `lib/tokenizer.py` | lebur ke `needParsing.ts` |
| `services/matcher.py` (TF-IDF, scikit-learn) | `src/lib/similarNeeds.ts` — Jaccard token |
| `services/*.py` sisanya | `src/modules/ai/ai.service.ts` |

Ikut hilang: `aiBridge.service.ts`, dan tiga direktori yang masing-masing hanya
berisi satu file AI — `src/controllers/`, `src/routes/`, `src/services/`. AI jadi
modul biasa di `src/modules/ai/`, sejajar dengan 17 modul lain.

Dependency yang dibuang: `fastapi`, `uvicorn`, `scikit-learn`, `numpy`, `httpx`,
`pydantic`, `pydantic-settings`, `python-dotenv`.

Dua duplikasi lintas bahasa yang selesai dengan sendirinya: `needSanity.ts` yang
mencerminkan `spec_base.py`, dan `parseBudget.ts` yang mencerminkan
`extract_budget`. Setelah ini masing-masing hanya punya satu salinan.

Konsekuensi yang dianggap fitur: tidak ada lagi hop jaringan yang bisa mati
diam-diam, jadi tidak ada lagi yang perlu di-fallback.

### Penggantian TF-IDF

`matcher.py` memakai `TfidfVectorizer` + `cosine_similarity` untuk mencari need
yang mirip. Penggantinya Jaccard atas himpunan token:

```ts
export function similarity(a: Set<string>, b: Set<string>): number {
  const inter = [...a].filter((t) => b.has(t)).length;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}
```

Ini menurunkan kualitas untuk korpus besar — TF-IDF membobot kata langka, Jaccard
tidak. Diterima karena `similar-needs` adalah fitur pinggiran dan tabel `needs`
saat ini kosong. Ditandai `ponytail:` di source dengan jalur upgrade-nya.

## Dialog klarifikasi bertahap

### Tabel baru

Persetujuan eksplisit user sudah diberikan (CLAUDE.md §9 poin 2).

```sql
CREATE TABLE need_clarifications (
  id           UUID PRIMARY KEY,
  need_id      UUID NOT NULL REFERENCES needs(id) ON DELETE CASCADE,
  ordinal      INT  NOT NULL,
  field        VARCHAR(32) NOT NULL,   -- budget | goal | category | requirement
  question     TEXT NOT NULL,
  context      TEXT,
  answer       TEXT,
  answered_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (need_id, ordinal)
);
```

### Alur

Memakai lifecycle `DRAFT → PROCESSING → COMPLETED` yang sudah dikunci CLAUDE.md
§3. Tidak ada status baru.

1. `POST /needs` → interpreter jalan → need berstatus `DRAFT`, pertanyaan yang
   belum terjawab ditulis ke `need_clarifications`. Response mengembalikan
   pertanyaan **pertama saja**, bukan semuanya sekaligus.
2. `POST /needs/:id/clarify` → jawaban disimpan → interpreter dijalankan **ulang**
   atas `raw_input` digabung seluruh jawaban yang sudah terkumpul → balikkan
   pertanyaan berikutnya, atau kalau habis, status jadi `PROCESSING` dan matching
   engine jalan.
3. Batas 5 giliran. Lewat itu need diproses apa adanya — dialog tanpa ujung lebih
   buruk daripada rekomendasi yang kurang tajam.

Prinsip yang dijaga: jawaban **tidak** ditempel mentah ke `need_requirements`.
Jawaban masuk balik ke interpreter dan hasilnya baru jadi requirement. Satu jalur
ekstraksi, bukan dua.

Setiap giliran dibungkus satu `prisma.$transaction` (CLAUDE.md §7): simpan
jawaban, hapus requirement lama, tulis requirement baru, perbarui status.

## Lapisan DTO

Satu sumber kebenaran: zod. Per modul, `schema.ts` memegang skema request **dan**
response.

```ts
// src/lib/dtoPrimitives.ts — satu-satunya tempat Decimal/Date jadi JSON
export const money = z
  .union([z.instanceof(Prisma.Decimal), z.number(), z.string()])
  .transform((v) => v.toString());

export const isoDate = z.date().transform((d) => d.toISOString());
```

Controller tidak pernah lagi mengirim objek Prisma langsung:

```ts
res.json(ok(CartResponse.parse(await cartService.get(userId))));
```

`.parse()` di jalur response bukan sekadar tipe — dia **memotong** field yang
tidak dideklarasikan. Itu yang menutup kebocoran `passwordHash`, `Prisma.Decimal`,
dan relasi yang terbawa `include`. Biayanya beberapa mikrodetik di sebelah query
database bermilidetik, jadi aktif juga di production, bukan cuma di dev.

Ke-17 `*.interface.ts` dihapus. Tipe lahir dari `z.infer`, jadi tidak ada dua file
yang harus dijaga sinkron manual.

Kegagalan `.parse()` di response berarti bug server, bukan kesalahan user:
dicatat lengkap ke log, dibalas 500 generik tanpa detail internal.

## Endpoint tanya-jawab produk

`POST /api/v1/ai/product-qa` — body `{ productId, question }`.

Pertanyaan dicocokkan ke `attr_key` lewat `ATTRIBUTE_KEYWORDS` yang sudah ada di
`needParsing.ts`, lalu dijawab dari `product_attributes`. Di luar itu balas
`answerable: false` dengan daftar atribut yang tersedia — jujur soal batasnya,
bukan mengarang.

## Error handling

`AppError.unprocessable(422)` untuk input absurd/gibberish, membawa `fields` dan
pertanyaan klarifikasi. Bukan lagi 200 berisi `goal: null` dan `confidence: 0.2`
yang menyamar sebagai sukses.

Tidak ada satu pun blok `catch` yang mengembalikan data palsu.

## Testing

Tes Python (`test_absurd_detector.py`, `test_spec_base.py`, `test_services.py`)
diport ke `node:test` — pola `*.test.ts` + `tsx --test` yang sudah dipakai repo
ini. Cakupan tidak boleh ikut hilang bersama service-nya.

Tambahan: satu tes integrasi untuk loop klarifikasi tiga giliran, dan satu tes
yang memastikan response schema memotong field yang tidak dideklarasikan.

## Urutan implementasi

| Fase | Isi | Status |
|---|---|---|
| 0 | Perbaikan drift database | **selesai** |
| 1 | Port aturan Python ke TS + port tesnya, belum menghapus apa pun | |
| 2 | Hapus `ai-service/`, `aiBridge`, tiga direktori satu-file | |
| 3 | Migration `need_clarifications` + endpoint clarify | |
| 4 | Sapu bersih DTO: zod response, hapus `*.interface.ts` | |
| 5 | Endpoint tanya-jawab produk | |

Fase 1 sengaja mendahului fase 2: aturan baru harus terbukti hijau di TS sebelum
versi Python-nya hilang, supaya tidak ada jendela waktu tanpa jaring pengaman.

## Di luar lingkup

- **`BACKEND/BACKEND/`** — salinan basi ~14.4k baris, hasil audit 2026-08-11.
  Harus dihapus **sebelum** fase 1, kalau tidak setiap perubahan punya kembaran
  yang membingungkan. Pekerjaan hapus-saja, bukan bagian desain ini.
- **File yatim** `controller.ts`/`routes.ts`/`service.ts`/`schema.ts` di modul
  `auth`, `products`, `users` — 1.261 baris sisa rename, nol yang meng-import.
  Dihapus bersamaan dengan fase 4.
- **`circuitBreaker.ts`, `cache.ts`, `featureFlags.ts`** — 331 baris, nol pemanggil.
  Dihapus bersamaan dengan fase 2.
- **`.env` berisi kredensial asli** dan ada di dua lokasi. Temuan keamanan,
  ditangani terpisah dari spec ini.
