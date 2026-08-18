import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TREE = `
Rumah Tangga
  Dekorasi
    Cover Kipas Angin
    Cover Kursi
    Hiasan Dinding
    Hiasan Natal
    Jam Dinding
    Jam Meja
    Keset
    Lampu Pohon Natal
    Lilin
    Lilin Aroma Terapi
    Lukisan
    Patung
    Pohon Natal
    Reed Diffuser
    Slinger
    Stiker Kaca
    Tanaman Artifical
    Taplak Meja
    Tempat Lilin
    Vas Bunga
    Wall Sticker
  Furniture
    Bedside Table
    Cermin Badan
    Kasur
    Kursi
    Kursi Bar
    Kursi Goyang
    Kursi Kantor
    Kursi Makan
    Kursi Malas
    Lemari Pakaian
    Meja Bar
    Meja Kantor
    Meja Makan
    Meja Rias
    Meja TV
    Meja Tamu
    Pengaman Furniture
    Rak
    Rangka Tempat Tidur
    Sofa
    Sofa Bed
  Kamar Mandi
    Cermin Kamar Mandi
    Dispenser Odol
    Ember & Baskom
    Gantungan Handuk
    Gayung
    Handuk Mandi
    Keset Anti Slip
    Kimono Mandi
    Rak Toilet
    Shower Curtain
    Tempat Sabun
    Tempat Sikat Gigi
    Toilet Cover
    Toilet Seat Anak
    Tutup Wastafel
  Kamar Tidur
    Bantal Kepala
    Guling
    Jepitan Sprei
    Kelambu
    Mattress Cover
    Sarung Bantal
    Selimut
    Sprei & Bed Cover
  Kebersihan
    Alat Pel
    Asbak
    Ember & Baskom
    High Pressure Cleaner
    Kain Lap
    Kantong Sampah
    Kemoceng
    Lainnya
    Pengki
    Sapu
    Sapu Lidi
    Sarung Tangan Karet
    Selang Air
    Sikat
    Tempat Sampah
  Kebutuhan Rumah
    Baterai
    Baterai Jam
    Humidifier
    Payung
    Pembatas Ruangan
    Penahan Pintu
    Termometer Ruangan
  Laundry
    Alat Pelipat Baju
    Bola Pencuci Baju
    Cover Mesin Cuci
    Gantungan Baju
    Jaring Pakaian Mesin Cuci
    Jemuran Baju
    Jepit Jemuran
    Lainnya
    Laundry Bag
    Meja Setrika
    Papan Cuci Baju
    Roll Pembersih Pakaian
  Ruang Tamu & Keluarga
    Bantal Sofa
    Bean Bag
    Cover Sofa
    Gorden
    Karpet & Tikar
    Sarung Bantal Sofa
  Taman
    Air Sofa
    Ayunan
    Benih Bibit Tanaman
    Garpu Taman
    Hiasan Taman
    Irigasi
    Kursi Pantai
    Media Tanam
    Pemotong Rumput
    Penyiram Tanaman
    Pot Tanaman
    Pupuk
    Sekop Taman
  Tempat Penyimpanan
    Botol
    Brankas
    Keranjang
    Kotak
    Kotak Baterai
    Kotak Jam
    Kotak Karton
    Kotak Surat
    Laci
    Lainnya
    Stand Hanger
    Storage Box Multifungsi
    Tempat Obat
    Tempat Pakaian
    Tempat Perhiasan & Aksesoris
    Tempat Remote
    Tempat Sepatu & Sandal
    Tempat Tas
    Tempat Tissue
  Travel
    Bantal Leher
    Gembok Koper
    Koper
    Luggage Cover
    Luggage Strap
    Luggage Tag
    Passport Cover
    Penutup Mata Tidur
    Travel Bag
    Travel Organizer
    Travel Toiletries Kit
    Universal Travel Adaptor
Audio, Kamera & Elektronik Lainnya
  Aksesoris Kamera
    Baterai & Charger Kamera
    Case Kamera
    Cleaning Tools Kamera
    Dry Box Kamera
    Kabel Konektor Kamera
    Lainnya
    Microphone Kamera
    Monopod Kamera
    Remote Wireless Kamera
    Silica Gel Kamera
    Stabilizer Kamera
    Strap Kamera
    Tas Kamera
    Tripod Kamera
  Audio
    Amplifier
    Earphone
    Headphone
    Kabel & Konektor Audio
    Sound System
    Speaker
    TWS
    Voice Recorder
  Frame, Album & Roll Film
    Album Foto
    DVs
    Frame Digital
    Frame Foto
    Roll Film
  Kamera Analog
    Disposable Camera
    Kamera Film
  Kamera Digital
    Action Camera
    Kamera 360
    Kamera DSLR
    Kamera Mirrorless
    Kamera Pocket
  Kamera Instan
    Perangkat Kamera Instan
    Printer Foto Instan
    Refilll Kamera Instan
  Kamera Pengintai
    DVR
    Fake Camera
    IP Camera
    Kabel CCTV
    Kamera CCTV
  Lensa & Aksesoris
    Aksesoris Lensa
    Lensa Kamera
  Lighting & Studio
    Backdrop
    Flash Diffuser
    Flash Kamera
    Flash Trigger
    Hot Shoe Kamera
    Lampu luar ruangan
    Reflektor
    Ring Light
    Softbox
    Studio Lighting
  Media Player
    Blu Ray Player
    DVD Player
    MP3 & MP4 Player
    Radio & Tape Player
  Perangkat Elektronik Lainnya
    Lainnya
  Remote Control Drone
    Aksesoris Drone
    Drone Kamera
    Drone Remote Control
  Video
    Camcorder
Buku
  Buku Arsitektur & Desain
    Buku Bangunan
    Buku Codes & Standars
    Buku Dekorasi & Ornamen
    Buku Desain Dapur
    Buku Desain Kamar
    Buku Desain Ruang Keluarga
    Buku Desain Ruang Tamu
    Buku Desain Rumah
    Buku Interior & Eksterior
    Buku Metode & Material Bangunan
    Buku Taman
  Buku Ekonomi & Bisnis
    Buku Akuntansi
    Buku Bisnis
    Buku Ekonomi
    Buku Kesekretariatan
    Buku Manajemen
    Buku Pariwisata
    Buku Perbankan
    Buku Perhotelan
    Buku Perpajakan
    Buku Statistik
    Buku Usaha Kecil & Kewirausahaan
  Buku Hobi
    Buku Alam
    Buku Fotografi
    Buku Hewan Peliharaan
    Buku Hiburan
    Buku Humor
    Buku Keterampilan
    Buku Kuliner
    Buku Musik & Lagu
    Buku Olahraga
    Buku Otomotif
    Buku Permainan
    Buku Seni
    Buku Tanaman
    Buku Travel
  Buku Hukum
    Buku Gender & Hukum
    Buku Hukum Dagang
    Buku Hukum Internasional
    Buku Hukum Perdata
    Buku Hukum Pidana
    Buku Kemanusiaan
    Buku Politik & Hukum
    Kumpulan Peraturan Perundang-Undangan
    UUD 1945
  Buku Import
    Agriculture Book Import
    Art & Novel Import
    Child & Teenager Book Import
    Computer Book Import
    Economy Book Import
    Feminity Book Import
    Health Book Import
    Hobby & Interest Book Import
    Language Book Import
    Law Book Import
    Management & Business Book Import
    Medical Book Import
    Political Social Book Import
    Psychology & Education Book Import
    Reference & Dictionary Book Import
    Religion & Philosophy Book Import
    School Book Import
    Secretarial Book Import
    Self Development Book Import
    Technique Book Import
    Tourism & Map Book Import
  Buku Kedokteran
    Buku Farmasi
    Buku Kedokteran Spesialis
    Buku Kedokteran Umum
    Buku Psikiatri
    Kamus Istilah Kedokteran
  Buku Keluarga
    Buku Bimbingan Orang Tua
    Buku Nama-nama Bayi
    Buku Pendidikan Keluarga
  Buku Kesehatan & Gaya Hidup
    Buku Diet
    Buku Gizi & Nutrisi
    Buku Kesehatan Anak
    Buku Kesehatan Masyarakat
    Buku Kesehatan Pria
    Buku Latihan & Kebugaran
    Buku Pengobatan Alternatif
    Buku Sports & Adventure
  Buku Kewanitaan
    Buku Busana
    Buku Kecantikan
    Buku Kehamilan & Menyusui
  Buku Komputer & Internet
    Buku Database
    Buku Design Graphics
    Buku Hardware
    Buku Internet & Web
    Buku Media Sosial
    Buku Microsoft Office
    Buku Mobile & Gadget
    Buku Programming
    Buku Sistem Operasi
  Buku Masakan
    Buku Resep Kue
    Buku Resep Makanan Bayi & Balita
    Buku Resep Makanan Diet
    Buku Resep Masakan
    Buku Resep Minuman & Dessert
    Buku Resep Pastry
  Buku Pendidikan
    Buku Atlas
    Buku Bimbingan Belajar
    Buku SD Kelas 1
    Buku SD Kelas 2
    Buku SD Kelas 3
    Buku SD Kelas 4
    Buku SD Kelas 5
    Buku SD Kelas 6
    Buku SMA Kelas 1
    Buku SMA Kelas 2
    Buku SMA Kelas 3
    Buku SMP Kelas 1
    Buku SMP Kelas 2
    Buku SMP Kelas 3
    Buku Saku Pramuka
    Ensiklopedia
    Kumpulan Soal SD
    Kumpulan Soal SMA
    Kumpulan Soal SMP
  Buku Pengembangan Diri & Karir
    Buku Kesuksesan
    Buku Leadership Kepemimpinan
    Buku Self Improvement & Development
  Buku Persiapan Ujian
    Buku Persiapan TPA & Psikotest
    Buku Persiapan Tes CPNS
    Buku Persiapan Tes TOEFL & IELTS
  Buku Pertanian
    Buku Agribisnis
    Buku Bioteknologi Pertanian
    Buku Pengembangan Pertanian
    Buku Peternakan
    Buku Tanaman & Kebun
  Buku Religi & Spiritual
    Al-Quran
    Alkitab
    Buku Agama Buddha
    Buku Agama Hindu
    Buku Agama Islam
    Buku Agama Katolik
    Buku Agama Khong Hu Chu
    Buku Agama Kristen
    Buku Filosofi
    Buku Filsafat
    Buku Kepercayaan
    Buku Spiritual
  Buku Remaja dan Anak
    Buku Aktivitas
    Buku Cerita Anak
    Buku Dongeng
    Buku Dunia Pengetahuan
    Buku Fabel
    Buku Islami Anak
    Buku Keterampilan Anak
    Buku Mewarnai
  Buku Sosial Politik
    Buku Autobiografi
    Buku Biografi
    Buku Ilmu Media Komunikasi
    Buku Jurnalisme
    Buku Komunikasi
    Buku Lingkungan Hidup
    Buku Politik
    Buku Sejarah
    Buku Sosial Budaya
  Buku Teknik & Sains
    Buku Astronomi & Luar Angkasa
    Buku Biologi
    Buku Elektro
    Buku Engineering
    Buku Fisika
    Buku Geografi
    Buku Geologi
    Buku Ilmiah
    Buku Kimia
    Buku Robotika
    Buku Sipil
  Kamus & Bahasa Asing
    Bahasa Arab
    Bahasa Indonesia
    Bahasa Inggris
    Bahasa Jawa
    Bahasa Jepang
    Bahasa Jerman
    Bahasa Korea
    Bahasa Mandarin
    Bahasa Perancis
    Basa Sunda
    Kamus Bahasa Lainnya
  Komik
    Komik Anak
    Komik Asing
    Komik Dewasa
    Komik Islami
    Komik Langka
    Komik Manga
  Majalah
    Buku Katalog
    Koran
    Majalah Anak
    Majalah Desain
    Majalah Design Interior
    Majalah Fashion
    Majalah Musik
    Majalah Olahraga
    Majalah Otomotif
    Majalah Politik, Ekonomi, dan Bisnis
  Novel & Sastra
    Buku Fantasi
    Buku Kisah Nyata
    Buku Misteri
    Buku Roman
    Fiksi Puisi
    Kritik Sastra
    Literatur Fiksi
    Naskah
    Novel Indonesia
    Novel Remaja
    Novel Terjemahan
    Puisi
Dapur
  Aksesoris Dapur
    Alat Pemotong Serbaguna
    Capit Makanan
    Celemek
    Chopper
    Grinder
    Gunting Dapur
    Korek Kompor
    Magnet Kulkas
    Parutan
    Peeler
    Pelindung Tangan
    Pengasah Pisau
    Pisau Dapur
    Pisau Set
    Talenan
    Tatakan Gas
    Termometer Makanan & Minuman
    Timer Masak
    Tisu & kertas toilet
  Alat Masak Khusus
    Chocolate Melter
    Coffee & Tea Maker
    Cotton Candy Maker
    Donut Maker
    Ice Cream & Yogurt Maker
    Mesin Es Serut
    Mesin Sostel
    Noodle & Pasta Maker
    Pancake Maker
    Popcorn Maker
    Sushi Maker & Roller
    Waffle Maker
  Bekal
    Botol Minum
    Cetakan Bento
    Cup Bento
    Kotak Makan
    Lunch Box Set
    Partisi Bento
    Rantang
    Tas Bekal
    Tas Botol
    Termos Air
    Termos vakum
    Tusuk Bento
  Kemasan Makanan dan Minuman
    Aluminium Tray & Cup
    Bagasse
    Bento Box
    Box Kardus Makanan
    Box Mika
    Food Pail
    Food Paper Bag
    Kemasan Minuman
    Paper Box
    Paper Rice Bowl
    Thinwall
  Penyimpanan Makanan
    Aluminium Foil
    Box Telur
    Cooler Box
    Food Display
    Food Warmer
    Ice - Rice Bucket
    Plastic Wrap
    Plastik Klip
    Sealer Makanan
    Tempat Buah & Sayur
    Tempat Bumbu
    Tempat Roti
    Tempat Saos & Kecap
    Toples Makanan
  Peralatan Baking
    Alat Penghias Kue
    Cetakan Kue
    Kertas Baking
    Kocokan Telur
    Kuas Kue
    Loyang Kue
    Pisau Kue
    Tatakan Kue
  Peralatan Dapur
    Alat Pembuka Botol
    Alat Pembuka Kaleng
    Dispenser Air
    Pompa Galon
    Rak Dapur
    Rak Piring & Gelas
    Regulator & Penghemat Gas
    Sarung Galon
    Sarung Kulkas
    Timbangan Dapur
    Water Purifier
  Peralatan Makan & Minum
    Cangkir
    Centong Nasi
    Gelas & Mug
    Gelas Wine
    Mangkok Makan
    Nampan
    Peralatan Makan Set
    Peralatan Minum Set
    Piring & Mangkok Saji
    Piring Makan
    Pitcher Minuman
    Sedotan
    Sendok & Garpu Dessert
    Sendok & Garpu Makan
    Sendok Bebek
    Sendok Sayur & Kuah
    Sumpit
    Sumpit Makan
    Tatakan Gelas & Piring
    Tempat Sendok & Garpu
    Tudung Saji
    Tutup Gelas & Piring
  Peralatan Masak
    Cetakan Es, Puding, Coklat
    Cobek
    Deep Fryer
    Gelas Takar
    Gilingan Daging
    Griller
    Kompor
    Oven Gas
    Panci
    Presto
    Saringan Masak
    Sendok Takar
    Spatula & Sutil
    Steamer
    Teko & Pemanas Air
    Wajan
  Perlengkapan Cuci Piring
    Dish Dryer
    Sabut
    Saringan Bak Cuci Piring
    Sikat Cuci Botol
    Sponge Cuci Piring
Otomotif
  Aksesoris Motor
    Aksesori Body Motor
    Alarm & Gembok Motor
    Box Motor
    Cover Motor
    Cover Stang Motor
    Emblem Motor
    Footstep Motor
    Handle - Handfat Motor
    Jok motor
    Karpet Motor
    Kursi Bonceng Anak
    Spakbor Motor
    Spion Motor
    Windshield Motor
  Aksesoris Pengendara Motor
    Cover Sepatu
    Goggle Motor
    Jaket Motor
    Jas Hujan
    Masker Buff
    Rain Cover Bag
    Rompi Motor
    Sarung Tangan Motor
    Sepatu Biker
  Alat Berat
    Sparepart & Service
    Unit
  Audio & Video Mobil
    Head Unit Mobil
    Kabel & Konektor Audio Mobil
    Power Amplifier
    Sensor & Kamera Mobil
    Speaker Mobil
    Video TV Mobil
  Ban Mobil
  Ban Motor
  Eksterior Mobil
    Bumper Guard Mobil
    Cover Ban Mobil
    Cover Mobil
    Dudukan Plat Nomor
    Emblem Mobil
    Kaca Film Mobil
    Spion Mobil
    Sticker Anti Fog
    Talang Air Mobil
  Helm Motor
    Aksesoris Helm
    Cover Helm
    Helm Anak
    Helm Full Face
    Helm Half Face
    Helm Retro
    Kaca Helm
    Kunci Helm
    Parfum Helm
    Tas & Jaring Helm
  Interior Mobil
    Bantal Mobil
    Car Seat Organizer
    Cover Dashboard Mobil
    Cup Holder Mobil
    Karpet Mobil
    Kasur Mobil
    Kunci Pengaman Mobil
    Parfum Mobil
    Pelindung Panas Mobil
    Sarung Stir Mobil
    Seat Cushion Mobil
    Sill Plate Mobil
    Tempat Sampah Mobil
    Tempat Tisu Mobil
    Tongkat E-Toll
    Tuas Persneling Mobil
  Mobil
    Booking Fee Mobil Baru
    Mobil Hatchback & City Car Baru
    Mobil Listrik Baru
    Mobil Niaga Baru
    Mobil SUV & MPV Baru
    Mobil Sedan Baru
  Mobil Bekas
    Mobil Hatchback & City Car Bekas
    Mobil Listrik Bekas
    Mobil Niaga Bekas
    Mobil SUV & MPV Bekas
    Mobil Sedan Bekas
  Oli & Penghemat BBM
    Engine Conditioner
    Filter Oli
    Fuel Additive
    Oli mobil
    Oli motor
    Penghemat BBM
    Tempat Oli
  Perawatan Kendaraan
    Anti Ban Bocor
    Anti Gores Kendaraan
    Busa Poles Kendaraan
    Cairan Radiator
    Lap Chamois
    Obat Jamur Mobil
    Pelumas Kendaraan
    Semir Ban
    Vacuum Cleaner Mobil
    Wash and Wax
  Perkakas Kendaraan
    Charger Aki Mobil
    Dongkrak Mobil
    Tali Derek Mobil
  Sepeda Motor
    Booking Fee Motor Baru
    Motor Bebek Baru
    Motor Listrik Baru
    Motor Matic Baru
    Motor Sport Baru
    Sepeda Listrik Baru
  Sepeda Motor Bekas
    Motor Bebek Bekas
    Motor Listrik Bekas
    Motor Matic Bekas
    Motor Sport Bekas
  Spare Part Mobil
    Bearing Mobil
    Belt Mobil
    Busi Mobil
    ECU & Kelistrikan Mobil
    Engine Mounting & Karet Mobil
    Filter Udara Mobil
    Gearbox
    Kampas Rem Mobil
    Klakson Mobil
    Knalpot Mobil
    Koil & CDI Mobil
    Kopling & Transmisi Mobil
    Lampu Mobil
    Master & Kaliper Rem Mobil
    Piston Mobil
    Radiator & Komponen Mobil
    Selang Rem Mobil
    Shockbreaker & Kaki Kaki Mobil
    Stir Mobil
    Tromol & Piringan Rem Mobil
    Wiper & Wiper Cover Mobil
`;

export type ParsedCategory = { name: string; depth: number };

/** Satu baris = satu kategori; dua spasi indentasi = satu level lebih dalam. */
export function parseTree(text: string): ParsedCategory[] {
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const indent = line.length - line.trimStart().length;
      if (indent % 2 !== 0) throw new Error(`Indentasi ganjil: "${line}"`);
      return { name: line.trim(), depth: indent / 2 };
    });
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/&/g, " dan ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 160) || "kategori"
  );
}

/**
 * Slug harus unik lintas seluruh pohon, tapi nama seperti "Lainnya" dan
 * "Ember & Baskom" muncul di beberapa grup. Yang kedua dan seterusnya diberi
 * awalan slug induknya, jadi tetap terbaca, bukan "lainnya-2".
 */
export function uniqueSlug(name: string, parentSlug: string | null, taken: Set<string>): string {
  const base = slugify(name);
  const candidates = [base, parentSlug ? `${parentSlug}-${base}` : null].filter(
    (s): s is string => s !== null
  );
  for (const candidate of candidates) {
    if (!taken.has(candidate)) return candidate;
  }
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

async function main() {
  const rows = parseTree(TREE);
  const taken = new Set<string>();
  // Slug induk per kedalaman, dipakai untuk menyambung anak ke parent-nya.
  const parentAt = new Map<number, { id: string; slug: string }>();
  let created = 0;

  for (const row of rows) {
    const parent = row.depth === 0 ? null : parentAt.get(row.depth - 1) ?? null;
    if (row.depth > 0 && !parent) throw new Error(`Kategori tanpa induk: "${row.name}"`);

    const slug = uniqueSlug(row.name, parent?.slug ?? null, taken);
    taken.add(slug);

    const category = await prisma.category.upsert({
      where: { slug },
      update: { name: row.name, parentId: parent?.id ?? null },
      create: { name: row.name, slug, parentId: parent?.id ?? null },
    });

    parentAt.set(row.depth, { id: category.id, slug });
    created += 1;
  }

  const roots = rows.filter((r) => r.depth === 0).length;
  const leaves = rows.filter((r) => r.depth === 2).length;
  console.log(`Kategori tersimpan: ${created} (${roots} induk, ${leaves} daun)`);
}

// Hanya jalan kalau file ini dieksekusi langsung, import dari test tidak
// menyentuh database.
if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
