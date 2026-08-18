import { prisma } from "../../config/prisma";
import { AppError } from "../../lib/apiError";
import {
  detectCategory,
  detectGoal,
  extractLocation,
  extractPreferences,
  extractRequirements,
} from "../../lib/needParsing";
import { checkNeedSanity, type SanityIssue } from "../../lib/needSanity";
import { parseBudget } from "../../lib/parseBudget";
import { auditProduct, type ProductForAudit } from "../../lib/productAudit";
import { routeQuestion } from "../../lib/productQuestion";
import { findSimilarNeeds } from "../../lib/similarNeeds";
import { normalizeSpecKey } from "../../lib/specBase";
import { checkSuitability } from "../../lib/suitability";
import type { Attribute } from "../../lib/attributeMatch";
import type {
  AuditProductInput,
  CheckProductInput,
  IncomingAttribute,
  IncomingRequirement,
  InsightsInput,
  MarketPulseInput,
  PlansInput,
  ProductQuestionInput,
  SimilarInput,
} from "./ai.schema";

const MAX_CLARIFICATION_QUESTIONS = 5;

type ClarificationQuestion = { field: string; question: string; context: string };

export function interpret(rawInput: string) {
  const goal = detectGoal(rawInput);
  const budget = parseBudget(rawInput);
  const location = extractLocation(rawInput);
  const category = detectCategory(rawInput);
  const requirements = extractRequirements(rawInput);
  const preferences = extractPreferences(rawInput);

  const sanity = checkNeedSanity({
    rawInput,
    requirements: requirements.map((r) => ({ key: r.key, value: r.value })),
    categorySlug: category,
    budget,
  });

  const questions = clarificationQuestionsFor({ goal, budget, category, sanity: sanity.issues });

  return {
    interpretation: {
      goal,
      budget,
      location,
      category,
      requirements: requirements.map((r) => ({
        key: r.key,
        value: r.value,
        isHardRequirement: r.isHard,
      })),
      preferences,
    },
    needsClarification: questions.length > 0,
    clarificationQuestions: questions,
    confidenceScore: confidenceFor({ goal, budget, requirements, absurd: sanity.detected }),
    absurdityDetected: sanity.detected,
    absurdityNotes: sanity.notes,
    issues: sanity.issues,
  };
}

function clarificationQuestionsFor(input: {
  goal: string | null;
  budget: number | null;
  category: string | null;
  sanity: SanityIssue[];
}): ClarificationQuestion[] {
  const questions: ClarificationQuestion[] = [];

  if (input.budget === null) {
    questions.push({
      field: "budget",
      question: "Berapa budget yang kamu siapkan?",
      context: "Budget nggak terdeteksi dari kebutuhan yang kamu tulis.",
    });
  }
  if (!input.category) {
    questions.push({
      field: "category",
      question: "Produk jenis apa yang kamu cari?",
      context: "Kategori produk belum bisa ditentukan dari kalimatmu.",
    });
  }
  if (!input.goal) {
    questions.push({
      field: "goal",
      question: "Apa tujuan utama kamu membeli produk ini?",
      context: "Tujuan belum terbaca dengan jelas.",
    });
  }

  for (const issue of input.sanity) {
    if (issue.severity !== "critical") continue;
    questions.push({
      field: "requirement",
      question: `Sepertinya ${issue.message}. Bisa jelaskan ulang kebutuhanmu?`,
      context: issue.suggestion ?? "",
    });
  }

  return questions.slice(0, MAX_CLARIFICATION_QUESTIONS);
}

function confidenceFor(input: {
  goal: string | null;
  budget: number | null;
  requirements: unknown[];
  absurd: boolean;
}): number {
  let score = 0.1;
  if (input.goal) score += 0.35;
  if (input.budget !== null) score += 0.25;
  if (input.requirements.length >= 2) score += 0.25;
  else if (input.requirements.length === 1) score += 0.15;

  return input.absurd ? Math.min(score, 0.3) : Math.min(score, 1);
}

export async function findSimilar(input: SimilarInput, userId: string) {
  const target = await prisma.need.findUnique({
    where: { id: input.needId },
    select: { id: true, userId: true },
  });
  if (!target) throw AppError.notFound("Need nggak ketemu.");
  if (target.userId !== userId) throw AppError.forbidden("Need ini bukan milikmu.");

  const needs = await prisma.need.findMany({
    where: { userId },
    select: { id: true, goal: true, rawInput: true, createdAt: true },
    orderBy: { createdAt: "desc" },

    take: 200,
  });

  const scored = findSimilarNeeds(input.needId, needs, input.limit);
  const byId = new Map(needs.map((n) => [n.id, n]));

  return {
    similarNeeds: scored.map((s) => ({
      id: s.id,
      score: Number(s.score.toFixed(4)),
      goal: byId.get(s.id)?.goal ?? null,
      rawInput: byId.get(s.id)?.rawInput ?? null,
    })),
  };
}

export function generatePlans(input: PlansInput) {
  const products = input.products ?? [];
  if (products.length === 0) return { plans: [] };

  const priced = products.filter((p) => typeof p.price === "number");
  if (priced.length === 0) return { plans: [] };

  const plans = [];

  const cheapest = priced.reduce((a, b) => (a.price! <= b.price! ? a : b));
  plans.push(planFrom("budget_minimal", cheapest, 0.8, "Harga paling terjangkau sesuai kriteria"));

  const withinBudget = priced.filter((p) => p.price! <= input.budget);
  if (withinBudget.length > 0) {
    const best = withinBudget.reduce((a, b) => ((a.rating ?? 0) >= (b.rating ?? 0) ? a : b));
    if (best.id !== cheapest.id) {
      plans.push(planFrom("optimal", best, 0.95, "Keseimbangan terbaik antara harga dan spesifikasi"));
    }
  }

  return { plans };
}

function planFrom(
  strategy: string,
  product: { id?: string; name?: string; price?: number },
  score: number,
  reason: string
) {
  return {
    strategy,
    totalPrice: product.price ?? 0,
    score,
    items: [
      {
        productId: product.id ?? "",
        name: product.name ?? "",
        price: product.price ?? 0,
        quantity: 1,
        reason,
      },
    ],
  };
}

export function getInsights(input: InsightsInput) {
  const goal = input.need_goal?.trim() || "kebutuhanmu";
  const count = input.product_count ?? 0;
  const budget = input.budget ?? 0;

  const summary =
    budget > 0
      ? `Berdasarkan analisis ${goal} dengan alokasi budget Rp${budget.toLocaleString(
          "id-ID"
        )}, ditemukan ${count} rekomendasi produk yang relevan.`
      : `Berdasarkan analisis ${goal}, ditemukan ${count} rekomendasi produk pilihan.`;

  return {
    insight: {
      summary,
      recommendationReason:
        "Produk dipilih berdasarkan kecocokan atribut utama dan efisiensi budget.",
      confidenceScore: count === 0 ? 0.2 : Math.min(0.5 + count * 0.05, 0.95),
    },
  };
}

const LOW_STOCK_THRESHOLD = 5;

export function getMarketPulse(input: MarketPulseInput) {
  const products = input.products_data ?? [];
  if (products.length === 0) {
    return { analysis: { priceTrend: "unknown", stockUrgency: "normal", averagePrice: 0, sampleSize: 0 } };
  }

  const prices = products.map((p) => p.price).filter((p): p is number => typeof p === "number");
  const averagePrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;

  const lowStock = products.filter(
    (p) => typeof p.stock === "number" && p.stock < LOW_STOCK_THRESHOLD
  ).length;

  return {
    analysis: {
      priceTrend: "unknown",
      stockUrgency: lowStock > products.length / 2 ? "high" : "normal",
      averagePrice,
      sampleSize: products.length,
    },
  };
}

function toAttributePairs(list: IncomingAttribute[] | undefined) {
  return (list ?? []).map((a) => ({
    key: a.key ?? a.attr_key ?? a.attrKey ?? "",
    value: a.value ?? a.attr_value ?? a.attrValue ?? "",
  }));
}

function toMatchAttributes(list: IncomingAttribute[] | undefined): Attribute[] {
  return toAttributePairs(list).map((a) => ({ attrKey: a.key, attrValue: a.value }));
}

export function audit(input: AuditProductInput) {
  const p = input.product;
  const product: ProductForAudit = {
    name: p.name,
    description: p.description,
    sku: p.sku,
    categoryName: p.category_name ?? p.category ?? null,
    price: p.price,
    attributes: toAttributePairs(p.attributes ?? p.specs),
  };
  return { audit: auditProduct(product) };
}

export function check(input: CheckProductInput) {
  const attributes = toMatchAttributes(input.product.attributes ?? input.product.specs);

  const requirements = (input.requirements ?? []).map((r: IncomingRequirement) => ({
    key: r.key,
    value: r.value,
    isHard: r.is_hard_requirement ?? r.isHard ?? false,
  }));

  const preferences = (input.preferences ?? []).map((p) => ({ key: p.key, value: p.value }));

  return { check: checkSuitability({ name: input.product.name, attributes }, requirements, preferences) };
}

const rupiah = (value: unknown) => `Rp${Number(value).toLocaleString("id-ID")}`;

export async function answerProductQuestion(input: ProductQuestionInput) {
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: {
      id: true,
      name: true,
      price: true,
      stock: true,
      isActive: true,
      seller: { select: { storeName: true, rating: true } },
      attributes: { select: { attrKey: true, attrValue: true } },
    },
  });
  if (!product) throw AppError.notFound("Produk nggak ketemu.");

  const target = routeQuestion(input.question);
  const askable = [
    "harga",
    "stok",
    "penjual",
    ...product.attributes.map((a) => a.attrKey),
  ];

  const unanswerable = (reason: string) => ({
    productId: product.id,
    productName: product.name,
    question: input.question,
    answerable: false as const,
    answer: null,
    reason,
    askable,
  });

  const answered = (answer: string, source: string) => ({
    productId: product.id,
    productName: product.name,
    question: input.question,
    answerable: true as const,
    answer,
    source,
    askable,
  });

  switch (target.kind) {
    case "price":
      return answered(`${product.name} dijual ${rupiah(product.price)}.`, "price");

    case "stock":
      if (!product.isActive) {
        return answered(`${product.name} sedang nggak dijual.`, "stock");
      }
      return answered(
        product.stock > 0
          ? `Stok ${product.name} tersisa ${product.stock}.`
          : `Stok ${product.name} sedang habis.`,
        "stock"
      );

    case "seller":
      return answered(
        `${product.name} dijual oleh ${product.seller.storeName} (rating ${product.seller.rating}).`,
        "seller"
      );

    case "attribute": {
      const hit = product.attributes.find(
        (a) => (normalizeSpecKey(a.attrKey) ?? a.attrKey.toLowerCase()) === target.key
      );
      if (!hit) {
        return unanswerable(
          `Penjual belum mencantumkan ${target.key} untuk produk ini.`
        );
      }
      return answered(`${hit.attrKey} ${product.name}: ${hit.attrValue}.`, hit.attrKey);
    }

    default:
      return unanswerable(
        "Pertanyaan ini di luar data yang tersedia. Coba tanyakan salah satu hal berikut."
      );
  }
}
