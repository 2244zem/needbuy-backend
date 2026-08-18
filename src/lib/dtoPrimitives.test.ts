import { Prisma } from "@prisma/client";
import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { isoDate, money, nullableIsoDate, nullableMoney, rating } from "./dtoPrimitives";

test("Decimal, number, dan string sama-sama menjadi string", () => {
  assert.equal(money.parse(new Prisma.Decimal("1150000")), "1150000");
  assert.equal(money.parse(1150000), "1150000");
  assert.equal(money.parse("1150000"), "1150000");
});

test("presisi uang tidak hilang lewat float", () => {
  const besar = new Prisma.Decimal("9007199254740993");
  assert.equal(money.parse(besar), "9007199254740993");
  assert.notEqual(String(Number("9007199254740993")), "9007199254740993");
});

test("desimal rupiah dipertahankan apa adanya", () => {
  assert.equal(money.parse(new Prisma.Decimal("1500.75")), "1500.75");
});

test("uang yang boleh kosong menerima null", () => {
  assert.equal(nullableMoney.parse(null), null);
  assert.equal(nullableMoney.parse(new Prisma.Decimal("500")), "500");
});

test("Date menjadi ISO 8601 dan string ISO dibiarkan", () => {
  const d = new Date("2026-08-11T09:00:00.000Z");
  assert.equal(isoDate.parse(d), "2026-08-11T09:00:00.000Z");
  assert.equal(isoDate.parse("2026-08-11T09:00:00.000Z"), "2026-08-11T09:00:00.000Z");
  assert.equal(nullableIsoDate.parse(null), null);
});

test("rating tetap string, sama seperti serialisasi Decimal sebelumnya", () => {
  assert.equal(rating.parse(new Prisma.Decimal("4.2")), "4.2");
  assert.equal(typeof rating.parse(4.2), "string");
});

test("parse MEMOTONG field yang tidak dideklarasikan", () => {
  const skema = z.object({ id: z.string(), price: money });
  const dariPrisma = {
    id: "p1",
    price: new Prisma.Decimal("1000"),
    passwordHash: "$2a$12$rahasia",
    internalNote: "jangan dikirim",
  };

  const hasil = skema.parse(dariPrisma);
  assert.deepEqual(hasil, { id: "p1", price: "1000" });
  assert.ok(!("passwordHash" in hasil));
  assert.ok(!("internalNote" in hasil));
});

test("field wajib yang hilang membuat parse gagal, bukan mengirim setengah data", () => {
  const skema = z.object({ id: z.string(), total: money });
  assert.throws(() => skema.parse({ id: "o1" }));
});
