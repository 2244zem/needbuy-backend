import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkTextQuality,
  hasConsonantJumble,
  isEmojiOnly,
  isShouting,
  isSingleCharRepeat,
  wordyRatio,
} from "./textQuality";

const codes = (text: string) => checkTextQuality(text).map((i) => i.code);

test("teks kosong menghasilkan satu masalah critical dan berhenti", () => {
  const issues = checkTextQuality("   ");
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "EMPTY_TEXT");
  assert.equal(issues[0].severity, "critical");
});

test("deskripsi hanya emoji ditolak", () => {
  assert.equal(isEmojiOnly("🔥🔥🔥"), true);
  assert.ok(codes("🔥🔥🔥").includes("EMOJI_ONLY"));
});

test("emoji bersama teks bukan pelanggaran", () => {
  assert.equal(isEmojiOnly("laptop bekas mulus 🔥"), false);
});

test("placeholder ketahuan sebagai critical", () => {
  assert.ok(codes("lorem ipsum dolor sit amet").includes("PLACEHOLDER_TEXT"));
});

test("karakter berulang total lebih parah daripada ejaan berlebihan", () => {
  assert.equal(isSingleCharRepeat("aaaaaaa"), true);
  const total = checkTextQuality("aaaaaaaaaaaa").find((i) => i.code === "REPEATED_CHARS");
  assert.equal(total?.severity, "critical");

  assert.equal(
    checkTextQuality("laptop ini bagusss sekali dan awet").find(
      (i) => i.code === "REPEATED_CHARS"
    ),
    undefined
  );

  const berlebihan = checkTextQuality("laptop ini bagussss sekali dan awet").find(
    (i) => i.code === "REPEATED_CHARS"
  );
  assert.equal(berlebihan?.severity, "warning");
});

test("kata Indonesia yang sah tidak dituduh gibberish", () => {
  const text = "melayani transportasi barang antarkota dengan armada terawat";
  assert.equal(hasConsonantJumble(text), false);
  assert.ok(!codes(text).includes("GIBBERISH_TEXT"));
});

test("huruf acak ketahuan sebagai gibberish", () => {
  const text = "sdfghjkl !!!!!!!! ,,,,,,,, ????????";
  assert.equal(hasConsonantJumble(text), true);
  assert.ok(wordyRatio(text) < 0.5);
  assert.ok(codes(text).includes("GIBBERISH_TEXT"));
});

test("deskripsi terlalu pendek diberi peringatan", () => {
  assert.ok(codes("murah").includes("TEXT_TOO_SHORT"));
});

test("deskripsi sangat panjang hanya berlevel info", () => {
  const issues = checkTextQuality("a b ".repeat(2000));
  assert.equal(issues.find((i) => i.code === "TEXT_TOO_LONG")?.severity, "info");
});

test("kapital berlebihan hanya berlevel info", () => {
  assert.equal(isShouting("BARANG MURAH BANGET"), true);
  assert.equal(
    checkTextQuality("BARANG MURAH BANGET GRATIS ONGKIR").find((i) => i.code === "ALL_CAPS")
      ?.severity,
    "info"
  );
});

test("deskripsi yang baik tidak menghasilkan masalah sama sekali", () => {
  const text =
    "Laptop Asus Vivobook 14 inch, RAM 16GB, SSD 512GB, kondisi mulus, " +
    "garansi resmi masih 8 bulan, lengkap dengan charger dan dus.";
  assert.deepEqual(checkTextQuality(text), []);
});

test("checkTextQuality tidak pernah melempar untuk input aneh", () => {
  for (const input of ["", "   ", "\n\t", "🔥", "a", "!@#$%^&*()"]) {
    assert.doesNotThrow(() => checkTextQuality(input));
  }
});
