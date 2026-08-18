import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import YAML from "yaml";

process.env.DATABASE_URL ??= "postgresql://user:postgres@localhost:5432/needbuy_db";
process.env.JWT_SECRET ??= "needbuyadalahyangterbaikanjay";
process.env.JWT_REFRESH_SECRET ??= "cihuyslebewmeledakawaw";
process.env.MIDTRANS_SERVER_KEY ??= "SB-Mid-server-contracttestkey000";
process.env.MIDTRANS_CLIENT_KEY ??= "SB-Mid-client-gwY1D0zPCGXyiLfY";
process.env.LOG_LEVEL ??= "silent";

const specPath = path.resolve(process.cwd(), "docs", "swagger.yaml");

function documentedOperations(): string[] {
  const document = YAML.parse(fs.readFileSync(specPath, "utf8")) as {
    paths: Record<string, Record<string, unknown>>;
  };

  const operations: string[] = [];
  for (const [route, methods] of Object.entries(document.paths)) {
    for (const method of Object.keys(methods)) {
      if (["get", "post", "put", "patch", "delete"].includes(method)) {
        operations.push(`${method.toUpperCase()} ${route}`);
      }
    }
  }
  return operations.sort();
}

test("swagger.yaml ada dan bisa diparsing", () => {
  assert.ok(fs.existsSync(specPath), "docs/swagger.yaml tidak ditemukan");
  const document = YAML.parse(fs.readFileSync(specPath, "utf8"));
  assert.equal(document.openapi?.startsWith("3."), true, "harus OpenAPI 3.x");
  assert.ok(document.paths, "tidak ada blok paths");
});

test("setiap route terdaftar terdokumentasi di swagger.yaml", async () => {
  const { listRegisteredRoutes } = await import("./router.js");
  const registered = listRegisteredRoutes();
  const documented = new Set(documentedOperations());

  const undocumented = registered.filter((operation) => !documented.has(operation));
  assert.deepEqual(
    undocumented,
    [],
    `Route ini ada di kode tapi tidak ada di swagger.yaml:\n${undocumented.join("\n")}`
  );
});

test("setiap endpoint yang didokumentasikan benar-benar ada", async () => {
  const { listRegisteredRoutes } = await import("./router.js");
  const registered = new Set(listRegisteredRoutes());

  const phantom = documentedOperations().filter((operation) => !registered.has(operation));
  assert.deepEqual(
    phantom,
    [],
    `Endpoint ini ada di swagger.yaml tapi tidak terdaftar di kode:\n${phantom.join("\n")}`
  );
});

test("route yang dikumpulkan tidak kosong", async () => {
  const { listRegisteredRoutes } = await import("./router.js");
  assert.ok(listRegisteredRoutes().length > 30, "introspeksi route tampaknya rusak");
});
