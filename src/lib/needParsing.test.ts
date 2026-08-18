import assert from "node:assert/strict";
import { test } from "node:test";
import {
  detectCategory,
  detectGoal,
  extractLocation,
  extractPreferences,
  extractRequirements,
  normalizeText,
  normalizeValue,
  tokenize,
} from "./needParsing";

test("mengekstrak requirement bernilai angka dari kalimat bebas", () => {
  const found = extractRequirements("laptop RAM 16GB storage 512GB");
  const byKey = Object.fromEntries(found.map((r) => [r.key, r.value]));
  assert.equal(byKey.ram, "16GB");
  assert.equal(byKey.storage, "512GB");
});

test("penanda 'minimal' menjadikan requirement HARD", () => {
  const found = extractRequirements("RAM minimal 8GB");
  assert.equal(found.length, 1);
  assert.equal(found[0].key, "ram");
  assert.equal(found[0].isHard, true);
});

test("semua penanda wajib dikenali", () => {
  for (const marker of ["minimal", "min", "wajib", "harus", "setidaknya", "at least"]) {
    const found = extractRequirements(`RAM ${marker} 8GB`);
    assert.equal(found[0]?.isHard, true, `penanda "${marker}" tidak terdeteksi`);
  }
});

test("tanpa penanda, requirement bersifat SOFT", () => {
  const found = extractRequirements("laptop RAM 16GB");
  assert.equal(found[0].isHard, false);
});

test("penanda pada satu atribut tidak bocor ke atribut lain yang jauh", () => {
  const text = "RAM minimal 8GB, dan kalau bisa layar 14 inch";
  const found = extractRequirements(text);
  const ram = found.find((r) => r.key === "ram");
  const layar = found.find((r) => r.key === "layar");
  assert.equal(ram?.isHard, true);
  assert.equal(layar?.isHard, false, "layar tidak disebut wajib, tidak boleh jadi hard");
});

test("atribut yang disebut tanpa nilai diabaikan", () => {
  assert.deepEqual(extractRequirements("butuh RAM besar"), []);
});

test("requirement dideduplikasi per key, sebutan pertama menang", () => {
  const found = extractRequirements("RAM 8GB lalu RAM 32GB");
  const ramEntries = found.filter((r) => r.key === "ram");
  assert.equal(ramEntries.length, 1);
  assert.equal(ramEntries[0].value, "8GB");
});

test("teks tanpa atribut menghasilkan daftar kosong", () => {
  assert.deepEqual(extractRequirements("saya butuh sesuatu yang bagus"), []);
});

test("preference dikenali dan selalu berbobot 1", () => {
  const prefs = extractPreferences("laptop yang ringan dan awet");
  const keys = prefs.map((p) => p.key).sort();
  assert.deepEqual(keys, ["berat", "daya tahan"]);
  assert.ok(prefs.every((p) => p.weight === 1));
});

test("preference tidak pernah punya flag isHard", () => {
  const prefs = extractPreferences("laptop ringan");
  assert.ok(prefs.every((p) => !("isHard" in p)));
});

test("teks tanpa frasa preferensi menghasilkan daftar kosong", () => {
  assert.deepEqual(extractPreferences("laptop RAM 16GB"), []);
});

test("lokasi diekstrak dari frasa umum", () => {
  assert.equal(extractLocation("cari laptop di Bandung"), "Bandung");
  assert.equal(extractLocation("seller dari Surabaya"), "Surabaya");
  assert.equal(extractLocation("laptop RAM 16GB"), null);
});

test("lokasi dipotong pada batas panjang kolom", () => {
  const long = `di ${"a".repeat(200)}`;
  const result = extractLocation(long);
  assert.ok(result === null || result.length <= 120);
});

test("kategori ditebak dari kata kunci sehari-hari", () => {
  assert.equal(detectCategory("butuh laptop buat kuliah"), "laptop");
  assert.equal(detectCategory("cari hp murah"), "smartphone");
  assert.equal(detectCategory("pengen beli tws buat olahraga"), "headphone");
  assert.equal(detectCategory("mau beli kulkas dua pintu"), "kulkas");
});

test("kata kunci pendek dicocokkan sebagai kata utuh, bukan substring", () => {
  assert.equal(detectCategory("macbook second"), "laptop");
});

test("kategori dengan kata kunci terbanyak yang menang", () => {
  assert.equal(detectCategory("laptop notebook macbook atau tv"), "laptop");
});

test("teks tanpa kata kunci kategori menghasilkan null", () => {
  assert.equal(detectCategory("sesuatu yang menyenangkan"), null);
});

test("goal diambil dari pola niat beli", () => {
  assert.match(detectGoal("butuh laptop untuk desain grafis") ?? "", /laptop/i);
});

test("goal selalu terisi walau tidak ada pola yang cocok", () => {
  const goal = detectGoal("aduh bingung pilih apa ya sekarang");
  assert.ok(goal && goal.length > 0, "goal tidak boleh null untuk teks berisi");
});

test("goal dari teks kosong adalah null", () => {
  assert.equal(detectGoal("   "), null);
});

test("nilai requirement dinormalisasi supaya bisa dibanding dengan attr_value", () => {
  assert.equal(normalizeValue("8 gb"), "8GB");
  assert.equal(normalizeValue("5000 mah"), "5000mAh");
  assert.equal(normalizeValue("6,5 inch"), '6.5"');
  assert.equal(normalizeValue("120 hz"), "120Hz");
  assert.equal(normalizeValue("12"), "12");
});

test("requirement hasil ekstraksi ikut ternormalisasi", () => {
  const found = extractRequirements("laptop ram 16 gb");
  assert.equal(found.find((r) => r.key === "ram")?.value, "16GB");
});

test("brand dikenali sebagai preference berbobot lebih tinggi", () => {
  const prefs = extractPreferences("mau samsung yang murah");
  const brand = prefs.find((p) => p.key === "brand");
  assert.equal(brand?.value, "Samsung");
  assert.ok(brand!.weight > 1, "brand harus lebih berbobot daripada sifat lunak");
});

test("brand tidak pernah menjadi hard requirement", () => {
  for (const pref of extractPreferences("pokoknya harus apple")) {
    assert.ok(!("isHard" in pref), "preference tidak boleh membawa isHard");
  }
});

test("'hp' dibaca sebagai handphone, bukan merek Hewlett-Packard", () => {
  const prefs = extractPreferences("cari hp murah");
  assert.equal(prefs.find((p) => p.key === "brand"), undefined);
  assert.equal(detectCategory("cari hp murah"), "smartphone");
});

test("kota dikenali dari daftar tanpa terseret pola preposisi", () => {
  assert.equal(extractLocation("di daerah bandung yang dingin"), "Bandung");
  assert.equal(extractLocation("seller jabodetabek aja"), "Jabodetabek");
});

test("tokenize membuang stopword dan kata satu huruf", () => {
  const tokens = tokenize("saya butuh laptop yang ringan banget");
  assert.deepEqual(tokens.sort(), ["butuh", "laptop", "ringan"]);
});

test("normalizeText merapikan angka bergaya Indonesia", () => {
  assert.equal(normalizeText("Rp12.000.000"), "rp 12000000");
  assert.equal(normalizeText("12,5   juta"), "12.5 juta");
});

test("kategori terbaca dari kata sehari-hari dan singkatan", () => {
  assert.equal(detectCategory("cari hape murce"), "smartphone");
  assert.equal(detectCategory("butuh lepi bwt kuliah"), "laptop");
  assert.equal(detectCategory("mau beli magic com"), "rice-cooker");
  assert.equal(detectCategory("pengen sepatu lari"), "sepatu");
  assert.equal(detectCategory("nyari hedset murah"), "headphone");
});

test("huruf berulang tidak menghalangi pembacaan kategori", () => {
  assert.equal(detectCategory("pengen laptopppp gaming"), "laptop");
  assert.equal(detectCategory("hp bagusss"), "smartphone");
});

test("requirement terbaca walau ditulis singkat", () => {
  const reqs = extractRequirements("ram minimal 8gb, batre 5000mah");
  const ram = reqs.find((r) => r.key === "ram");
  const baterai = reqs.find((r) => r.key === "baterai");
  assert.equal(ram?.value, "8GB");
  assert.equal(ram?.isHard, true);
  assert.equal(baterai?.value, "5000mAh");
});

test("preferensi terbaca dari slang", () => {
  const prefs = extractPreferences("pengen yg mrh dan enteng");
  assert.ok(prefs.some((p) => p.key === "harga" && p.value === "murah"));
  assert.ok(prefs.some((p) => p.key === "berat" && p.value === "ringan"));
});
