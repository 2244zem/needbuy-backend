import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type CategorySeed = { name: string; slug: string; children: { name: string; slug: string }[] };

const CATEGORY_TREE: CategorySeed[] = [
  {
    name: "Elektronik",
    slug: "elektronik",
    children: [
      { name: "Laptop", slug: "laptop" },
      { name: "Smartphone", slug: "smartphone" },
      { name: "Tablet", slug: "tablet" },
      { name: "Monitor", slug: "monitor" },
      { name: "Keyboard", slug: "keyboard" },
      { name: "Mouse", slug: "mouse" },
      { name: "Headphone", slug: "headphone" },
      { name: "Speaker", slug: "speaker" },
      { name: "Printer", slug: "printer" },
      { name: "Kamera", slug: "kamera" },
      { name: "Konsol Game", slug: "konsol-game" },
      { name: "Smartwatch", slug: "smartwatch" },
    ],
  },
  {
    name: "Elektronik Rumah Tangga",
    slug: "elektronik-rumah-tangga",
    children: [
      { name: "TV", slug: "tv" },
      { name: "Kulkas", slug: "kulkas" },
      { name: "Mesin Cuci", slug: "mesin-cuci" },
      { name: "AC", slug: "ac" },
      { name: "Rice Cooker", slug: "rice-cooker" },
    ],
  },
  {
    name: "Perabot Rumah",
    slug: "perabot-rumah",
    children: [
      { name: "Meja", slug: "meja" },
      { name: "Kursi", slug: "kursi" },
      { name: "Kasur", slug: "kasur" },
      { name: "Lemari", slug: "lemari" },
    ],
  },
  {
    name: "Dapur",
    slug: "dapur",
    children: [
      { name: "Mesin Kopi", slug: "mesin-kopi" },
      { name: "Peralatan Masak", slug: "peralatan-masak" },
    ],
  },
  {
    name: "Fashion",
    slug: "fashion",
    children: [
      { name: "Atasan", slug: "atasan" },
      { name: "Jaket", slug: "jaket" },
      { name: "Sepatu", slug: "sepatu" },
      { name: "Tas", slug: "tas" },
    ],
  },
  {
    name: "Olahraga",
    slug: "olahraga",
    children: [
      { name: "Sepeda", slug: "sepeda" },
      { name: "Alat Fitness", slug: "alat-fitness" },
    ],
  },
  {
    name: "Perkakas",
    slug: "perkakas",
    children: [
      { name: "Bor", slug: "bor" },
      { name: "Alat Kebersihan", slug: "alat-kebersihan" },
    ],
  },
];

const SELLERS = [
  { key: "tech", email: "techseller@needbuy.test", username: "techseller", name: "Tech Hub Official", store: "Tech Hub Store", rating: 4.8 },
  { key: "home", email: "homeseller@needbuy.test", username: "homeseller", name: "Living & Habitat Co.", store: "Living & Habitat Store", rating: 4.9 },
  { key: "gadget", email: "gadgetseller@needbuy.test", username: "gadgetseller", name: "Gadget Corner", store: "Gadget Corner", rating: 4.5 },
  { key: "fashion", email: "fashionseller@needbuy.test", username: "fashionseller", name: "Urban Wear", store: "Urban Wear Official", rating: 4.6 },
  { key: "sport", email: "sportseller@needbuy.test", username: "sportseller", name: "Gerak Sport", store: "Gerak Sport", rating: 4.4 },
  { key: "tools", email: "toolsseller@needbuy.test", username: "toolsseller", name: "Bengkel Jaya", store: "Bengkel Jaya Perkakas", rating: 4.2 },
];

type ProductSeed = {
  name: string;
  slug: string;
  price: number;
  stock: number;
  category: string;
  seller: string;
  rating?: number;
  soldCount?: number;
  description: string;
  attributes: Record<string, string>;
};

const IMG = (id: string) => `https://images.unsplash.com/${id}?w=800`;

const IMAGES: Record<string, string> = {
  laptop: IMG("photo-1517336714731-489689fd1ca8"),
  smartphone: IMG("photo-1511707171634-5f897ff02aa9"),
  tablet: IMG("photo-1544244015-0df4b3ffc6b0"),
  monitor: IMG("photo-1527443224154-c4a3942d3acf"),
  keyboard: IMG("photo-1587829741301-dc798b83add3"),
  mouse: IMG("photo-1527864550417-7fd91fc51a46"),
  headphone: IMG("photo-1505740420928-5e560c06d30e"),
  speaker: IMG("photo-1608043152269-423dbba4e7e1"),
  printer: IMG("photo-1612815154858-60aa4c59eaa6"),
  kamera: IMG("photo-1502920917128-1aa500764cbd"),
  konsol: IMG("photo-1486401899868-0e435ed85128"),
  jam: IMG("photo-1523275335684-37898b6baf30"),
  tv: IMG("photo-1593359677879-a4bb92f829d1"),
  kulkas: IMG("photo-1571175443880-49e1d25b2bc5"),
  cuci: IMG("photo-1626806787461-102c1bfaaea1"),
  ac: IMG("photo-1631545806609-0c1b1b1b1b1b"),
  dapur: IMG("photo-1570968915860-54d5c301fa9f"),
  meja: IMG("photo-1518455027359-f3f8164ba6bd"),
  kursi: IMG("photo-1580481072645-022f9a6d83d0"),
  kasur: IMG("photo-1505693416388-ac5ce068fe85"),
  lemari: IMG("photo-1595428774223-ef52624120d2"),
  fashion: IMG("photo-1556905055-8f358a7a47b2"),
  sepatu: IMG("photo-1542291026-7eec264c27ff"),
  tas: IMG("photo-1553062407-98eeb64c6a62"),
  sepeda: IMG("photo-1485965120184-e220f721d03e"),
  fitness: IMG("photo-1517836357463-d25dfeac3438"),
  bor: IMG("photo-1504148455328-c376907d081c"),
  bersih: IMG("photo-1621905251189-08b45d6a269e"),
};

const PRODUCTS: ProductSeed[] = [
  //Laptop
  { name: "Asus Vivobook 14 A1404VA", slug: "asus-vivobook-14-a1404va", price: 8499000, stock: 25, category: "laptop", seller: "tech", rating: 4.5, soldCount: 120,
    description: "Laptop ringan untuk kuliah dan kerja harian. Layar 14 inch, bodi tipis, baterai tahan seharian.",
    attributes: { ram: "8 GB", storage: "512 GB", prosesor: "Intel Core i5-1335U", layar: "14 inch", berat: "1.4 kg", garansi: "24 bulan" } },
  { name: "Lenovo IdeaPad Slim 3", slug: "lenovo-ideapad-slim-3", price: 6299000, stock: 30, category: "laptop", seller: "tech", rating: 4.3, soldCount: 210,
    description: "Pilihan hemat untuk tugas kuliah dan browsing. Sudah SSD, booting cepat.",
    attributes: { ram: "8 GB", storage: "256 GB", prosesor: "AMD Ryzen 5 7520U", layar: "15.6 inch", berat: "1.6 kg", garansi: "12 bulan" } },
  { name: "MacBook Air M2 13", slug: "macbook-air-m2-13", price: 17999000, stock: 12, category: "laptop", seller: "gadget", rating: 4.9, soldCount: 88,
    description: "Laptop tipis senyap tanpa kipas, cocok untuk desain dan editing ringan. Baterai sangat awet.",
    attributes: { ram: "16 GB", storage: "512 GB", prosesor: "Apple M2", layar: "13.6 inch", berat: "1.24 kg", garansi: "12 bulan" } },
  { name: "Acer Nitro V 15 RTX 4050", slug: "acer-nitro-v-15-rtx-4050", price: 14499000, stock: 15, category: "laptop", seller: "tech", rating: 4.6, soldCount: 64,
    description: "Laptop gaming dengan pendinginan ganda. Kencang untuk game berat dan rendering.",
    attributes: { ram: "16 GB", storage: "1 TB", prosesor: "Intel Core i5-13420H", gpu: "RTX 4050", layar: "15.6 inch", refresh_rate: "144 Hz", berat: "2.1 kg", garansi: "24 bulan" } },
  { name: "HP Pavilion Plus 14", slug: "hp-pavilion-plus-14", price: 11999000, stock: 18, category: "laptop", seller: "gadget", rating: 4.4, soldCount: 45,
    description: "Layar OLED tajam untuk kerja kreatif. Bodi aluminium, keyboard nyaman untuk mengetik lama.",
    attributes: { ram: "16 GB", storage: "512 GB", prosesor: "Intel Core i5-13500H", layar: "14 inch", berat: "1.4 kg", garansi: "12 bulan" } },

  // Smartphone
  { name: "Samsung Galaxy A55 5G", slug: "samsung-galaxy-a55-5g", price: 5999000, stock: 40, category: "smartphone", seller: "gadget", rating: 4.6, soldCount: 340,
    description: "Kamera jernih siang malam, layar Super AMOLED, bodi tahan air dan debu.",
    attributes: { ram: "8 GB", storage: "256 GB", prosesor: "Exynos 1480", layar: "6.6 inch", baterai: "5000 mAh", kamera: "50 MP", refresh_rate: "120 Hz", garansi: "12 bulan" } },
  { name: "Xiaomi Redmi Note 13 Pro", slug: "xiaomi-redmi-note-13-pro", price: 3499000, stock: 55, category: "smartphone", seller: "gadget", rating: 4.4, soldCount: 520,
    description: "Kamera 200MP dengan harga terjangkau. Pengisian cepat, layar mulus untuk scrolling.",
    attributes: { ram: "8 GB", storage: "256 GB", prosesor: "Snapdragon 7s Gen 2", layar: "6.67 inch", baterai: "5100 mAh", kamera: "200 MP", refresh_rate: "120 Hz", garansi: "12 bulan" } },
  { name: "iPhone 15 128GB", slug: "iphone-15-128gb", price: 13999000, stock: 20, category: "smartphone", seller: "gadget", rating: 4.8, soldCount: 150,
    description: "Kamera 48MP dengan hasil konsisten, performa lancar bertahun-tahun, port USB-C.",
    attributes: { ram: "6 GB", storage: "128 GB", prosesor: "Apple A16 Bionic", layar: "6.1 inch", baterai: "3349 mAh", kamera: "48 MP", garansi: "12 bulan" } },
  { name: "Infinix Hot 40i", slug: "infinix-hot-40i", price: 1499000, stock: 70, category: "smartphone", seller: "gadget", rating: 4.0, soldCount: 610,
    description: "HP murah untuk kebutuhan harian: chat, sosial media, dan streaming.",
    attributes: { ram: "8 GB", storage: "128 GB", prosesor: "Unisoc T606", layar: "6.56 inch", baterai: "5000 mAh", kamera: "50 MP", garansi: "12 bulan" } },
  { name: "Oppo Reno 11F 5G", slug: "oppo-reno-11f-5g", price: 4999000, stock: 35, category: "smartphone", seller: "gadget", rating: 4.5, soldCount: 190,
    description: "Desain tipis, kamera potret tajam, pengisian daya sangat cepat.",
    attributes: { ram: "8 GB", storage: "256 GB", prosesor: "Dimensity 7050", layar: "6.7 inch", baterai: "5000 mAh", kamera: "64 MP", garansi: "12 bulan" } },

  //Tablet & Monitor & Aksesori
  { name: "Samsung Galaxy Tab S9 FE", slug: "samsung-galaxy-tab-s9-fe", price: 6499000, stock: 22, category: "tablet", seller: "gadget", rating: 4.6, soldCount: 70,
    description: "Tablet dengan stylus untuk mencatat dan menggambar. Layar luas, tahan cipratan air.",
    attributes: { ram: "6 GB", storage: "128 GB", prosesor: "Exynos 1380", layar: "10.9 inch", baterai: "8000 mAh", berat: "0.523 kg", garansi: "12 bulan" } },
  { name: "iPad 10th Gen 64GB", slug: "ipad-10th-gen-64gb", price: 6999000, stock: 18, category: "tablet", seller: "gadget", rating: 4.7, soldCount: 95,
    description: "Tablet serbaguna untuk belajar, nonton, dan kerja ringan.",
    attributes: { ram: "4 GB", storage: "64 GB", prosesor: "Apple A14 Bionic", layar: "10.9 inch", baterai: "7606 mAh", garansi: "12 bulan" } },
  { name: "LG UltraGear 27 QHD 165Hz", slug: "lg-ultragear-27-qhd-165hz", price: 4299000, stock: 20, category: "monitor", seller: "tech", rating: 4.7, soldCount: 130,
    description: "Monitor gaming QHD dengan refresh tinggi. Warna akurat, dudukan bisa diatur tinggi.",
    attributes: { layar: "27 inch", resolusi: "2560x1440", refresh_rate: "165 Hz", konektivitas: "HDMI, DisplayPort", daya: "45 watt", garansi: "36 bulan" } },
  { name: "Dell S2421HN 24 IPS", slug: "dell-s2421hn-24-ips", price: 1899000, stock: 28, category: "monitor", seller: "tech", rating: 4.4, soldCount: 240,
    description: "Monitor kerja 24 inch bezel tipis, nyaman untuk mata saat kerja lama.",
    attributes: { layar: "24 inch", resolusi: "1920x1080", refresh_rate: "75 Hz", konektivitas: "HDMI", daya: "25 watt", garansi: "36 bulan" } },
  { name: "Keychron K2 Pro Mekanikal", slug: "keychron-k2-pro-mekanikal", price: 1450000, stock: 33, category: "keyboard", seller: "tech", rating: 4.8, soldCount: 180,
    description: "Keyboard mekanikal 75% dengan sambungan nirkabel dan kabel. Tombol bisa diganti.",
    attributes: { konektivitas: "Bluetooth, USB-C", baterai: "4000 mAh", berat: "0.82 kg", warna: "hitam", garansi: "12 bulan" } },
  { name: "Logitech MX Master 3S", slug: "logitech-mx-master-3s", price: 1399000, stock: 45, category: "mouse", seller: "tech", rating: 4.9, soldCount: 300,
    description: "Mouse kerja senyap dengan scroll cepat. Nyaman dipakai seharian.",
    attributes: { konektivitas: "Bluetooth, USB Receiver", baterai: "500 mAh", berat: "0.141 kg", warna: "abu-abu", garansi: "12 bulan" } },
  { name: "Sony WH-1000XM5", slug: "sony-wh-1000xm5", price: 4999000, stock: 25, category: "headphone", seller: "gadget", rating: 4.9, soldCount: 210,
    description: "Headphone peredam bising terbaik di kelasnya. Baterai 30 jam, nyaman untuk perjalanan jauh.",
    attributes: { konektivitas: "Bluetooth 5.2", baterai: "1000 mAh", berat: "0.25 kg", warna: "hitam", garansi: "12 bulan" } },
  { name: "Soundcore Liberty 4 NC TWS", slug: "soundcore-liberty-4-nc-tws", price: 1199000, stock: 60, category: "headphone", seller: "gadget", rating: 4.5, soldCount: 430,
    description: "TWS dengan peredam bising aktif, cocok untuk olahraga dan komuter.",
    attributes: { konektivitas: "Bluetooth 5.3", baterai: "500 mAh", berat: "0.047 kg", warna: "putih", garansi: "12 bulan" } },
  { name: "JBL Flip 6 Portable", slug: "jbl-flip-6-portable", price: 1599000, stock: 38, category: "speaker", seller: "gadget", rating: 4.7, soldCount: 260,
    description: "Speaker portabel tahan air, suara bertenaga untuk ukurannya.",
    attributes: { daya: "30 watt", konektivitas: "Bluetooth 5.1", baterai: "4800 mAh", berat: "0.55 kg", garansi: "12 bulan" } },
  { name: "Epson EcoTank L3250", slug: "epson-ecotank-l3250", price: 2799000, stock: 24, category: "printer", seller: "tech", rating: 4.6, soldCount: 175,
    description: "Printer tinta isi ulang, biaya cetak sangat murah. Bisa cetak dari HP.",
    attributes: { konektivitas: "WiFi, USB", daya: "12 watt", berat: "3.9 kg", garansi: "24 bulan" } },
  { name: "Canon EOS R50 Mirrorless", slug: "canon-eos-r50-mirrorless", price: 11499000, stock: 10, category: "kamera", seller: "gadget", rating: 4.7, soldCount: 42,
    description: "Kamera mirrorless ringan untuk konten kreator. Autofokus cepat, video 4K.",
    attributes: { kamera: "24 MP", storage: "128 GB", baterai: "1040 mAh", berat: "0.375 kg", garansi: "12 bulan" } },
  { name: "PlayStation 5 Slim Digital", slug: "playstation-5-slim-digital", price: 7999000, stock: 14, category: "konsol-game", seller: "gadget", rating: 4.8, soldCount: 66,
    description: "Konsol generasi terbaru, loading sangat cepat berkat SSD internal.",
    attributes: { storage: "1 TB", konektivitas: "HDMI 2.1, WiFi 6", daya: "200 watt", berat: "3.2 kg", garansi: "12 bulan" } },
  { name: "Samsung Galaxy Watch 6", slug: "samsung-galaxy-watch-6", price: 3299000, stock: 26, category: "smartwatch", seller: "gadget", rating: 4.5, soldCount: 110,
    description: "Pantau detak jantung, tidur, dan olahraga. Notifikasi langsung di pergelangan tangan.",
    attributes: { layar: "1.5 inch", baterai: "425 mAh", berat: "0.033 kg", konektivitas: "Bluetooth, WiFi", garansi: "12 bulan" } },

  // Elektronik rumah tangga
  { name: "Samsung Smart TV 55 Crystal UHD", slug: "samsung-smart-tv-55-crystal-uhd", price: 7499000, stock: 16, category: "tv", seller: "home", rating: 4.6, soldCount: 85,
    description: "Smart TV 55 inch 4K dengan aplikasi streaming bawaan. Gambar tajam untuk ruang keluarga.",
    attributes: { layar: "55 inch", resolusi: "3840x2160", refresh_rate: "60 Hz", daya: "130 watt", konektivitas: "HDMI, WiFi", garansi: "24 bulan" } },
  { name: "LG Smart TV 43 FHD", slug: "lg-smart-tv-43-fhd", price: 3999000, stock: 20, category: "tv", seller: "home", rating: 4.3, soldCount: 140,
    description: "TV 43 inch untuk kamar atau ruang kecil. Ringan dan mudah dipasang di dinding.",
    attributes: { layar: "43 inch", resolusi: "1920x1080", refresh_rate: "60 Hz", daya: "95 watt", konektivitas: "HDMI, WiFi", garansi: "24 bulan" } },
  { name: "Sharp Kulkas 2 Pintu 224L", slug: "sharp-kulkas-2-pintu-224l", price: 3299000, stock: 18, category: "kulkas", seller: "home", rating: 4.4, soldCount: 96,
    description: "Kulkas dua pintu hemat listrik untuk keluarga kecil. Freezer lapang dan cepat beku.",
    attributes: { kapasitas: "224 liter", daya: "90 watt", berat: "48 kg", warna: "silver", garansi: "12 bulan" } },
  { name: "Polytron Kulkas 1 Pintu 150L", slug: "polytron-kulkas-1-pintu-150l", price: 1999000, stock: 25, category: "kulkas", seller: "home", rating: 4.1, soldCount: 160,
    description: "Kulkas satu pintu untuk kos dan apartemen. Ukuran ringkas, konsumsi listrik rendah.",
    attributes: { kapasitas: "150 liter", daya: "70 watt", berat: "32 kg", warna: "putih", garansi: "12 bulan" } },
  { name: "LG Mesin Cuci Front Loading 8kg", slug: "lg-mesin-cuci-front-loading-8kg", price: 4899000, stock: 12, category: "mesin-cuci", seller: "home", rating: 4.6, soldCount: 58,
    description: "Mesin cuci bukaan depan, hemat air dan senyap. Cocok untuk keluarga.",
    attributes: { kapasitas: "8 liter", daya: "500 watt", berat: "60 kg", garansi: "24 bulan" } },
  { name: "Sharp AC 1 PK Low Watt", slug: "sharp-ac-1-pk-low-watt", price: 3599000, stock: 20, category: "ac", seller: "home", rating: 4.5, soldCount: 130,
    description: "AC 1 PK hemat listrik untuk kamar ukuran sedang. Dingin cepat dan senyap.",
    attributes: { kapasitas: "1 liter", daya: "660 watt", garansi: "12 bulan" } },
  { name: "Miyako Rice Cooker 1.8L", slug: "miyako-rice-cooker-18l", price: 349000, stock: 60, category: "rice-cooker", seller: "home", rating: 4.2, soldCount: 380,
    description: "Penanak nasi 1.8 liter, bisa menghangatkan dan mengukus.",
    attributes: { kapasitas: "1.8 liter", daya: "395 watt", berat: "3.2 kg", garansi: "12 bulan" } },

  //  Perabot 
  { name: "Meja Kerja Kayu Oak 120cm", slug: "meja-kerja-kayu-oak-120cm", price: 1850000, stock: 14, category: "meja", seller: "home", rating: 4.5, soldCount: 72,
    description: "Meja kerja kayu solid dengan lubang kabel. Kokoh untuk monitor ganda.",
    attributes: { berat: "22 kg", warna: "cokelat", garansi: "12 bulan" } },
  { name: "Kursi Kantor Ergonomis Mesh", slug: "kursi-kantor-ergonomis-mesh", price: 1450000, stock: 20, category: "kursi", seller: "home", rating: 4.4, soldCount: 118,
    description: "Sandaran jaring dengan penopang pinggang, nyaman untuk duduk lama.",
    attributes: { berat: "14 kg", warna: "hitam", garansi: "12 bulan" } },
  { name: "Kasur Spring Bed 160x200", slug: "kasur-spring-bed-160x200", price: 3450000, stock: 10, category: "kasur", seller: "home", rating: 4.6, soldCount: 40,
    description: "Kasur ukuran queen dengan per bertingkat. Empuk tapi tetap menopang punggung.",
    attributes: { berat: "45 kg", warna: "putih", garansi: "60 bulan" } },
  { name: "Lemari Pakaian 3 Pintu", slug: "lemari-pakaian-3-pintu", price: 2250000, stock: 8, category: "lemari", seller: "home", rating: 4.2, soldCount: 33,
    description: "Lemari tiga pintu dengan cermin dan laci. Muat banyak untuk kamar utama.",
    attributes: { berat: "58 kg", warna: "cokelat", garansi: "12 bulan" } },

  //  Dapur 
  { name: "Mesin Kopi Espresso 15 Bar", slug: "mesin-kopi-espresso-15-bar", price: 2899000, stock: 15, category: "mesin-kopi", seller: "home", rating: 4.5, soldCount: 88,
    description: "Mesin espresso tekanan 15 bar dengan steam wand untuk susu.",
    attributes: { daya: "1350 watt", kapasitas: "1.5 liter", berat: "4.2 kg", garansi: "12 bulan" } },
  { name: "Set Pisau Dapur Stainless 6 Pcs", slug: "set-pisau-dapur-stainless-6-pcs", price: 459000, stock: 40, category: "peralatan-masak", seller: "home", rating: 4.3, soldCount: 210,
    description: "Enam pisau baja tahan karat dengan blok kayu. Tajam dan mudah dirawat.",
    attributes: { berat: "1.8 kg", warna: "silver", garansi: "12 bulan" } },

  // Fashion 
  { name: "Hoodie Katun Oversized 400gsm", slug: "hoodie-katun-oversized-400gsm", price: 289000, stock: 80, category: "atasan", seller: "fashion", rating: 4.4, soldCount: 520,
    description: "Hoodie tebal bahan fleece, jahitan rapi, tidak melar setelah dicuci.",
    attributes: { warna: "hitam", berat: "0.7 kg" } },
  { name: "Kaos Polos Cotton Combed 30s", slug: "kaos-polos-cotton-combed-30s", price: 89000, stock: 150, category: "atasan", seller: "fashion", rating: 4.2, soldCount: 980,
    description: "Kaos harian bahan adem, tersedia banyak warna. Sablon tahan lama.",
    attributes: { warna: "putih", berat: "0.2 kg" } },
  { name: "Jaket Denim Klasik", slug: "jaket-denim-klasik", price: 429000, stock: 45, category: "jaket", seller: "fashion", rating: 4.5, soldCount: 230,
    description: "Jaket denim cuci vintage, potongan reguler yang tidak lekang zaman.",
    attributes: { warna: "biru", berat: "0.8 kg" } },
  { name: "Sepatu Lari Ringan Pria", slug: "sepatu-lari-ringan-pria", price: 549000, stock: 60, category: "sepatu", seller: "fashion", rating: 4.4, soldCount: 340,
    description: "Sepatu lari dengan bantalan empuk dan bagian atas berpori.",
    attributes: { warna: "hitam", berat: "0.28 kg" } },
  { name: "Tas Ransel Laptop 15.6 inch", slug: "tas-ransel-laptop-156-inch", price: 329000, stock: 70, category: "tas", seller: "fashion", rating: 4.6, soldCount: 410,
    description: "Ransel dengan kompartemen laptop berlapis busa dan bahan tahan air.",
    attributes: { warna: "abu-abu", berat: "0.65 kg", kapasitas: "25 liter" } },

  // Olahraga
  { name: "Sepeda Lipat 20 inch 7 Speed", slug: "sepeda-lipat-20-inch-7-speed", price: 2350000, stock: 16, category: "sepeda", seller: "sport", rating: 4.3, soldCount: 74,
    description: "Sepeda lipat praktis untuk komuter. Mudah disimpan di bagasi mobil.",
    attributes: { berat: "13 kg", warna: "merah", garansi: "12 bulan" } },
  { name: "Sepeda Gunung MTB 27.5 inch", slug: "sepeda-gunung-mtb-275-inch", price: 3450000, stock: 12, category: "sepeda", seller: "sport", rating: 4.5, soldCount: 52,
    description: "MTB dengan rem cakram dan suspensi depan, siap untuk jalur tanah.",
    attributes: { berat: "15 kg", warna: "hitam", garansi: "12 bulan" } },
  { name: "Set Dumbbell Adjustable 20kg", slug: "set-dumbbell-adjustable-20kg", price: 899000, stock: 24, category: "alat-fitness", seller: "sport", rating: 4.4, soldCount: 145,
    description: "Beban bisa diatur, hemat tempat untuk latihan di rumah.",
    attributes: { berat: "20 kg", warna: "hitam", garansi: "12 bulan" } },
  { name: "Matras Yoga TPE 8mm", slug: "matras-yoga-tpe-8mm", price: 189000, stock: 90, category: "alat-fitness", seller: "sport", rating: 4.3, soldCount: 300,
    description: "Matras tebal anti selip, nyaman untuk yoga dan latihan lantai.",
    attributes: { berat: "1.1 kg", warna: "ungu" } },

  // Perkakas 
  { name: "Bor Cordless 20V Brushless", slug: "bor-cordless-20v-brushless", price: 1290000, stock: 22, category: "bor", seller: "tools", rating: 4.5, soldCount: 165,
    description: "Bor tanpa kabel dengan 50 mata bor. Torsi kuat untuk kayu dan besi ringan.",
    attributes: { daya: "400 watt", baterai: "2000 mAh", berat: "1.6 kg", garansi: "12 bulan" } },
  { name: "Steam Cleaner Bertekanan 140 Bar", slug: "steam-cleaner-bertekanan-140-bar", price: 1690000, stock: 14, category: "alat-kebersihan", seller: "tools", rating: 4.4, soldCount: 92,
    description: "Penyemprot air bertekanan untuk mencuci motor, mobil, dan teras.",
    attributes: { daya: "1400 watt", berat: "8.5 kg", garansi: "12 bulan" } },
  { name: "Vacuum Cleaner 2-in-1 Cordless", slug: "vacuum-cleaner-2in1-cordless", price: 1150000, stock: 26, category: "alat-kebersihan", seller: "tools", rating: 4.2, soldCount: 130,
    description: "Penyedot debu tanpa kabel, bisa dilepas jadi handheld untuk jok mobil.",
    attributes: { daya: "250 watt", baterai: "2200 mAh", berat: "2.4 kg", garansi: "12 bulan" } },

  { name: "UltraBook Pro 15", slug: "ultrabook-pro-15", price: 15499000, stock: 25, category: "laptop", seller: "tech", rating: 4.6, soldCount: 95,
    description: "Laptop performa tinggi untuk developer dan pekerja kreatif.",
    attributes: { ram: "16 GB", storage: "1 TB", prosesor: "Intel Core i7-13700H", layar: "15.6 inch", berat: "1.8 kg", garansi: "24 bulan" } },
  { name: "Wireless Noise-Canceling Headphones X", slug: "wireless-headphones-x", price: 2999000, stock: 40, category: "headphone", seller: "tech", rating: 4.5, soldCount: 180,
    description: "Suara imersif dengan baterai 30 jam dan peredam bising aktif.",
    attributes: { konektivitas: "Bluetooth 5.0", baterai: "800 mAh", berat: "0.26 kg", warna: "hitam", garansi: "12 bulan" } },
  { name: "Smart Watch Ultra Fit", slug: "smart-watch-ultra-fit", price: 1899000, stock: 30, category: "smartwatch", seller: "tech", rating: 4.2, soldCount: 140,
    description: "Pantau kesehatan, olahraga, dan notifikasi secara real-time.",
    attributes: { layar: "1.4 inch", baterai: "380 mAh", berat: "0.045 kg", konektivitas: "Bluetooth", garansi: "12 bulan" } },
  { name: "Ergonomic Mesh Chair", slug: "ergonomic-mesh-chair", price: 2450000, stock: 15, category: "kursi", seller: "home", rating: 4.6, soldCount: 60,
    description: "Kursi dengan penopang pinggang penuh untuk jam kerja panjang.",
    attributes: { berat: "16 kg", warna: "hitam", garansi: "24 bulan" } },
  { name: "Minimalist Oak Wood Desk", slug: "minimalist-oak-wood-desk", price: 3200000, stock: 10, category: "meja", seller: "home", rating: 4.5, soldCount: 38,
    description: "Meja kayu oak solid dengan lubang manajemen kabel.",
    attributes: { berat: "28 kg", warna: "cokelat", garansi: "12 bulan" } },
  { name: "Artisan Espresso Coffee Machine", slug: "artisan-espresso-machine", price: 4500000, stock: 12, category: "mesin-kopi", seller: "home", rating: 4.7, soldCount: 52,
    description: "Mesin espresso tekanan 15 bar kelas barista untuk di rumah.",
    attributes: { daya: "1450 watt", kapasitas: "2 liter", berat: "9 kg", garansi: "24 bulan" } },
  { name: "Japanese Chef Knife Set", slug: "japanese-chef-knife-set", price: 1250000, stock: 20, category: "peralatan-masak", seller: "home", rating: 4.6, soldCount: 110,
    description: "Pisau presisi baja karbon tinggi tahan karat.",
    attributes: { berat: "2.2 kg", warna: "silver", garansi: "12 bulan" } },
  { name: "Premium Cotton Oversized Hoodie", slug: "premium-cotton-oversized-hoodie", price: 499000, stock: 50, category: "atasan", seller: "fashion", rating: 4.4, soldCount: 290,
    description: "Hoodie fleece 400gsm dengan warna earth tone.",
    attributes: { warna: "cokelat", berat: "0.75 kg" } },
  { name: "Classic Denim Jacket", slug: "classic-denim-jacket", price: 650000, stock: 35, category: "jaket", seller: "fashion", rating: 4.3, soldCount: 175,
    description: "Jaket denim cuci vintage yang tidak lekang zaman.",
    attributes: { warna: "biru", berat: "0.9 kg" } },
  { name: "Cordless Multi-Tool Drill Kit", slug: "cordless-multi-tool-drill-kit", price: 1350000, stock: 18, category: "bor", seller: "tools", rating: 4.5, soldCount: 120,
    description: "Bor brushless 20V dengan 50 aksesori.",
    attributes: { daya: "450 watt", baterai: "2500 mAh", berat: "1.7 kg", garansi: "24 bulan" } },
  { name: "High Pressure Washer 140 Bar", slug: "high-pressure-washer-140-bar", price: 1790000, stock: 14, category: "alat-kebersihan", seller: "tools", rating: 4.4, soldCount: 80,
    description: "Cocok untuk mencuci kendaraan, teras, dan perawatan luar ruang.",
    attributes: { daya: "1500 watt", berat: "9 kg", garansi: "12 bulan" } },
];

const LEGACY_CATEGORY_SLUGS = ["technology", "habitat", "culinary", "apparel", "maintenance"];

function imageFor(categorySlug: string): string {
  const map: Record<string, string> = {
    laptop: IMAGES.laptop, smartphone: IMAGES.smartphone, tablet: IMAGES.tablet,
    monitor: IMAGES.monitor, keyboard: IMAGES.keyboard, mouse: IMAGES.mouse,
    headphone: IMAGES.headphone, speaker: IMAGES.speaker, printer: IMAGES.printer,
    kamera: IMAGES.kamera, "konsol-game": IMAGES.konsol, smartwatch: IMAGES.jam,
    tv: IMAGES.tv, kulkas: IMAGES.kulkas, "mesin-cuci": IMAGES.cuci, ac: IMAGES.ac,
    "rice-cooker": IMAGES.dapur, meja: IMAGES.meja, kursi: IMAGES.kursi,
    kasur: IMAGES.kasur, lemari: IMAGES.lemari, "mesin-kopi": IMAGES.dapur,
    "peralatan-masak": IMAGES.dapur, atasan: IMAGES.fashion, jaket: IMAGES.fashion,
    sepatu: IMAGES.sepatu, tas: IMAGES.tas, sepeda: IMAGES.sepeda,
    "alat-fitness": IMAGES.fitness, bor: IMAGES.bor, "alat-kebersihan": IMAGES.bersih,
  };
  return map[categorySlug] ?? IMAGES.laptop;
}

function skuFor(slug: string): string {
  const head = slug.replace(/[^a-z0-9]/g, "").slice(0, 8).toUpperCase();
  let hash = 5381;
  for (let i = 0; i < slug.length; i++) hash = ((hash << 5) + hash + slug.charCodeAt(i)) | 0;
  return `NB-${head}-${(hash >>> 0).toString(36).toUpperCase().slice(0, 5)}`;
}

async function main() {
  console.log("Seeding data...");

  const categoryIds = new Map<string, string>();
  for (const parent of CATEGORY_TREE) {
    const created = await prisma.category.upsert({
      where: { slug: parent.slug },
      update: { name: parent.name, parentId: null },
      create: { name: parent.name, slug: parent.slug },
    });
    categoryIds.set(parent.slug, created.id);

    for (const child of parent.children) {
      const createdChild = await prisma.category.upsert({
        where: { slug: child.slug },
        update: { name: child.name, parentId: created.id },
        create: { name: child.name, slug: child.slug, parentId: created.id },
      });
      categoryIds.set(child.slug, createdChild.id);
    }
  }
  console.log(`  kategori: ${categoryIds.size} (${CATEGORY_TREE.length} induk)`);

  const admin = await prisma.user.upsert({
    where: { email: "admin@needbuy.test" },
    update: {},
    create: {
      username: "admin",
      name: "Demo Admin",
      email: "admin@needbuy.test",
      passwordHash: await bcrypt.hash("admin12345", 10),
      role: "ADMIN",
    },
  });

  await prisma.adminProfile.upsert({
    where: { userId: admin.id },
    update: {},
    create: { userId: admin.id, fullName: admin.name, email: admin.email },
  });
  console.log(`  admin: ${admin.email} / admin12345`);

  // 3. Penjual.
  const sellerIds = new Map<string, string>();
  for (const s of SELLERS) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        username: s.username,
        name: s.name,
        email: s.email,
        passwordHash: await bcrypt.hash("password123", 10),
        role: "SELLER",
      },
    });
    const seller = await prisma.seller.upsert({
      where: { userId: user.id },
      update: { storeName: s.store, rating: s.rating },
      create: { userId: user.id, storeName: s.store, rating: s.rating },
    });
    sellerIds.set(s.key, seller.id);
  }
  console.log(`  penjual: ${sellerIds.size}`);

  // 4. Produk beserta gambar dan ATRIBUT.
  let attributeCount = 0;
  for (const p of PRODUCTS) {
    const categoryId = categoryIds.get(p.category);
    const sellerId = sellerIds.get(p.seller);
    if (!categoryId) throw new Error(`kategori tidak dikenal di seed: ${p.category}`);
    if (!sellerId) throw new Error(`penjual tidak dikenal di seed: ${p.seller}`);

    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        description: p.description,
        price: p.price,
        stock: p.stock,
        categoryId,
        sellerId,
        sku: skuFor(p.slug),
        rating: p.rating ?? 0,
        soldCount: p.soldCount ?? 0,
        isActive: true,
      },
      create: {
        sellerId,
        categoryId,
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: p.price,
        stock: p.stock,
        sku: skuFor(p.slug),
        rating: p.rating ?? 0,
        soldCount: p.soldCount ?? 0,
        images: { create: [{ url: imageFor(p.category), isPrimary: true, sortOrder: 0 }] },
      },
    });

    await prisma.productAttribute.deleteMany({ where: { productId: product.id } });
    const kondisi = ["Baru", "Baru", "Seperti Baru", "Baru", "Refurbished"][
      PRODUCTS.indexOf(p) % 5
    ];
    const entries = Object.entries({ ...p.attributes, kondisi });
    if (entries.length) {
      await prisma.productAttribute.createMany({
        data: entries.map(([attrKey, attrValue]) => ({ productId: product.id, attrKey, attrValue })),
      });
      attributeCount += entries.length;
    }
  }

  console.log(`  produk: ${PRODUCTS.length}`);
  console.log(`  atribut produk: ${attributeCount}`);
  const promoSlugs = PRODUCTS.slice(0, 6).map((p) => p.slug);
  for (const [index, slug] of promoSlugs.entries()) {
    await prisma.product.update({
      where: { slug },
      data: { discountPercent: [25, 20, 15, 30, 10, 40][index] ?? 10 },
    });
  }
  console.log(`  produk promo: ${promoSlugs.length}`);

  // 4c. Kupon awal.
  const COUPONS = [
    {
      code: "NEEDBUY10",
      title: "Diskon 10% untuk semua produk",
      description: "Berlaku tanpa minimum belanja, maksimal potongan Rp50.000.",
      type: "PERCENT" as const,
      value: 10,
      minSpend: 0,
      maxDiscount: 50_000,
      quota: 500,
    },
    {
      code: "ONGKIRGRATIS",
      title: "Potongan ongkir Rp20.000",
      description: "Minimum belanja Rp150.000.",
      type: "FIXED" as const,
      value: 20_000,
      minSpend: 150_000,
      maxDiscount: null,
      quota: 1000,
    },
    {
      code: "BELANJABESAR",
      title: "Diskon 15% belanja di atas Rp1 juta",
      description: "Maksimal potongan Rp200.000.",
      type: "PERCENT" as const,
      value: 15,
      minSpend: 1_000_000,
      maxDiscount: 200_000,
      quota: null,
    },
  ];

  const in30Days = new Date(Date.now() + 30 * 86_400_000);
  for (const coupon of COUPONS) {
    await prisma.coupon.upsert({
      where: { code: coupon.code },
      update: { ...coupon, expiresAt: in30Days, isActive: true },
      create: { ...coupon, expiresAt: in30Days },
    });
  }
  console.log(`  kupon: ${COUPONS.length}`);

  for (const slug of LEGACY_CATEGORY_SLUGS) {
    const category = await prisma.category.findUnique({
      where: { slug },
      select: { id: true, name: true, _count: { select: { products: true, children: true } } },
    });
    if (!category) continue;

    if (category._count.products > 0 || category._count.children > 0) {
      console.log(
        `  kategori lama "${slug}" DIPERTAHANKAN: masih dipakai ${category._count.products} produk`
      );
      continue;
    }
    await prisma.category.delete({ where: { id: category.id } });
    console.log(`  kategori lama "${slug}" dihapus (sudah kosong)`);
  }

  console.log("Seed selesai.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
