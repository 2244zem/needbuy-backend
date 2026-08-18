import assert from "node:assert/strict";
import { test } from "node:test";
import { changePasswordSchema, updateProfileSchema } from "./users.schema";

test("updateProfile menerima name dan phone saja", () => {
  assert.equal(updateProfileSchema.safeParse({ name: "Rani" }).success, true);
  assert.equal(updateProfileSchema.safeParse({ phone: "081234567890" }).success, true);
  assert.equal(updateProfileSchema.safeParse({ name: "Rani", phone: null }).success, true);
});

test("updateProfile menolak role, email, dan passwordHash", () => {
  for (const payload of [
    { role: "ADMIN" },
    { email: "penyerang@example.com" },
    { passwordHash: "$2a$12$apa-saja" },
    { id: "uuid-orang-lain" },
    { name: "Rani", role: "ADMIN" },
  ]) {
    assert.equal(
      updateProfileSchema.safeParse(payload).success,
      false,
      `payload ${JSON.stringify(payload)} seharusnya ditolak`
    );
  }
});

test("updateProfile menerima avatarUrl http(s) dan null, menolak sisanya", () => {
  assert.equal(
    updateProfileSchema.safeParse({ avatarUrl: "https://api.needbuy.test/uploads/abc" }).success,
    true
  );
  assert.equal(updateProfileSchema.safeParse({ avatarUrl: null }).success, true);
  assert.equal(updateProfileSchema.safeParse({ avatarUrl: "javascript:alert(1)" }).success, false);
  assert.equal(updateProfileSchema.safeParse({ avatarUrl: "data:image/png;base64,AA" }).success, false);
  assert.equal(updateProfileSchema.safeParse({ avatarUrl: "bukan-url" }).success, false);
});

test("updateProfile menolak body kosong", () => {
  assert.equal(updateProfileSchema.safeParse({}).success, false);
});

test("updateProfile memvalidasi panjang nama dan format telepon", () => {
  assert.equal(updateProfileSchema.safeParse({ name: "a" }).success, false);
  assert.equal(updateProfileSchema.safeParse({ name: "a".repeat(101) }).success, false);
  assert.equal(updateProfileSchema.safeParse({ phone: "bukan-nomor" }).success, false);
});

test("changePassword mewajibkan kedua field", () => {
  assert.equal(changePasswordSchema.safeParse({ currentPassword: "lama123" }).success, false);
  assert.equal(changePasswordSchema.safeParse({ newPassword: "baru12345" }).success, false);
  assert.equal(
    changePasswordSchema.safeParse({ currentPassword: "lama123", newPassword: "baru12345" })
      .success,
    true
  );
});

test("changePassword menolak password baru yang sama dengan yang lama", () => {
  const result = changePasswordSchema.safeParse({
    currentPassword: "samasama123",
    newPassword: "samasama123",
  });
  assert.equal(result.success, false);
});

test("changePassword menegakkan panjang minimum password baru", () => {
  assert.equal(
    changePasswordSchema.safeParse({ currentPassword: "lama1234", newPassword: "pendek" }).success,
    false
  );
});

test("changePassword menolak field asing", () => {
  const result = changePasswordSchema.safeParse({
    currentPassword: "lama1234",
    newPassword: "baru12345",
    userId: "korban-lain",
  });
  assert.equal(result.success, false);
});
