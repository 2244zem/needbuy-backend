import assert from "node:assert/strict";
import { test } from "node:test";
import { auditProduct, type ProductForAudit } from "./productAudit";

const laptopBersih: ProductForAudit = {
  name: "Asus Vivobook 14 A1404VA",
  description:
    "Laptop Asus Vivobook 14 inch, kondisi mulus, pemakaian pribadi, " +
    "lengkap dengan charger dan dus. Garansi resmi masih berjalan.",
  sku: "ASUS-VB14-001",
  categoryName: "laptop",
  price: 8_500_000,
  attributes: [
    { key: "RAM", value: "16 GB" },
    { key: "penyimpanan", value: "512 GB" },
    { key: "Processor", value: "Intel Core i5-1335U" },
  ],
};

const codes = (product: ProductForAudit) => auditProduct(product).issues.map((i) => i.code);

test("listing yang rapi tidak menghasilkan masalah dan bernilai EXCELLENT", () => {
  const report = auditProduct(laptopBersih);
  assert.deepEqual(report.issues, []);
  assert.equal(report.score, 100);
  assert.equal(report.grade, "EXCELLENT");
  assert.equal(report.categoryDetected, "laptop");
  assert.match(report.summary, /bersih/i);
});

test("spesifikasi mustahil ditandai critical dan menjatuhkan skor paling dalam", () => {
  const report = auditProduct({
    ...laptopBersih,
    attributes: [...(laptopBersih.attributes ?? []), { key: "RAM", value: "500 GB" }],
  });
  const absurd = report.issues.find((i) => i.code === "ABSURD_SPEC");
  assert.equal(absurd?.severity, "critical");
  assert.ok(report.score < 100);
});

test("spesifikasi wajib yang belum diisi ditagih", () => {
  const report = auditProduct({
    ...laptopBersih,
    attributes: [{ key: "RAM", value: "16 GB" }],
  });
  const missing = report.issues.filter((i) => i.code === "MISSING_SPEC").map((i) => i.field);
  assert.deepEqual(missing.sort(), ["prosesor", "storage"]);
});

test("spesifikasi wajib yang sudah diisi tidak pernah ditagih", () => {
  assert.ok(!codes(laptopBersih).includes("MISSING_SPEC"));
});

test("deskripsi gibberish menurunkan mutu lewat pemeriksaan teks", () => {
  const report = auditProduct({
    ...laptopBersih,
    description: "sdfghjkl !!!!!!!! ,,,,,,,, ????????",
  });
  const gibberish = report.issues.find((i) => i.code === "GIBBERISH_TEXT");
  assert.equal(gibberish?.field, "description");
});

test("deskripsi kosong ditandai, bukan didiamkan", () => {
  assert.ok(codes({ ...laptopBersih, description: "" }).includes("MISSING_DESCRIPTION"));
});

test("nama kosong adalah masalah critical", () => {
  const report = auditProduct({ ...laptopBersih, name: "" });
  assert.equal(report.issues.find((i) => i.code === "MISSING_NAME")?.severity, "critical");
});

test("nama dan deskripsi menyebut merek berbeda ditandai salin tempel", () => {
  const report = auditProduct({
    ...laptopBersih,
    name: "Laptop Asus Vivobook 14",
    description: "Laptop Lenovo Thinkpad bekas, kondisi mulus, lengkap dus dan charger.",
  });
  assert.ok(report.issues.some((i) => i.code === "BRAND_CONFLICT"));
});

test("merek yang sama di nama dan deskripsi tidak ditandai", () => {
  assert.ok(!codes(laptopBersih).includes("BRAND_CONFLICT"));
});

test("spesifikasi tidak relevan dengan kategori ditandai", () => {
  const report = auditProduct({
    ...laptopBersih,
    name: "Kulkas Sharp 2 Pintu",
    description: "Kulkas Sharp dua pintu, hemat listrik, kondisi baik dan terawat.",
    categoryName: "kulkas-2-pintu",
    price: 3_000_000,
    attributes: [{ key: "RAM", value: "16 GB" }],
  });
  assert.ok(report.issues.some((i) => i.code === "IRRELEVANT_SPEC"));
});

test("atribut ganda dengan nilai berbeda ditandai", () => {
  const report = auditProduct({
    ...laptopBersih,
    attributes: [
      { key: "RAM", value: "16 GB" },
      { key: "memori", value: "8 GB" },
      { key: "penyimpanan", value: "512 GB" },
      { key: "Processor", value: "Intel Core i5" },
    ],
  });
  assert.ok(report.issues.some((i) => i.code === "DUPLICATE_ATTRIBUTE"));
});

test("atribut ganda dengan nilai sama bukan pelanggaran", () => {
  const report = auditProduct({
    ...laptopBersih,
    attributes: [
      { key: "RAM", value: "16 GB" },
      { key: "memory", value: "16 GB" },
      { key: "penyimpanan", value: "512 GB" },
      { key: "Processor", value: "Intel Core i5" },
    ],
  });
  assert.ok(!report.issues.some((i) => i.code === "DUPLICATE_ATTRIBUTE"));
});

test("harga janggal ditandai", () => {
  assert.ok(codes({ ...laptopBersih, price: 50_000 }).includes("SUSPICIOUS_PRICE"));
  assert.ok(codes({ ...laptopBersih, price: 0 }).includes("SUSPICIOUS_PRICE"));
});

test("harga bukan angka ditandai terpisah dari harga janggal", () => {
  assert.ok(codes({ ...laptopBersih, price: "delapan juta" }).includes("INVALID_PRICE"));
});

test("SKU kosong hanya berlevel info", () => {
  const report = auditProduct({ ...laptopBersih, sku: "" });
  assert.equal(report.issues.find((i) => i.code === "MISSING_SKU")?.severity, "info");
  assert.equal(report.grade, "EXCELLENT", "satu catatan info tidak boleh menurunkan grade");
});

test("skor tidak pernah keluar dari 0-100", () => {
  const hancur = auditProduct({
    name: "",
    description: "",
    sku: "",
    categoryName: "laptop",
    price: -1,

    attributes: Array.from({ length: 30 }, (_, i) => ({ key: "RAM", value: `${9000 + i} GB` })),
  });
  assert.ok(hancur.score >= 0 && hancur.score <= 100);
  assert.equal(hancur.score, 0, "penalti jauh melebihi 100 harus terpotong di 0");
  assert.equal(hancur.grade, "POOR");
});

test("produk tanpa data sama sekali tidak melempar", () => {
  assert.doesNotThrow(() => auditProduct({}));
  assert.equal(auditProduct({}).categoryDetected, null);
});

test("atribut yang tidak dikenal knowledge base diabaikan diam-diam", () => {
  const report = auditProduct({
    ...laptopBersih,
    attributes: [...(laptopBersih.attributes ?? []), { key: "bahan casing", value: "aluminium" }],
  });
  assert.deepEqual(report.issues, []);
});
