# NeedBuy Backend — Design Spec

Date: 2026-08-10
Status: approved (revision 2 — supersedes revision 1)
Scope: backend API only. No frontend, no UI.

Three documents govern this build:

1. **Master Engineering Rules** (the ruleset supplied 2026-08-10) — highest authority.
2. **`CLAUDE.md`** — business flow (§4), algorithms (§5), Midtrans rules (§6).
3. **This spec** — how those get built in code.

Where the Master Rules and `CLAUDE.md` conflict, the Master Rules win and `CLAUDE.md`
gets amended. Two such amendments are required by this revision and listed in §12.

---

## 1. Starting state

The repository is a skeleton. Preserved as-is:

- `prisma/schema.prisma` — 20 models, matches `CLAUDE.md` §3. Extended (not rewritten) per §3 below.
- `prisma/migrations/20260810000000_init/migration.sql` — hand-written mirror of the schema. Never edited; new changes get a new migration.
- `prisma/seed.ts`
- `src/server.ts` — express + cors + `express.json()` + `GET /health`. Becomes a thin bootstrap; app assembly moves to `src/app/`.
- `src/config/prisma.ts`, `src/config/midtrans.ts`

There are no routes, controllers, services, middlewares, auth, error handling,
validation, or tests. Nothing is being overwritten because nothing exists.

Empty top-level `config/ controllers/ lib/ middlewares/ routes/ services/ types/`
duplicate `src/*` and are dead. Delete them.

### 1.1 Build-config defects to fix first

1. `tsconfig.json` has `"rootDir": "src"` while `"include"` also lists `prisma/seed.ts`,
   which sits outside `rootDir`. `npm run build` fails on this. Fix: drop
   `prisma/seed.ts` from `include`; it runs through `ts-node` and needs no compiling.
2. The `@/*` path alias has no runtime resolver installed, so such imports type-check
   and then crash at run time. Fix: **relative imports everywhere.** The alias may
   remain declared but unused; no source file may import through it.

---

## 2. Dependencies

Approved additions, and nothing beyond them:

| Package | Rule | Why not hand-rolled |
|---|---|---|
| `helmet` | §10 secure headers | The correct header set changes over time; tracking it by hand is a standing liability |
| `express-rate-limit` | §10, §33 | Correct window accounting, standard `RateLimit-*` headers |
| `swagger-ui-express` | §8, §34 | Serves `docs/swagger.yaml` as browsable UI |
| `pino`, `pino-http` | §30, §31 | Structured JSON logs with a redaction list — the redaction is the point |
| `supertest` (dev) | §33 | Integration tests against the Express app |
| `tsx` (dev) | §33 | See below — the Node 20 test runner cannot discover `.ts` files on its own |
| `@types/supertest`, `@types/swagger-ui-express` (dev) | — | Types |
| `yaml` | §8 | Parse `swagger.yaml` for the UI and for the contract-drift test |

`tsx` is load-bearing, not convenience. Node 20's built-in test runner only discovers
files matching `**/*.test.{js,cjs,mjs}`; `--require ts-node/register` changes how a file
is *loaded*, not which files are *found*, so a `.ts` test suite is silently discovered
as zero tests — a green run that asserts nothing. `tsx --test` extends discovery to
`.ts` and expands the glob itself, which also keeps the command working under
PowerShell, where the shell does not expand `src/**/*.test.ts`. `ts-node` stays for
`prisma/seed.ts`.

Everything else comes from what is already installed (`express`, `@prisma/client`,
`zod`, `bcryptjs`, `jsonwebtoken`, `cors`, `dotenv`, `midtrans-client`, `uuid`) or the
Node 20 standard library (`node:crypto`, `node:test`, `node:assert`).

---

## 3. Schema changes

Four gaps between the Master Rules and the existing schema, each approved. One new
migration, `20260810010000_needbuy_gaps`. The init migration is **not** edited
(`CLAUDE.md` §8).

### 3.1 `saved_products` (new table)

§6 lists `SAVED_PRODUCTS` as a core entity; it does not exist.

```prisma
model SavedProduct {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  productId String   @map("product_id")
  createdAt DateTime @default(now()) @map("created_at")

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([userId, productId])
  @@index([userId])
  @@map("saved_products")
}
```

Plus `savedProducts SavedProduct[]` on `User` and on `Product`.

### 3.2 `idempotency_keys` (new table)

§18. Without storage, a double-clicked checkout creates two sets of orders and
decrements stock twice — the most expensive failure in the system.

```prisma
model IdempotencyKey {
  id           String   @id @default(uuid())
  key          String   @unique
  userId       String   @map("user_id")
  endpoint     String
  requestHash  String   @map("request_hash")
  statusCode   Int      @map("status_code")
  responseBody Json     @map("response_body")
  createdAt    DateTime @default(now()) @map("created_at")

  @@index([createdAt])
  @@map("idempotency_keys")
}
```

`requestHash` is a sha256 of the canonicalised request body. Same key **and** same
hash replays the stored response; same key with a *different* hash is a client bug and
returns 409 `IDEMPOTENCY_KEY_REUSED`. No relation to `User` — the row must survive
user deletion for audit purposes, so `userId` is a plain column.

### 3.3 `refresh_tokens` (new table)

§10 refresh token rotation. This reverses revision 1's access-token-only decision.

```prisma
model RefreshToken {
  id           String    @id @default(uuid())
  userId       String    @map("user_id")
  tokenHash    String    @unique @map("token_hash")
  expiresAt    DateTime  @map("expires_at")
  revokedAt    DateTime? @map("revoked_at")
  replacedById String?   @unique @map("replaced_by_id")
  createdAt    DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("refresh_tokens")
}
```

Plus `refreshTokens RefreshToken[]` on `User`. Only the sha256 hash is stored — a
database leak must not yield usable tokens.

### 3.4 `order_items.productName` (new column)

§27 requires `ORDER_ITEMS` to preserve the historical product. Seller history is
already safe via `orders.sellerId`, but the product *name* is read live through the
relation, so a rename rewrites past orders.

```prisma
productName String @map("product_name")
```

Snapshotted at order creation alongside `price` and `subtotal`. A column addition,
which `CLAUDE.md` §9.2 prefers over a new table.

### 3.5 Deliberately not added

**`audit_logs` and an admin module.** §5 lists an `admin/` module and §10 wants audit
logging for sensitive admin actions, but `CLAUDE.md` §4–§5 define no admin operations
at all. Building an audit table for actions that do not exist is speculative. When
admin operations are specified, this returns as its own BACKEND GAP report.

---

## 4. Architecture

**Modular by domain**, per Master Rules §3 and §5. This supersedes `CLAUDE.md` §2's
flat layout (amendment in §12).

```
src/
├── server.ts                  # bootstrap only: load env, create app, listen
├── app/
│   ├── index.ts               # buildApp(): middleware chain, mount v1 router, error handler last
│   └── router.ts              # mounts every module router under /api/v1
├── config/
│   ├── env.ts                 # zod-validated process.env, parsed once at boot
│   ├── prisma.ts              # existing — PrismaClient singleton
│   ├── midtrans.ts            # existing — Snap client, isProduction hardcoded false
│   └── logger.ts              # pino instance + redaction list
├── middleware/
│   ├── auth.ts                # requireAuth, requireRole
│   ├── validate.ts            # zod body/query/params
│   ├── idempotency.ts         # Idempotency-Key capture and replay
│   ├── rateLimit.ts           # named limiters: auth, write, webhook
│   ├── requestContext.ts      # request id, pino-http binding
│   ├── notFound.ts            # unmatched route -> 404 AppError
│   └── errorHandler.ts        # single exit point for every error
├── lib/                       # pure, synchronous, no I/O, unit-testable without a DB
│   ├── apiError.ts            # AppError + named constructors
│   ├── response.ts            # ok() / fail() envelope builders
│   ├── pagination.ts          # page/limit -> skip/take, meta builder
│   ├── orderNumber.ts         # NB-{timestamp}-{random}
│   ├── scoringWeights.ts      # the six weights + sum assertion
│   ├── scoring.ts             # six component scores + match_score
│   ├── ranking.ts             # label thresholds, explanation text
│   ├── parseBudget.ts         # "12 juta" / "Rp12.000.000" / "12jt" -> Decimal
│   ├── attributeMatch.ts      # hard/soft requirement satisfaction predicate
│   └── hash.ts                # sha256 helpers (idempotency, refresh tokens)
├── types/
│   ├── express.d.ts           # Request augmentation: user, requestId, idempotency
│   └── index.ts               # shared DTOs
└── modules/
    ├── auth/            {routes,controller,service,schema}.ts
    ├── users/           {routes,controller,service,schema}.ts
    ├── addresses/       {routes,controller,service,schema}.ts
    ├── categories/      {routes,controller,service,schema}.ts
    ├── sellers/         {routes,controller,service,schema}.ts
    ├── products/        {routes,controller,service,schema}.ts
    ├── needs/           {routes,controller,service,schema}.ts + interpreter.service.ts
    ├── recommendations/ {routes,controller,schema}.ts + matching.service.ts, ranking.service.ts
    ├── shopping-plans/  {routes,controller,service,schema}.ts
    ├── cart/            {routes,controller,service,schema}.ts
    ├── checkout/        {routes,controller,service,schema}.ts
    ├── orders/          {routes,controller,service,schema}.ts
    ├── payments/        {routes,controller,service,schema}.ts + webhook.service.ts
    ├── reviews/         {routes,controller,service,schema}.ts
    └── saved-products/  {routes,controller,service,schema}.ts
```

### 4.1 Responsibility boundaries

| File | Does | Must not |
|---|---|---|
| `routes.ts` | path + verb + middleware composition | contain logic of any kind |
| `controller.ts` | read `req`, call one service function, return `ok(...)` | run Prisma queries; own status-transition or pricing logic |
| `service.ts` | business logic, Prisma access, transactions | touch `req`/`res` |
| `schema.ts` | zod schemas for body/query/params | anything else |
| `lib/*` | pure functions | be async, read env, touch Prisma |

**No repository layer.** §4 makes it optional ("when repository abstraction is used").
An interface with exactly one implementation per domain is indirection with no current
payoff; services own Prisma directly. If a second data source ever appears, that is the
moment to introduce it.

**No giant files** (§5): every module owns its own routes, controller, service, and
schema. There is no global `routes.ts`, no global `controller.ts`, no
`needbuy.service.ts`. `app/router.ts` only mounts — it holds no handlers.

---

## 5. Cross-cutting concerns

### 5.1 Versioning and base URL

Every route lives under `/api/v1`, including the Midtrans webhook, now at
`POST /api/v1/payments/midtrans/webhook` (§32). Nothing is deployed yet, so there is
no migration cost and this is the cheapest possible moment.

Consequences, all handled in the implementation plan:
- `.env.example` `MIDTRANS_NOTIFICATION_URL` updated to the versioned path
- `CLAUDE.md` §6.3 amended (see §12)
- the sandbox dashboard "Payment Notification URL" must be re-registered — a manual step, called out in the plan

`API_BASE_URL` is added to `config/env.ts` and `.env.example`, defaulting to
`http://localhost:4000`. Dev value:
`https://<domain-ngrok-kamu>.ngrok-free.dev`. It is read in exactly two places —
the Swagger `servers` block and the Midtrans notification URL — and appears nowhere
else in source (§7).

`GET /health` (liveness, no dependencies) and `GET /ready` (readiness, runs
`SELECT 1` through Prisma) sit **outside** `/api/v1` and outside rate limiting (§31).
Neither reveals versions, connection strings, or dependency detail — `ready` returns
`{ status: "ready" | "degraded" }` and nothing more.

### 5.2 Response envelope

```ts
{ success: true,  data: T, meta?: { page, limit, total, totalPages } }
{ success: false, error: { code: string, message: string, fields?: [...] } }
```

`lib/response.ts` exports `ok(data, meta?)` and `fail(code, message, fields?)`.
Controllers never hand-build the object (§9).

### 5.3 Errors

`lib/apiError.ts` exports `AppError` carrying `status`, `code` (stable
SCREAMING_SNAKE), and a client-safe `message`, plus named constructors
(`AppError.notFound`, `.forbidden`, `.conflict`, …).

`middleware/errorHandler.ts` is registered **last** and is the only place that writes
an error response (§14):

| Condition | Status | Code |
|---|---|---|
| `AppError` | `err.status` | `err.code` |
| `ZodError` | 422 | `VALIDATION_ERROR` + `fields: [{ path, message }]` |
| malformed JSON body | 400 | `BAD_REQUEST` |
| `PrismaClientKnownRequestError` `P2002` | 409 | `CONFLICT` |
| `PrismaClientKnownRequestError` `P2025` | 404 | `NOT_FOUND` |
| rate limiter rejection | 429 | `TOO_MANY_REQUESTS` |
| `PrismaClientInitializationError`, Midtrans unreachable | 503 | `SERVICE_UNAVAILABLE` |
| unmatched route | 404 | `ROUTE_NOT_FOUND` |
| anything else | 500 | `INTERNAL_ERROR`, message `"Internal server error"` |

The 500 branch logs the real error server-side with the request id and returns nothing
else. Stack traces, credentials, tokens, password hashes, and payment secrets never
reach a response body (§14) — the handler builds its output only from the table above,
never from `err.message` on the unknown branch.

Express 4 does not forward async rejections, so every controller is wrapped in a small
`asyncHandler`.

### 5.4 Logging and observability

`config/logger.ts` exports a `pino` instance; `pino-http` binds it per request (§30,
§31). Every request gets a `requestId` (incoming `X-Request-Id` if present, else a
uuid), echoed on the response and attached to every log line and every 500 response
body, so a user-reported error maps to a log entry without exposing internals.

Redaction list, enforced in the pino config rather than by discipline:
`req.headers.authorization`, `req.headers.cookie`, `req.body.password`,
`req.body.passwordConfirmation`, `req.body.refreshToken`, `*.snapToken`,
`*.tokenHash`, `*.passwordHash`, `*.signature_key`, `MIDTRANS_SERVER_KEY`,
`JWT_SECRET`, `JWT_REFRESH_SECRET`.

Prisma is constructed with query-event logging; queries slower than 300 ms log at
`warn` with duration (§31 database query monitoring). Every outbound Midtrans call is
wrapped in a timer and logs success or failure with duration (§31 external service
failure tracking). Latency per request comes from `pino-http` by default.

### 5.5 Validation and mass-assignment protection

`validate({ body?, query?, params? })` parses each present schema and **replaces**
`req.body` / `req.query` / `req.params` with the parsed result, so controllers get
coerced, typed values. Failures throw `ZodError` → 422 (§12).

Zod schemas use `.strict()`, so unknown keys are rejected rather than ignored. Services
then build Prisma payloads **field by field** — never `data: req.body`, never a spread
of client input (§13). This is doubled deliberately: `.strict()` catches the client
mistake loudly, explicit mapping means a schema slip cannot become a privilege
escalation. `role`, `rating`, `soldCount`, `isActive` on foreign records, and every
`*Id` owner field are server-assigned and never accepted from a request body.

Validated at every public endpoint (§12): required fields, types, string length,
numeric range, enums, uuid format for ids, decimal format for money, positive integers
for quantities, `page`/`limit` bounds (limit capped at 100), sort fields against an
allowlist, filter fields against an allowlist, and URL format for image URLs.

### 5.6 Money

All money is `Prisma.Decimal` (§16, `CLAUDE.md` §7) — never `number`, never `Float`.
Arithmetic uses Decimal methods (`.plus`, `.minus`, `.times`, `.lte`), never JS
operators. Zod accepts money as a string or number and converts at the boundary.

**No total, price, subtotal, or stock figure is ever accepted from a client** (§16,
§17, §25). Cart totals, plan totals, order subtotals, shipping, and `gross_amount`
sent to Midtrans are all recomputed server-side from `products.price` and the stored
snapshots. Request bodies carry `productId` and `quantity` and nothing financial.

Scoring is the sole exception and works in plain `number`: scores are 0–100 ratios,
never currency, and never touch a balance. `matchScore` is rounded to two decimals
before hitting the `Decimal(5,2)` column.

### 5.7 Transactions

Every multi-table write runs inside `prisma.$transaction` (§15, `CLAUDE.md` §7):
checkout, order status changes that restore stock, plan recalculation, plan item
replacement, review + rating recalculation, recommendation regeneration, register +
cart creation, refresh token rotation.

**No network call inside a transaction.** This is why Snap creation happens after the
checkout transaction commits (§8.2).

### 5.8 Concurrency and stock

§17 forbids overselling and negative stock. Two layers:

1. Stock decrement is a conditional update inside the checkout transaction:
   `updateMany({ where: { id, stock: { gte: qty } }, data: { stock: { decrement: qty } } })`.
   A returned `count` of 0 means another transaction won the race; the whole checkout
   transaction throws and rolls back. This is atomic at the row level and does not
   depend on the earlier read still being true.
2. The transaction runs at `Serializable` isolation. Prisma surfaces write conflicts as
   `P2034`; checkout retries the transaction up to 3 times before returning 409
   `STOCK_CONFLICT`.

A `CHECK (stock >= 0)` constraint on `products` is added in the same migration as the
final backstop — the database refuses negative stock even if application logic is
wrong.

### 5.9 Rate limiting and request size

`express-rate-limit`, three named limiters (§10):

| Limiter | Applies to | Budget |
|---|---|---|
| `authLimiter` | `POST /auth/login`, `/auth/register`, `/auth/refresh` | 10 / 15 min per IP |
| `writeLimiter` | all authenticated POST/PATCH/PUT/DELETE | 120 / 15 min per user id |
| `globalLimiter` | everything else under `/api/v1` | 300 / 15 min per IP |

The webhook is **not** rate limited — Midtrans retries are legitimate traffic and the
handler is idempotent; limiting it would drop real payment notifications.

Login additionally throttles per account (§10 account lockout): 5 consecutive failures
for one email trigger a 15-minute lockout tracked in memory, returning 429 with a
generic message that does not reveal whether the account exists.

`express.json({ limit: '100kb' })` caps request bodies (§10). `helmet()` supplies
secure headers. CORS is restricted to an `ALLOWED_ORIGINS` env list rather than the
current wildcard `cors()`.

> `ponytail:` the login throttle and the rate limiters are per-process in-memory
> stores. Correct for one node; on a multi-instance deploy they undercount. Move to a
> shared Redis store when a second instance exists.

### 5.10 Idempotency

`middleware/idempotency.ts` applies to `POST /checkout`, `POST /orders/:id/cancel`,
and `POST /payments/:orderId/retry` (§18).

Flow: read the `Idempotency-Key` header (required on these routes; missing → 400
`IDEMPOTENCY_KEY_REQUIRED`). Compute a sha256 of the canonicalised body. Look up the
key:

- **hit, same hash** → replay the stored status and body immediately, no handler runs
- **hit, different hash** → 409 `IDEMPOTENCY_KEY_REUSED`
- **miss** → run the handler, then persist key, hash, status, and response body

The insert uses the unique constraint on `key` as the concurrency guard: two
simultaneous requests race, the loser gets `P2002` and returns 409
`REQUEST_IN_PROGRESS` rather than executing a second checkout.

Only 2xx responses are stored. A failed checkout must stay retryable.

The Midtrans webhook is idempotent by a different route — it is keyed on
`midtransOrderId` and the current `payments.status`, so re-applying `PAID` to an
already-`PAID` payment is a no-op returning 200 (§28).

---

## 6. Authentication and authorization

### 6.1 Tokens

Access token (JWT, short-lived, `JWT_EXPIRES_IN` default `15m`) plus rotating refresh
token (opaque random 256-bit value, `REFRESH_EXPIRES_IN` default `30d`), per §10.

- `POST /auth/register` — bcrypt hash (cost 12), create `users` + the user's `carts`
  row in one transaction so cart reads never handle "no cart yet". Returns both tokens.
- `POST /auth/login` — verify with bcrypt; on failure return 401 with an identical
  message whether the email is unknown or the password is wrong (no account
  enumeration). On success issue both tokens.
- `POST /auth/refresh` — **rotation.** Hash the presented token, look it up, reject if
  missing/expired/revoked. Otherwise, in one transaction: revoke it, create a
  successor, link `replacedById`, return the new pair.
  **Reuse detection:** presenting an already-revoked token means the token leaked, so
  every refresh token for that user is revoked and the response is 401
  `TOKEN_REUSE_DETECTED`, forcing a fresh login.
- `POST /auth/logout` — revoke the presented refresh token.
- `GET /auth/me` — current user, without `passwordHash`.

Only sha256 hashes are stored (§3.3). Password hashes never appear in any response —
services select explicit field lists rather than returning whole Prisma records.

### 6.2 Ownership, not just authentication

§11 is enforced in the **service** layer, not by the router, because a route only knows
who is calling and not what they are reaching for. Every read and write of a
user-scoped resource carries `userId` in the `where` clause rather than fetching first
and comparing afterwards — the failure mode of "fetch, forget to check, return" is
then structurally impossible.

Scoped to the owner: `needs`, `recommendations` (through their need), `carts`,
`cart_items`, `shopping_plans`, `shopping_plan_items`, `orders`, `addresses`,
`saved_products`, `reviews`, `payments` (through their order).

Seller-scoped: a seller may modify only products whose `sellerId` matches their own
`sellers.id`. A mismatch returns **403 `FORBIDDEN`**, not 404 — the caller is a
legitimate seller and hiding existence buys nothing here.

`requireRole('ADMIN')` exists in middleware but no route uses it yet (§3.5).

---

## 7. Need pipeline

The product differentiator, split across `modules/needs/` and
`modules/recommendations/`.

### 7.1 Interpreter — `modules/needs/interpreter.service.ts`

Interface, so an LLM implementation can replace the rule-based one without touching
callers (`CLAUDE.md` §5.1):

```ts
export interface NeedInterpreter {
  interpret(rawInput: string): Promise<ParsedNeed>;
}

export type ParsedNeed = {
  goal: string | null;
  budget: Decimal | null;
  location: string | null;
  categorySlug: string | null;
  requirements: { key: string; value: string; isHard: boolean }[];
  preferences: { key: string; value: string; weight: number }[];
  needsClarification: boolean;
  clarificationQuestions: string[];
  source: 'RULE_BASED' | 'LLM';
};

```

**This pass ships the rule-based implementation only** — deterministic, free,
unit-testable, and by construction it satisfies §19 and §20: there is no AI single
point of failure because there is no AI call. The interface exists so an LLM adapter
is later an addition rather than a rewrite.

Rule-based parsing:

- **Budget** — `lib/parseBudget.ts` handles `12 juta`, `12jt`, `12 jt`, `Rp12.000.000`,
  `Rp 12000000`, `12.000.000`, `12rb`, `12 ribu`. Returns `Decimal | null`.
- **Category** — keyword → `categories.slug` lookup against the seeded table.
- **Requirements** — a keyword → `attr_key` map (`ram`, `storage`, `prosesor`, `warna`,
  …) with a value pattern. Floor-signalling words (`minimal`, `min`, `at least`,
  `wajib`, `harus`) set `isHard: true`; everything else is soft.
- **Preferences** — soft phrasing (`ringan`, `awet`, `hemat baterai`, `sebaiknya`,
  `lebih suka`) becomes preferences at weight `1.0`.

Whatever the source, output is **validated against a zod schema before persistence**
(§19): keys normalised to lowercase, values trimmed and length-capped, weights clamped
to `0..5`, unknown attribute keys dropped. An interpreter — rule-based or LLM — can
never write a shape the schema does not permit.

`needsClarification` is `true` when budget or category is undetermined. **While it is
true, nothing is written to `need_requirements` or `need_preferences`**
(`CLAUDE.md` §5.1); the parse is returned and persisted only on explicit confirm.

**AI failure path (§20):** when an interpreter implementation throws or times out, the
service catches it, logs it, and returns `200` with
`{ interpreted: false, fallback: 'TRADITIONAL_SEARCH', suggestedQuery: <rawInput> }`
plus the `GET /products` query the client should run instead. The need is stored with
status `DRAFT` and the raw input intact. The request never 500s and the marketplace
stays fully usable.

### 7.2 Matching — `modules/recommendations/matching.service.ts`

Filter order is `CLAUDE.md` §5.2 exactly, fail-fast:

1. `products` where `categoryId` matches the need and `isActive = true`
2. drop `stock <= 0`
3. drop `price > budget * 1.15` (tolerance band; survivors in `budget..budget*1.15`
   score low on `budgetScore` and land as `ALTERNATIVE`). When `needs.budget` is
   `null` this filter is skipped and `budgetScore` returns a neutral 100 — a need
   without a budget must not exclude every product.
4. for each **hard** requirement, check `product_attributes`; **one miss excludes the
   product immediately, with no scoring performed** (§22)
5. survivors are scored

Candidates load once with `attributes` and `seller` included. Step 1 and the budget
ceiling are pushed into the `where` clause; steps 2–4 run in memory over that result.

The satisfaction predicate lives in `lib/attributeMatch.ts` as a pure function so it is
testable without a database. Comparison is case-insensitive and whitespace-trimmed on
both key and value. When both sides parse as numbers (`ram = 16GB` vs requirement
`ram >= 8GB`), a hard requirement is satisfied at **greater than or equal**; otherwise
satisfaction is exact string equality after normalisation.

**Preferences never filter** (§23). They enter only through `preferenceScore`. A
product with poor portability still appears if it clears every hard requirement.

### 7.3 Scoring — `lib/scoring.ts`

Pure: `score(candidate, need): ScoreComponents`. Six components, each normalised 0–100
(`CLAUDE.md` §5.3, §21):

| Component | Basis |
|---|---|
| `categoryScore` | 100 exact category, 60 parent/sibling |
| `budgetScore` | 100 at or under budget, decaying linearly to 0 at `budget * 1.15` |
| `requirementScore` | share of **soft** requirements satisfied |
| `preferenceScore` | weighted share of preferences satisfied, normalised by total weight |
| `qualityScore` | `products.rating / 5 * 100` |
| `sellerScore` | `sellers.rating / 5 * 100`, forced to 0 when `status = SUSPENDED` |

`lib/scoringWeights.ts` holds the six weights — 0.15 / 0.20 / 0.20 / 0.20 / 0.15 /
0.10 — with a module-load assertion that they sum to 1.0, so a mis-tune fails at boot
instead of silently skewing every ranking.

Needs with no preferences or no soft requirements would divide by zero; those
components return a neutral 100 rather than `NaN`, so a sparse need is not punished for
fields the user never expressed.

All seven values are computed server-side and stored; nothing about a score is ever
read from a request (§21).

### 7.4 Ranking — `modules/recommendations/ranking.service.ts`

- sort by `matchScore` descending
- label: `>= 85` `BEST_MATCH`, `70..84.99` `GOOD_MATCH`, `< 70` `ALTERNATIVE` (§5.4)
- `ranking` = 1-based index after sorting
- `explanation` names the one or two highest-scoring components in Indonesian, e.g.
  "Cocok dengan budget dan rating penjual tinggi"
- persist in one transaction: `deleteMany({ needId })` then `createMany(rows)`, so
  re-processing a need is idempotent and `@@unique([needId, productId])` can never
  be hit
- set `needs.status = COMPLETED` in the same transaction

`lib/ranking.ts` holds the pure parts (threshold → label, components → explanation);
the service holds persistence.

---

## 8. Checkout, orders, payment

### 8.1 The checkout transaction

`modules/checkout/service.ts`, one `prisma.$transaction` at `Serializable`, in the
order given by `CLAUDE.md` §5.7:

1. Re-validate stock for every cart item against live `products.stock`. Any shortfall
   **aborts before creating anything**, returning 409 with the offending items
   (`productId`, `requested`, `available`).
2. Group cart items by `product.sellerId`.
3. Per group: one `orders` row (`WAITING_PAYMENT`, `orderNumber` from
   `lib/orderNumber.ts`) plus its `order_items`, each snapshotting `productName`,
   `price`, and `subtotal` (§27).
4. `subtotal = SUM(order_items.subtotal)`; `total = subtotal + shippingCost`. Both
   computed server-side from stored prices — never from the request (§16).
5. Decrement `products.stock` by the conditional update of §5.8.
6. One `payments` row per order, `PENDING`, with a freshly generated unique
   `midtransOrderId` — deliberately **not** `orders.id`, so a retry after a failed
   payment can open a new Midtrans transaction without colliding on Midtrans's
   permanently-unique `order_id`.
7. Delete the checked-out `cart_items`.

**One order = one seller** (§26, `CLAUDE.md` §9.5). A cart spanning three sellers
produces three orders. This is Option A from `CLAUDE.md` §6.2 — one Snap transaction
per order, matching the 1:1 `payments`↔`orders` schema. No `payment_groups` table.

`POST /checkout/preview` performs steps 1–4 in memory and **writes nothing**, so the
client can show a per-seller summary before committing.

### 8.2 Snap creation happens after commit

`snap.createTransaction()` is an outbound HTTPS call. Holding a Postgres transaction
open across it would pin `products` row locks for the duration of a third-party round
trip — the standard way a slow gateway becomes a database-wide stall.

So the transaction commits, then `modules/payments/service.ts` creates one Snap
transaction per order and stores `snapToken` and `snapRedirectUrl`. If Snap creation
fails, the orders exist in `WAITING_PAYMENT` with `PENDING` payments and no token; the
client calls `POST /payments/:orderId/retry` to obtain one. Stock is already reserved,
which is the intent of `CLAUDE.md` §5.8 — stock moves at order creation, not at
payment, so the race resolves early.

Response: `{ orders: [{ order, payment: { snapToken, snapRedirectUrl } }] }`.

### 8.3 Order lifecycle

`modules/orders/service.ts` owns every status change; controllers never write
`orders.status` (`CLAUDE.md` §5.9). An explicit transition map rejects anything else
with 409 `INVALID_STATUS_TRANSITION`:

```
WAITING_PAYMENT -> PROCESSING | CANCELLED
PROCESSING      -> SHIPPED
SHIPPED         -> DELIVERED
DELIVERED       -> COMPLETED
COMPLETED       -> (terminal)
CANCELLED       -> (terminal)
```

`DELIVERED` sets `deliveredAt`; `COMPLETED` sets `completedAt` and increments
`products.soldCount`. `CANCELLED` restores `products.stock` for every order item in the
same transaction (`CLAUDE.md` §5.8). `SHIPPED`/`DELIVERED` require the owning seller;
`COMPLETED` and `cancel` require the owning buyer.

### 8.4 Webhook

`POST /api/v1/payments/midtrans/webhook`, public and therefore untrusted until proven
otherwise (§28).

1. **Verify the signature before reading any other field**:
   `sha512(order_id + status_code + gross_amount + MIDTRANS_SERVER_KEY)` compared to
   `signature_key` with `crypto.timingSafeEqual`. Mismatch → 403, nothing written.
2. Look up `payments` by `midtransOrderId`. Unknown → 404.
3. Store the entire payload in `payments.rawResponse` for audit (`CLAUDE.md` §6.3).
4. Map `transaction_status` → `PaymentStatus`: `capture`/`settlement` → `PAID`,
   `pending` → `PENDING`, `deny`/`cancel` → `FAILED`, `expire` → `EXPIRED`,
   `refund`/`partial_refund` → `REFUNDED`.
5. `PAID` sets `paidAt` and calls the orders service to move the order to `PROCESSING`.
   `FAILED`/`EXPIRED` calls it to `CANCELLED`, restoring stock. Status logic is **not**
   duplicated in the webhook handler (`CLAUDE.md` §6.3).
6. Steps 3–5 run in one transaction (§28 transaction-safe).
7. Return 200 for any correctly-signed payload, including duplicates — Midtrans retries
   on non-200 and the handler is idempotent.

A client can never assert payment state: there is no endpoint accepting a payment
status, and `payments.status` is writable only by the webhook service (§28).

Sandbox is absolute: `config/midtrans.ts` hardcodes `isProduction: false`, and
`config/env.ts` refuses to boot unless `MIDTRANS_SERVER_KEY` starts with
`SB-Mid-server-`. `MIDTRANS_IS_PRODUCTION` in `.env` is documentation only and is never
read as a switch (`CLAUDE.md` §1, §9.3).

---

## 9. Remaining modules

**categories** — `GET /categories` (tree), `GET /categories/:slug`. Public.

**products** — `GET /products` (traditional search: `q`, `categoryId`, `minPrice`,
`maxPrice`, `sort` allowlist, `page`, `limit`), `GET /products/:slug`, public. Seller
writes: `POST`, `PATCH /:id`, `DELETE /:id` (soft — `isActive = false`),
`PUT /:id/attributes`, `POST /:id/images`. This is also the §20 fallback surface.

**sellers** — `POST /sellers` (a `BUYER` registers a store, role becomes `SELLER` in
the same transaction), `GET /sellers/:id` public, `PATCH /sellers/me`.

**addresses** — full CRUD, owner-scoped. Setting `isDefault` clears the flag on the
user's other addresses in the same transaction.

**cart** — `GET /cart` (items + server-computed subtotal + budget check),
`POST /cart/items`, `PATCH /cart/items/:id`, `DELETE /cart/items/:id`, `DELETE /cart`,
`PATCH /cart/budget`. Add/update re-reads live `products.stock` and rejects
`quantity > stock` (`CLAUDE.md` §5.6). `priceAtAdd` is snapshotted on insert and never
refreshed, so a seller's price change cannot silently alter an existing cart line.
Uniqueness is `(cartId, productId)` — adding an existing product increments quantity
rather than creating a second row (§25).

**shopping-plans** — `POST` (from a need's recommendations, or empty with a budget),
`GET`, `GET /:id`, `PATCH /:id` (budget), `POST /:id/items`, `PATCH /:id/items/:itemId`,
`PUT /:id/items/:itemId/replace` (sets `isReplaced = true`),
`DELETE /:id/items/:itemId`, `GET /:id/alternatives` (cheaper recommendations for the
same need — the "optimise" path of `CLAUDE.md` §4.4), `POST /:id/add-to-cart`.
Every mutation recalculates `total` and `remaining` and re-derives `status`
(`READY` when `remaining >= 0`, `NEEDS_ADJUSTMENT` when negative) in the same
transaction (§24, `CLAUDE.md` §5.5). Client totals are ignored entirely.

**saved-products** — `GET /saved-products`, `POST /saved-products`,
`DELETE /saved-products/:productId`. Owner-scoped; the unique constraint makes a
repeat save a no-op 200.

**reviews** — `POST /orders/:orderId/items/:itemId/review`, and public
`GET /products/:id/reviews`. Creation requires (§29, `CLAUDE.md` §5.10): authenticated
caller, the order belongs to them, `orders.status = COMPLETED`, and the `order_item`
has no review yet (unique constraint; `P2002` surfaces as 409 `ALREADY_REVIEWED`). In
the same transaction, recalculate `products.rating` as `AVG(rating)` over that
product's reviews and `sellers.rating` as `AVG(rating)` over all reviews of that
seller's products — a rating can never reflect a review that rolled back.

---

## 10. Documentation

Per §8 and §34, written **before** the module it describes:

- `docs/swagger.yaml` — OpenAPI 3.1, the API contract. Served at `/docs` by
  `swagger-ui-express`. `servers` reads `API_BASE_URL`. Every endpoint documents
  method, path, auth, parameters, request body, all response codes, and schemas.
  Only real, implemented endpoints appear.
- `docs/architecture.md` — module map, layering rules, request lifecycle
- `docs/business-rules.md` — matching, scoring, ranking, budget, order lifecycle
- `docs/security.md` — authn/authz model, rate limits, idempotency, redaction, threats
- `docs/api.md` — quickstart, auth flow, envelope, error code table, pagination

To keep §8's "implementation and Swagger stay synchronized" from decaying into a
promise, one automated test asserts that every route registered on the Express app
appears in `swagger.yaml` and vice versa. Contract drift then fails CI rather than
being discovered by the frontend.

`CLAUDE.md` stays the business-flow authority and does not repeat what these files say
(§34 forbids contradictory duplication).

---

## 11. Testing

`node:test` + `node:assert` for units; `supertest` against `buildApp()` for
integration. `npm test` runs `tsx --test "src/**/*.test.ts"` (see §2 for why `tsx`
rather than `ts-node/register`).

Because `buildApp()` is separate from `server.ts`, integration tests mount the real
app without binding a port.

**Unit** (no database): `parseBudget` across every Indonesian money form plus junk →
`null`; `scoringWeights` summing to exactly 1.0; each scoring component's boundaries,
budget decay across the tolerance band, suspended seller → 0, empty preferences →
neutral not `NaN`; ranking labels at 85 / 84.99 / 70 / 69.99, descending sort, 1-based
`ranking`; `attributeMatch` hard rejection and numeric `>=`; `orderNumber` format and
uniqueness under a tight loop; webhook signature accept/reject and the full
`transaction_status` mapping; the order transition map, every legal and illegal edge.

**Integration** (`TEST_DATABASE_URL`, migrated and truncated between tests), covering
the §33 scenarios:

| Scenario | Assertion |
|---|---|
| unauthorized access | every protected route without a token → 401 |
| wrong owner | user B reading A's need, cart, plan, order, address, saved product → 404/403, never data |
| seller cross-tenancy | seller B updating A's product → 403 |
| invalid input | malformed body → 422 with `fields` |
| duplicate request | same `Idempotency-Key` twice → one set of orders, identical response |
| race condition | two concurrent checkouts for the last unit → one succeeds, one 409, stock lands at 0 |
| out of stock | quantity above stock → 409 listing offending items |
| payment failure | `expire` webhook → payment `EXPIRED`, order `CANCELLED`, stock restored |
| multi-seller checkout | 3-seller cart → 3 orders, each single-seller, 3 payments |
| AI failure | interpreter throwing → 200 with the traditional-search fallback, no 500 |
| rate limiting | exceeding `authLimiter` → 429 |
| webhook forgery | tampered `signature_key` → 403, nothing written |
| mass assignment | `role: "ADMIN"` in a register body → rejected by `.strict()`, role stays `BUYER` |
| contract drift | routes and `swagger.yaml` agree in both directions |

Not covered: controllers in isolation. They contain no logic by design; the integration
tests exercise them through real requests.

---

## 12. Required `CLAUDE.md` amendments

Two locked statements are overridden by the Master Rules and must be edited in the
same change that implements them, so the file does not describe a codebase that no
longer exists:

1. **§2 Struktur Folder** — replace the flat `src/routes|controllers|services` tree
   with the `src/modules/<domain>/` layout of §4, keeping the "no Prisma in
   controllers" rule verbatim.
2. **§6.3 Webhook endpoint** — `/api/payments/midtrans/webhook` becomes
   `/api/v1/payments/midtrans/webhook`, with the matching `.env.example` change and a
   note that the sandbox dashboard URL must be re-registered.

Everything else in `CLAUDE.md` — the business flow, the algorithms, the scoring
weights, the sandbox-only rule, the one-order-per-seller rule — is unchanged.

### 12.1 `.env.example` changes

| Variable | Change |
|---|---|
| `JWT_EXPIRES_IN` | `7d` → `15m`. A 7-day *access* token cannot be revoked; long life now belongs to the rotatable refresh token (§6.1). |
| `JWT_REFRESH_SECRET` | new — distinct from `JWT_SECRET`, so leaking one does not mint the other |
| `REFRESH_EXPIRES_IN` | new — default `30d` |
| `API_BASE_URL` | new — default `http://localhost:4000`; dev `https://<domain-ngrok-kamu>.ngrok-free.dev` (§7) |
| `ALLOWED_ORIGINS` | new — comma-separated CORS allowlist, replacing wildcard `cors()` |
| `LOG_LEVEL` | new — default `info` |
| `TEST_DATABASE_URL` | new — integration tests only |
| `MIDTRANS_NOTIFICATION_URL` | path gains `/v1` (§5.1) |
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX` | new — override the §5.9 defaults |

`config/env.ts` validates all of these with zod at boot and exits with a readable
message on a missing or malformed value, rather than failing later at first use.

---

## 13. Deliberate omissions

Each is a real feature not being built, with the condition that brings it back:

- **LLM need interpreter** — the interface ships; only the rule-based implementation does. Add when rule-based parsing measurably fails on real input.
- **`audit_logs` and the admin module** — no admin operations are specified. Add when they are, as its own gap report.
- **Shipping-cost calculation** — `shippingCost` is validated and stored, not computed. Add when there is a courier integration.
- **Cursor pagination** — offset only. Add when a list outgrows it.
- **`payment_groups` / one Snap across multiple orders** — Option B in `CLAUDE.md` §6.2 needs a new table and the schema is locked. Add only on explicit request.
- **Redis-backed rate limiting and login throttle** — in-memory, per-process. Add on the second instance.
- **File uploads** — product images are accepted as URLs, so §10's file-upload validation has no surface. Add with the storage decision.
- **Error tracking service (Sentry et al.)** — structured logs with request ids ship; an external sink does not. Add at deployment.
