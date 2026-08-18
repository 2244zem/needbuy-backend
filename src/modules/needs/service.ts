import { Prisma, type NeedStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../lib/apiError";
import { tokenize } from "../../lib/needParsing";
import { buildMeta, toSkipTake } from "../../lib/pagination";
import { findByKeyword } from "../categories/service";
import { generateRecommendations } from "../recommendations/ranking.service";
import { interpretNeed, type ClarificationQuestion } from "./interpreter.service";
import type {
  AddPreferenceInput,
  AddRequirementInput,
  ConfirmNeedInput,
  UpdateNeedInput,
} from "./schema";

const needSelect = {
  id: true,
  rawInput: true,
  goal: true,
  budget: true,
  location: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function createNeed(userId: string, rawInput: string) {
  const need = await prisma.need.create({
    data: { userId, rawInput, status: "DRAFT" },
    select: needSelect,
  });

  const result = await interpretNeed(rawInput);

  if (!result.ok) {
    return {
      need,
      interpreted: false as const,
      fallback: "TRADITIONAL_SEARCH" as const,
      suggestedQuery: rawInput.slice(0, 120),
      searchEndpoint: "/api/v1/products",
      reason: result.reason,
    };
  }

  const parsed = result.parsed;

  const updated = await prisma.need.update({
    where: { id: need.id },
    data: {
      goal: parsed.goal,
      budget: parsed.budget !== null ? new Prisma.Decimal(parsed.budget) : null,
      location: parsed.location,
    },
    select: needSelect,
  });

  const nextQuestion = await replaceOpenQuestions(need.id, parsed.clarificationQuestions);

  return {
    need: updated,
    interpreted: true as const,
    parsed: { ...parsed, categoryId: parsed.categoryId },
    needsClarification: parsed.needsClarification,
    
    nextQuestion,
    clarificationQuestions: parsed.clarificationQuestions,
  };
}

export const MAX_CLARIFICATION_TURNS = 5;

type StoredQuestion = {
  id: string;
  ordinal: number;
  field: string;
  question: string;
  context: string | null;
};

async function replaceOpenQuestions(
  needId: string,
  questions: ClarificationQuestion[],
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<StoredQuestion | null> {
  const answered = await tx.needClarification.findMany({
    where: { needId, answeredAt: { not: null } },
    select: { ordinal: true, field: true },
  });

  if (answered.length >= MAX_CLARIFICATION_TURNS) return null;

  await tx.needClarification.deleteMany({ where: { needId, answeredAt: null } });

  const asked = new Set(answered.map((a) => a.field));
  const pending = questions.filter((q) => !asked.has(q.field));
  if (pending.length === 0) return null;

  const startOrdinal = Math.max(0, ...answered.map((a) => a.ordinal)) + 1;
  const room = MAX_CLARIFICATION_TURNS - answered.length;

  await tx.needClarification.createMany({
    data: pending.slice(0, room).map((q, index) => ({
      needId,
      ordinal: startOrdinal + index,
      field: q.field,
      question: q.question,
      context: q.context,
    })),
  });

  return tx.needClarification.findFirst({
    where: { needId, answeredAt: null },
    orderBy: { ordinal: "asc" },
    select: { id: true, ordinal: true, field: true, question: true, context: true },
  });
}

export async function answerClarification(
  userId: string,
  needId: string,
  input: { questionId: string; answer: string }
) {
  const need = await requireOwnNeed(userId, needId);
  assertNotProcessing(need.status);

  const question = await prisma.needClarification.findFirst({
    where: { id: input.questionId, needId },
  });
  if (!question) throw AppError.notFound("Pertanyaan klarifikasi nggak ketemu.");
  if (question.answeredAt) {
    throw AppError.conflict("Pertanyaan ini udah dijawab.", "CLARIFICATION_ALREADY_ANSWERED");
  }

  await prisma.needClarification.update({
    where: { id: question.id },
    data: { answer: input.answer, answeredAt: new Date() },
  });

  const answers = await prisma.needClarification.findMany({
    where: { needId, answeredAt: { not: null } },
    orderBy: { ordinal: "asc" },
    select: { field: true, question: true, answer: true, answeredAt: true },
  });

  const combined = [need.rawInput, ...answers.map((a) => a.answer ?? "")]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(". ");

  const result = await interpretNeed(combined);
  if (!result.ok) {
    throw AppError.serviceUnavailable(result.reason, "INTERPRETER_UNAVAILABLE");
  }
  const parsed = result.parsed;

  const updated = await prisma.need.update({
    where: { id: needId },
    data: {
      goal: parsed.goal,
      budget: parsed.budget !== null ? new Prisma.Decimal(parsed.budget) : null,
      location: parsed.location,
    },
    select: needSelect,
  });

  const nextQuestion = await replaceOpenQuestions(needId, parsed.clarificationQuestions);

  return {
    need: updated,
    parsed,
    nextQuestion,
    
    complete: nextQuestion === null,
    turnsUsed: answers.length,
    turnsRemaining: Math.max(0, MAX_CLARIFICATION_TURNS - answers.length),
    history: answers,
  };
}

export async function listClarifications(userId: string, needId: string) {
  await requireOwnNeed(userId, needId);

  const items = await prisma.needClarification.findMany({
    where: { needId },
    orderBy: { ordinal: "asc" },
    select: {
      id: true,
      ordinal: true,
      field: true,
      question: true,
      context: true,
      answer: true,
      answeredAt: true,
      createdAt: true,
    },
  });

  const answered = items.filter((i) => i.answeredAt !== null).length;

  return {
    items,
    nextQuestion: items.find((i) => i.answeredAt === null) ?? null,
    turnsUsed: answered,
    turnsRemaining: Math.max(0, MAX_CLARIFICATION_TURNS - answered),
  };
}

export async function confirmNeed(userId: string, needId: string, input: ConfirmNeedInput) {
  const need = await requireOwnNeed(userId, needId);
  assertNotProcessing(need.status);

  if (input.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) throw AppError.badRequest("Kategori nggak ketemu.", "CATEGORY_NOT_FOUND");
  }

  return prisma.$transaction(async (tx) => {
    await tx.needRequirement.deleteMany({ where: { needId } });
    await tx.needPreference.deleteMany({ where: { needId } });

    if (input.requirements.length) {
      await tx.needRequirement.createMany({
        data: input.requirements.map((req) => ({
          needId,
          requirementKey: req.key.toLowerCase(),
          requirementValue: req.value,
          isHardRequirement: req.isHard,
        })),
      });
    }

    if (input.preferences.length) {
      await tx.needPreference.createMany({
        data: input.preferences.map((pref) => ({
          needId,
          preferenceKey: pref.key.toLowerCase(),
          preferenceValue: pref.value,
          weight: new Prisma.Decimal(pref.weight),
        })),
      });
    }

    const updated = await tx.need.update({
      where: { id: needId },
      data: {
        ...(input.goal !== undefined ? { goal: input.goal } : {}),
        ...(input.budget !== undefined
          ? { budget: input.budget === null ? null : new Prisma.Decimal(input.budget) }
          : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
      },
      select: needSelect,
    });

    const [requirements, preferences] = await Promise.all([
      tx.needRequirement.findMany({ where: { needId } }),
      tx.needPreference.findMany({ where: { needId } }),
    ]);

    return { need: updated, requirements, preferences };
  });
}

export async function processNeed(userId: string, needId: string, categoryId?: string) {
  const need = await requireOwnNeed(userId, needId);

  let resolvedCategoryId: string | null = categoryId ?? null;
  if (resolvedCategoryId === null) {
    const hit = await findByKeyword(need.rawInput);
    resolvedCategoryId = hit?.id ?? null;
  }

  const [requirements, preferences] = await Promise.all([
    prisma.needRequirement.findMany({ where: { needId } }),
    prisma.needPreference.findMany({ where: { needId } }),
  ]);

  await prisma.need.update({ where: { id: needId }, data: { status: "PROCESSING" } });

  try {
    const result = await generateRecommendations(needId, {
      categoryId: resolvedCategoryId,
      
      keywords: tokenize(need.rawInput),
      budget: need.budget !== null ? Number(need.budget) : null,
      hardRequirements: requirements
        .filter((req) => req.isHardRequirement)
        .map((req) => ({ key: req.requirementKey, value: req.requirementValue })),
      softRequirements: requirements
        .filter((req) => !req.isHardRequirement)
        .map((req) => ({ key: req.requirementKey, value: req.requirementValue })),
      preferences: preferences.map((pref) => ({
        key: pref.preferenceKey,
        value: pref.preferenceValue,
        weight: Number(pref.weight),
      })),
    });

    return result;
  } catch (error) {
    await prisma.need.update({ where: { id: needId }, data: { status: "DRAFT" } });
    throw error;
  }
}

export async function updateNeed(userId: string, needId: string, input: UpdateNeedInput) {
  const need = await requireOwnNeed(userId, needId);
  assertNotProcessing(need.status);

  return prisma.need.update({
    where: { id: needId },
    
    data: {
      ...(input.goal !== undefined ? { goal: input.goal } : {}),
      ...(input.budget !== undefined
        ? { budget: input.budget === null ? null : new Prisma.Decimal(input.budget) }
        : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
    },
    select: needSelect,
  });
}

export async function deleteNeed(userId: string, needId: string) {
  const need = await requireOwnNeed(userId, needId);
  assertNotProcessing(need.status);

  await prisma.need.delete({ where: { id: needId } });
  return { deleted: true };
}

export async function addRequirement(
  userId: string,
  needId: string,
  input: AddRequirementInput
) {
  const need = await requireOwnNeed(userId, needId);
  assertNotProcessing(need.status);

  return prisma.needRequirement.create({
    data: {
      needId,
      requirementKey: input.key.toLowerCase(),
      requirementValue: input.value,
      isHardRequirement: input.isHard,
    },
    select: {
      id: true,
      requirementKey: true,
      requirementValue: true,
      isHardRequirement: true,
    },
  });
}

export async function removeRequirement(userId: string, needId: string, requirementId: string) {
  const need = await requireOwnNeed(userId, needId);
  assertNotProcessing(need.status);

  const deleted = await prisma.needRequirement.deleteMany({
    where: { id: requirementId, needId },
  });
  if (deleted.count === 0) throw AppError.notFound("Requirement nggak ketemu.");
  return { deleted: true };
}

export async function addPreference(userId: string, needId: string, input: AddPreferenceInput) {
  const need = await requireOwnNeed(userId, needId);
  assertNotProcessing(need.status);

  return prisma.needPreference.create({
    data: {
      needId,
      preferenceKey: input.key.toLowerCase(),
      preferenceValue: input.value,
      weight: new Prisma.Decimal(input.weight),
    },
    select: { id: true, preferenceKey: true, preferenceValue: true, weight: true },
  });
}

export async function removePreference(userId: string, needId: string, preferenceId: string) {
  const need = await requireOwnNeed(userId, needId);
  assertNotProcessing(need.status);

  const deleted = await prisma.needPreference.deleteMany({
    where: { id: preferenceId, needId },
  });
  if (deleted.count === 0) throw AppError.notFound("Preference nggak ketemu.");
  return { deleted: true };
}

function assertNotProcessing(status: NeedStatus) {
  if (status === "PROCESSING") {
    throw AppError.conflict(
      "Need ini sedang diproses, tunggu sampai selesai.",
      "NEED_PROCESSING"
    );
  }
}

export async function listNeeds(
  userId: string,
  query: { status?: "DRAFT" | "PROCESSING" | "COMPLETED"; page: number; limit: number }
) {
  const where = { userId, ...(query.status ? { status: query.status } : {}) };
  const { skip, take } = toSkipTake(query);

  const [items, total] = await Promise.all([
    prisma.need.findMany({
      where,
      select: { ...needSelect, _count: { select: { recommendations: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.need.count({ where }),
  ]);

  return { items, meta: buildMeta(query, total) };
}

export async function getNeed(userId: string, needId: string) {
  const need = await prisma.need.findFirst({
    where: { id: needId, userId },
    select: {
      ...needSelect,
      requirements: {
        select: { id: true, requirementKey: true, requirementValue: true, isHardRequirement: true },
      },
      preferences: { select: { id: true, preferenceKey: true, preferenceValue: true, weight: true } },
      _count: { select: { recommendations: true } },
    },
  });
  if (!need) throw AppError.notFound("Need nggak ketemu.");
  return need;
}

export async function requireOwnNeed(userId: string, needId: string) {
  const need = await prisma.need.findFirst({
    where: { id: needId, userId },
    select: { id: true, status: true, budget: true, rawInput: true },
  });
  if (!need) throw AppError.notFound("Need nggak ketemu.");
  return need;
}
