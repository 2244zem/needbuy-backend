import { normalizeSlang } from "./slang";

export type ExtractedRequirement = { key: string; value: string; isHard: boolean };
export type ExtractedPreference = { key: string; value: string; weight: number };

export const STOPWORDS = new Set([
  "dan", "di", "ke", "dari", "yang", "ini", "itu", "dengan", "pada", "adalah",
  "untuk", "saya", "aku", "kamu", "dia", "mereka", "kita", "akan", "sudah",
  "belum", "bisa", "dapat", "ada", "tidak", "juga", "sangat", "lebih", "atau",
  "kalau", "jika", "karena", "seperti", "tapi", "tetapi", "namun", "hanya",
  "saja", "masih", "harus", "telah", "sedang", "lagi", "punya", "mau", "pengen",
  "nih", "dong", "sih", "deh", "ya", "yah", "ga", "engga", "ngga", "gue", "lu",
  "elo", "gw", "aja", "doang", "banget", "kok", "nya", "buat", "sama", "biar",
]);

export function normalizeText(text: string): string {
  return normalizeSlang(text)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/rp\.?\s*/g, "rp ")

    .replace(/\d{1,3}(?:\.\d{3})+\b/g, (run) => run.replace(/\./g, ""))
    .replace(/(\d),(\d)/g, "$1.$2");
}

export function tokenize(text: string): string[] {
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return tokens.filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export const PRODUCT_KEYWORDS: Record<string, string[]> = {
  laptop: ["laptop", "notebook", "macbook", "chromebook", "thinkpad", "ultrabook", "lepi", "leptop"],
  smartphone: ["hp", "handphone", "smartphone", "iphone", "android", "samsung", "xiaomi", "oppo", "vivo", "poco", "redmi", "realme", "hape", "henpon", "ponsel"],
  tablet: ["tablet", "ipad"],
  monitor: ["monitor", "display"],
  keyboard: ["keyboard", "mekanikal"],
  mouse: ["mouse", "tetikus"],
  headphone: ["headphone", "earphone", "headset", "earbuds", "tws", "airpods", "hedset", "hedfon"],
  speaker: ["speaker", "soundbar", "spiker"],
  printer: ["printer", "scanner"],
  kamera: ["kamera", "dslr", "mirrorless", "gopro", "camcorder", "camera"],
  tv: ["tv", "televisi", "tipi"],
  ac: ["ac", "air conditioner", "pendingin ruangan"],
  kulkas: ["kulkas", "freezer", "lemari es"],
  "mesin-cuci": ["mesin cuci", "mesincuci"],
  "rice-cooker": ["rice cooker", "ricecooker", "magic com", "magicom", "penanak nasi"],
  "mesin-kopi": ["mesin kopi", "coffee maker", "espresso", "kopi maker"],
  sepeda: ["sepeda", "bike", "mtb", "sepedaan"],
  meja: ["meja"],
  kursi: ["kursi", "bangku"],
  kasur: ["kasur", "spring bed", "matras", "springbed"],
  lemari: ["lemari"],
  "konsol-game": ["playstation", "ps5", "ps4", "xbox", "nintendo", "konsol"],
  smartwatch: ["smartwatch", "jam tangan", "smartband", "jam pintar"],
  sepatu: ["sepatu", "sneakers", "sepatu lari", "running shoes"],
  tas: ["tas", "ransel", "backpack", "tas selempang"],
  jaket: ["jaket", "hoodie", "sweater"],
  atasan: ["kaos", "kemeja", "baju", "atasan"],
  "alat-fitness": ["dumbbell", "barbel", "treadmill", "alat fitness", "matras yoga"],
  perkakas: ["obeng", "tang", "palu", "perkakas", "kunci pas"],
  bor: ["bor", "drill"],
  "peralatan-masak": ["panci", "wajan", "teflon", "peralatan masak", "penggorengan"],
  "alat-kebersihan": ["sapu", "pel", "vacuum", "penyedot debu", "alat kebersihan"],
};

export function detectCategory(text: string): string | null {
  const lower = normalizeText(text);
  let best: { slug: string; score: number } | null = null;

  for (const [slug, keywords] of Object.entries(PRODUCT_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      const boundary = new RegExp(`\\b${keyword.replace(/\s+/g, "\\s+")}\\b`, "i");
      if (boundary.test(lower)) score++;
    }
    if (score > 0 && (!best || score > best.score)) best = { slug, score };
  }

  return best?.slug ?? null;
}

const GOAL_PATTERNS = [
  /\b(?:butuh|perlu|cari|mencari|mau beli|pengen beli|pengin beli|membutuhkan|nyari)\s+([^.,!?;]{5,80})/i,
  /\b([a-z0-9]+(?:\s+[a-z0-9]+){1,5})\s+(?:untuk|buat|dipakai|digunakan)\s+([^.,!?;]{3,50})/i,
];

export function detectGoal(text: string): string | null {
  const lower = normalizeText(text);

  for (const pattern of GOAL_PATTERNS) {
    const match = pattern.exec(lower);
    if (!match) continue;
    const parts = match.slice(1).filter((g): g is string => Boolean(g?.trim().length > 2));
    if (parts.length) return capitalize(parts.map((p) => p.trim()).join(" ").slice(0, 120));
  }

  const words = lower.split(" ").filter(Boolean).slice(0, 8);
  return words.length ? capitalize(words.join(" ")) : null;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export const ATTRIBUTE_KEYWORDS: { pattern: RegExp; key: string }[] = [
  { pattern: /\bram\b/i, key: "ram" },
  { pattern: /\b(storage|penyimpanan|ssd|hdd|rom|memori internal)\b/i, key: "storage" },
  { pattern: /\b(prosesor|processor|cpu|chip|chipset)\b/i, key: "prosesor" },
  { pattern: /\b(layar|screen|display|inch|inci)\b/i, key: "layar" },
  { pattern: /\b(baterai|battery|mah)\b/i, key: "baterai" },
  { pattern: /\b(kamera|camera|mp)\b/i, key: "kamera" },
  { pattern: /\b(warna|color)\b/i, key: "warna" },
  { pattern: /\b(berat|weight|kg|gram)\b/i, key: "berat" },
  { pattern: /\b(garansi|warranty)\b/i, key: "garansi" },
  { pattern: /\b(vga|gpu|grafis|graphic|kartu grafis)\b/i, key: "gpu" },
  { pattern: /\b(refresh rate|hz)\b/i, key: "refresh_rate" },
  { pattern: /\b(kapasitas|volume|liter)\b/i, key: "kapasitas" },
  { pattern: /\b(daya|watt|konsumsi listrik)\b/i, key: "daya" },
];

export const HARD_MARKERS =
  /\b(minimal|min|paling tidak|setidaknya|wajib|harus|at least|minimum|kudu|mesti)\b/i;

const CLAUSE_SPLITTER =
  /[,;.]|\bdan\b|\blalu\b|\bserta\b|\bkemudian\b|\btapi\b|\bnamun\b|\bkalau bisa\b|\bsyukur-syukur\b/i;

const VALUE_PATTERN =
  /(\d+(?:[.,]\d+)?\s*(?:gb|tb|mb|mah|mp|inch|inci|hz|kg|gram|g|liter|watt|w|tahun|bulan)?)/i;

const UNIT_CASING: Record<string, string> = {
  gb: "GB", tb: "TB", mb: "MB", mah: "mAh", mp: "MP", hz: "Hz",
  inch: '"', inci: '"', kg: "kg", gram: "g", g: "g",
  liter: "L", watt: "W", w: "W", tahun: " tahun", bulan: " bulan",
};

export function normalizeValue(raw: string): string {
  const match = /^(\d+(?:[.,]\d+)?)\s*([a-z"]*)$/i.exec(raw.trim());
  if (!match) return raw.trim();
  const amount = match[1].replace(",", ".");
  const unit = match[2].toLowerCase();
  return unit ? `${amount}${UNIT_CASING[unit] ?? unit.toUpperCase()}` : amount;
}

export function extractRequirements(text: string): ExtractedRequirement[] {
  const found: ExtractedRequirement[] = [];

  for (const clause of normalizeSlang(text).split(CLAUSE_SPLITTER)) {
    if (!clause?.trim()) continue;
    const isHard = HARD_MARKERS.test(clause);

    for (const { pattern, key } of ATTRIBUTE_KEYWORDS) {
      const match = pattern.exec(clause);
      if (!match) continue;

      const afterKeyword = clause.slice(match.index + match[0].length);
      const value = VALUE_PATTERN.exec(afterKeyword)?.[1]?.trim();
      if (!value) continue;

      found.push({ key, value: normalizeValue(value), isHard });
    }
  }

  const seen = new Set<string>();
  return found.filter((req) => (seen.has(req.key) ? false : (seen.add(req.key), true)));
}

export const PREFERENCE_KEYWORDS: { pattern: RegExp; key: string; value: string }[] = [
  { pattern: /\b(ringan|enteng|portabel|portable)\b/i, key: "berat", value: "ringan" },
  { pattern: /\b(awet|tahan lama|durable|bandel)\b/i, key: "daya tahan", value: "awet" },
  { pattern: /\b(hemat baterai|baterai awet|tahan seharian)\b/i, key: "baterai", value: "awet" },
  { pattern: /\b(murah|terjangkau|hemat|ekonomis)\b/i, key: "harga", value: "murah" },
  { pattern: /\b(premium|mewah|flagship)\b/i, key: "kelas", value: "premium" },
  { pattern: /\b(cepat|ngebut|kencang|responsif)\b/i, key: "performa", value: "cepat" },
  { pattern: /\b(senyap|tidak berisik|silent)\b/i, key: "kebisingan", value: "senyap" },
  { pattern: /\b(garansi resmi|bergaransi)\b/i, key: "garansi", value: "resmi" },
];

export const BRANDS = [
  "apple", "samsung", "xiaomi", "oppo", "vivo", "realme", "asus", "lenovo",
  "dell", "acer", "msi", "razer", "logitech", "sony", "lg", "toshiba",
  "huawei", "infinix", "poco", "nothing", "google", "sharp", "polytron",
];

export function brandsInText(text: string): string[] {
  const lower = normalizeText(text ?? "");
  return BRANDS.filter((b) => new RegExp(`\\b${b}\\b`, "i").test(lower));
}

export function extractPreferences(text: string): ExtractedPreference[] {
  const lower = normalizeText(text);
  const preferences: ExtractedPreference[] = [];

  const brand = BRANDS.find((b) => new RegExp(`\\b${b}\\b`, "i").test(lower));
  if (brand) {
    preferences.push({ key: "brand", value: capitalize(brand), weight: 1.5 });
  }

  for (const pref of PREFERENCE_KEYWORDS) {
    if (pref.pattern.test(lower)) {
      preferences.push({ key: pref.key, value: pref.value, weight: 1 });
    }
  }

  return preferences;
}

export const KNOWN_LOCATIONS = [
  "jabodetabek", "jakarta", "bandung", "surabaya", "yogyakarta", "jogja",
  "semarang", "medan", "makassar", "palembang", "tangerang", "bekasi", "depok",
  "bogor", "malang", "solo", "denpasar", "bali", "batam", "pekanbaru",
  "balikpapan", "samarinda", "manado", "padang", "banjarmasin", "pontianak",
  "jawa", "sumatera", "kalimantan", "sulawesi", "papua",
];

export function extractLocation(text: string): string | null {
  const lower = normalizeText(text);

  for (const loc of [...KNOWN_LOCATIONS].sort((a, b) => b.length - a.length)) {
    if (new RegExp(`\\b${loc}\\b`, "i").test(lower)) return capitalize(loc);
  }

  const match = /\b(?:di|dari|daerah|kota|kabupaten)\s+([a-z][a-z\s]{2,30})/i.exec(lower);
  return match ? capitalize(match[1].trim().slice(0, 120)) : null;
}
