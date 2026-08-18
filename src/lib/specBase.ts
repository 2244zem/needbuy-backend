export type SpecBand = { max: number; absurd: number; unit: string };
export const SPEC_RANGES: Record<string, SpecBand> = {
  ram: { max: 128, absurd: 256, unit: "GB" },
  storage: { max: 8192, absurd: 65536, unit: "GB" },
  layar: { max: 100, absurd: 200, unit: "inch" },
  baterai: { max: 100000, absurd: 500000, unit: "mAh" },
  kamera: { max: 200, absurd: 1000, unit: "MP" },
  berat: { max: 500, absurd: 5000, unit: "kg" },
  garansi: { max: 60, absurd: 240, unit: "bulan" },
  refresh_rate: { max: 360, absurd: 1000, unit: "Hz" },
  kapasitas: { max: 1000, absurd: 10000, unit: "liter" },
  daya: { max: 5000, absurd: 50000, unit: "watt" },
};
const SPEC_KEY_ALIASES: Record<string, string> = {
  ram: "ram", memori: "ram", memory: "ram",
  storage: "storage", penyimpanan: "storage", ssd: "storage", hdd: "storage",
  rom: "storage", "memori internal": "storage",
  prosesor: "prosesor", processor: "prosesor", cpu: "prosesor", chipset: "prosesor",
  chip: "prosesor",
  layar: "layar", display: "layar", screen: "layar", ukuran_layar: "layar",
  "ukuran layar": "layar",
  baterai: "baterai", battery: "baterai", batre: "baterai",
  kamera: "kamera", camera: "kamera",
  berat: "berat", weight: "berat", bobot: "berat",
  garansi: "garansi", warranty: "garansi",
  gpu: "gpu", vga: "gpu", grafis: "gpu", "kartu grafis": "gpu",
  refresh_rate: "refresh_rate", "refresh rate": "refresh_rate",
  kapasitas: "kapasitas", capacity: "kapasitas", volume: "kapasitas", pk: "kapasitas",
  daya: "daya", power: "daya", watt: "daya", "konsumsi listrik": "daya",
  resolusi: "resolusi", resolution: "resolusi",
  konektivitas: "konektivitas", connectivity: "konektivitas", koneksi: "konektivitas",
  warna: "warna", color: "warna",
};
export function normalizeSpecKey(raw: string): string | null {
  const key = (raw ?? "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  return SPEC_KEY_ALIASES[key] ?? SPEC_KEY_ALIASES[key.replace(/\s+/g, "_")] ?? null;
}
export const CATEGORY_ALIASES: Record<string, string[]> = {
  laptop: ["laptop", "notebook", "macbook", "ultrabook"],
  smartphone: ["smartphone", "hp", "handphone", "android", "iphone", "ponsel"],
  tablet: ["tablet", "ipad"],
  monitor: ["monitor"],
  tv: ["tv", "televisi"],
  kulkas: ["kulkas", "freezer"],
  "mesin-cuci": ["mesin cuci", "mesincuci"],
  ac: ["ac"],
  kamera: ["kamera", "dslr", "mirrorless"],
  headphone: ["headphone", "earphone", "headset", "earbuds", "tws"],
  speaker: ["speaker", "soundbar"],
  printer: ["printer"],
  keyboard: ["keyboard"],
  mouse: ["mouse"],
};

export const CATEGORY_SPECS: Record<string, string[]> = {
  laptop: ["ram", "storage", "prosesor", "gpu", "layar", "baterai", "berat", "garansi", "refresh_rate", "resolusi"],
  smartphone: ["ram", "storage", "prosesor", "layar", "baterai", "kamera", "garansi", "berat", "refresh_rate", "warna"],
  tablet: ["ram", "storage", "prosesor", "layar", "baterai", "kamera", "berat", "garansi"],
  monitor: ["layar", "resolusi", "refresh_rate", "garansi", "daya", "konektivitas"],
  tv: ["layar", "resolusi", "refresh_rate", "garansi", "daya", "konektivitas"],
  kulkas: ["kapasitas", "daya", "berat", "garansi", "warna"],
  "mesin-cuci": ["kapasitas", "daya", "berat", "garansi"],
  ac: ["kapasitas", "daya", "garansi"],
  kamera: ["kamera", "storage", "baterai", "berat", "garansi"],
  headphone: ["konektivitas", "baterai", "berat", "garansi", "warna"],
  speaker: ["daya", "konektivitas", "baterai", "berat", "garansi"],
  printer: ["konektivitas", "daya", "garansi", "berat"],
  keyboard: ["konektivitas", "garansi", "warna", "berat"],
  mouse: ["konektivitas", "garansi", "warna", "berat"],
};

export const REQUIRED_SPECS_PER_CATEGORY: Record<string, string[]> = {
  laptop: ["ram", "storage", "prosesor"],
  smartphone: ["ram", "storage", "layar"],
  tablet: ["ram", "storage", "layar"],
  monitor: ["layar", "resolusi"],
  tv: ["layar"],
  kulkas: ["kapasitas"],
  "mesin-cuci": ["kapasitas"],
  ac: ["kapasitas"],
  kamera: ["kamera"],
  headphone: ["konektivitas"],
  speaker: ["daya"],
  printer: ["konektivitas"],
  keyboard: ["konektivitas"],
  mouse: ["konektivitas"],
};

export function canonicalCategory(categoryName: string | null | undefined): string | null {
  if (!categoryName) return null;
  const normalized = categoryName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!normalized) return null;

  const spaced = normalized.replace(/-/g, " ");
  const segments = new Set([normalized, spaced, ...normalized.split("-")]);

  for (const [category, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (aliases.some((alias) => segments.has(alias))) return category;
  }
  return null;
}

export function specAppliesToCategory(key: string, categoryName: string | null): boolean {
  const cat = canonicalCategory(categoryName);
  if (!cat) return true;
  const applicable = CATEGORY_SPECS[cat];
  if (!applicable || applicable.length === 0) return true;
  return applicable.includes(key);
}

export function requiredSpecsFor(categoryName: string | null): string[] {
  const cat = canonicalCategory(categoryName);
  return cat ? (REQUIRED_SPECS_PER_CATEGORY[cat] ?? []) : [];
}

const UNIT_MULTIPLIER: Record<string, number> = {
  gb: 1, tb: 1024, mb: 1 / 1024,
  mah: 1, wh: 1, whr: 1,
  mp: 1, hz: 1,
  inch: 1, inci: 1,
  kg: 1, gram: 1 / 1000, gr: 1 / 1000, g: 1 / 1000,
  liter: 1, l: 1, ml: 1 / 1000,
  watt: 1, w: 1,
  tahun: 12, thn: 12, bulan: 1,
  jam: 1,
};

const VALUE_RE = /(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)/;

export function parseSpecValue(value: string): { number: number; unit: string } | null {
  const match = VALUE_RE.exec((value ?? "").trim());
  if (!match) return null;
  const num = Number.parseFloat(match[1].replace(",", "."));
  if (Number.isNaN(num)) return null;
  const unit = match[2].toLowerCase();
  const multiplier = UNIT_MULTIPLIER[unit];
  return { number: num * (multiplier ?? 1), unit: multiplier ? unit : "?" };
}

const UNIT_DIMENSION: Record<string, string> = {
  gb: "digital", tb: "digital", mb: "digital",
  mah: "muatan", wh: "muatan", whr: "muatan",
  mp: "piksel",
  hz: "frekuensi",
  inch: "panjang", inci: "panjang",
  kg: "massa", gram: "massa", gr: "massa", g: "massa",
  liter: "volume", l: "volume", ml: "volume",
  watt: "daya", w: "daya",
  tahun: "waktu", thn: "waktu", bulan: "waktu",
  jam: "durasi",
};

export function compareSpecValues(a: string, b: string): number | null {
  const left = parseSpecValue(a);
  const right = parseSpecValue(b);
  if (!left || !right) return null;

  const leftDimension = UNIT_DIMENSION[left.unit];
  const rightDimension = UNIT_DIMENSION[right.unit];

  if (!leftDimension && !rightDimension) return left.number - right.number;
  if (leftDimension !== rightDimension) return null;

  return left.number - right.number;
}

export type SpecVerdict = { flagged: boolean; reason: string };

const NOT_FLAGGED: SpecVerdict = { flagged: false, reason: "" };
export function isSpecAbsurd(key: string, value: string): SpecVerdict {
  const band = SPEC_RANGES[key];
  if (!band) return NOT_FLAGGED;
  const parsed = parseSpecValue(value);
  if (!parsed) return NOT_FLAGGED;

  if (parsed.number > band.absurd || parsed.number < band.max / 1000) {
    return {
      flagged: true,
      reason: `nilai ${key} (${value}) nggak masuk akal: maksimum yang wajar sekitar ${band.max} ${band.unit}`,
    };
  }
  return NOT_FLAGGED;
}

export function isSpecSuspicious(key: string, value: string): SpecVerdict {
  const band = SPEC_RANGES[key];
  if (!band) return NOT_FLAGGED;
  const parsed = parseSpecValue(value);
  if (!parsed) return NOT_FLAGGED;

  if (parsed.number > band.max && parsed.number <= band.absurd) {
    return {
      flagged: true,
      reason: `nilai ${key} (${value}) di atas rata-rata, periksa kembali apakah benar`,
    };
  }
  return NOT_FLAGGED;
}

export const CATEGORY_PRICE_RANGE: Record<string, [number, number]> = {
  laptop: [3_000_000, 80_000_000],
  smartphone: [500_000, 45_000_000],
  tablet: [1_000_000, 30_000_000],
  monitor: [500_000, 30_000_000],
  keyboard: [50_000, 10_000_000],
  mouse: [20_000, 3_000_000],
  headphone: [50_000, 15_000_000],
  speaker: [50_000, 20_000_000],
  printer: [500_000, 30_000_000],
  kamera: [1_000_000, 100_000_000],
  tv: [1_000_000, 150_000_000],
  ac: [2_000_000, 30_000_000],
  kulkas: [1_500_000, 40_000_000],
  "mesin-cuci": [1_000_000, 30_000_000],
};

const rupiah = (value: number) => `Rp${Math.round(value).toLocaleString("id-ID")}`;

export function priceSuspicion(
  categoryName: string | null,
  price: number | null | undefined
): SpecVerdict {
  if (price === null || price === undefined || Number.isNaN(Number(price))) return NOT_FLAGGED;
  const value = Number(price);

  if (value <= 0) {
    return { flagged: true, reason: "harga 0 atau negatif, periksa kembali" };
  }

  const cat = canonicalCategory(categoryName);
  const range = cat ? CATEGORY_PRICE_RANGE[cat] : undefined;
  if (!range) return NOT_FLAGGED;

  const [low, high] = range;
  if (value < low * 0.2) {
    return {
      flagged: true,
      reason: `harga ${rupiah(value)} sangat jauh di bawah harga wajar kategori ${cat} (mulai sekitar ${rupiah(low)}): cek lagi harganya udah bener atau belum`,
    };
  }
  if (value > high * 2) {
    return {
      flagged: true,
      reason: `harga ${rupiah(value)} sangat jauh di atas harga wajar kategori ${cat} (sampai sekitar ${rupiah(high)}): cek lagi harganya udah bener atau belum`,
    };
  }
  return NOT_FLAGGED;
}