import { z } from "zod";
import { logger } from "../../config/logger";
import { checkNeedSanity } from "../../lib/needSanity";
import {
  detectCategory,
  extractLocation,
  extractPreferences,
  extractRequirements,
} from "../../lib/needParsing";
import { parseBudget } from "../../lib/parseBudget";
import { findByKeyword, findBySlugOrNull } from "../categories/service";

export const CLARIFICATION_FIELDS = ["budget", "category", "goal", "requirement"] as const;
export type ClarificationField = (typeof CLARIFICATION_FIELDS)[number];

export type ClarificationQuestion = {
  field: ClarificationField;
  question: string;
  context: string | null;
};

export type ParsedNeed = {
  goal: string | null;
  budget: number | null;
  location: string | null;
  categoryId: string | null;
  categorySlug: string | null;
  requirements: { key: string; value: string; isHard: boolean }[];
  preferences: { key: string; value: string; weight: number }[];
  needsClarification: boolean;
  clarificationQuestions: ClarificationQuestion[];
  absurdityDetected?: boolean;
  absurdityNotes?: string[];
  source: "RULE_BASED" | "LLM";
};

export interface NeedInterpreter {
  interpret(rawInput: string): Promise<ParsedNeed>;
}

export const parsedNeedSchema = z.object({
  goal: z.string().trim().max(300).nullable(),
  budget: z.number().positive().max(100_000_000_000).nullable(),
  location: z.string().trim().max(120).nullable(),
  categoryId: z.string().uuid().nullable(),
  categorySlug: z.string().trim().max(160).nullable(),
  requirements: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(60).toLowerCase(),
        value: z.string().trim().min(1).max(200),
        isHard: z.boolean(),
      })
    )
    .max(30),
  preferences: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(60).toLowerCase(),
        value: z.string().trim().min(1).max(200),
        weight: z.number().min(0).max(5),
      })
    )
    .max(30),
  needsClarification: z.boolean(),
  clarificationQuestions: z
    .array(
      z.object({
        field: z.enum(CLARIFICATION_FIELDS),
        question: z.string().trim().min(1).max(300),
        context: z.string().trim().max(300).nullable(),
      })
    )
    .max(10),
  absurdityDetected: z.boolean().optional(),
  absurdityNotes: z.array(z.string().max(300)).max(10).optional(),
  source: z.enum(["RULE_BASED", "LLM"]),
});

async function categoryFromSynonym(text: string) {
  const slug = detectCategory(text);
  return slug ? findBySlugOrNull(slug) : null;
}

class RuleBasedInterpreter implements NeedInterpreter {
  async interpret(rawInput: string): Promise<ParsedNeed> {
    const text = rawInput.trim();
    const budget = parseBudget(text);
    const category = (await findByKeyword(text)) ?? (await categoryFromSynonym(text));

    const requirements = extractRequirements(text);
    const preferences = extractPreferences(text);

    const clarificationQuestions: ClarificationQuestion[] = [];
    if (budget === null) {
      clarificationQuestions.push({
        field: "budget",
        question: "Berapa budget yang kamu siapkan untuk kebutuhan ini?",
        context: "Budget nggak terdeteksi dari kebutuhan yang kamu tulis.",
      });
    }
    if (!category) {
      clarificationQuestions.push({
        field: "category",
        question: "Kategori produk apa yang kamu cari?",
        context: "Kategori produk belum bisa ditentukan dari kalimatmu.",
      });
    }

    const sanity = checkNeedSanity({
      rawInput: text,
      requirements,
      categorySlug: category?.slug ?? null,
      budget,
    });
    if (sanity.detected) {
      for (const issue of sanity.issues) {
        if (issue.severity === "critical") {
          clarificationQuestions.push({
            field: "requirement",
            question: `Sepertinya ${issue.message}. Bisa jelaskan kembali kebutuhanmu?`,
            context: issue.suggestion ?? null,
          });
        }
      }
    }

    return {
      goal: text.slice(0, 300) || null,
      budget,
      location: extractLocation(text),
      categoryId: category?.id ?? null,
      categorySlug: category?.slug ?? null,
      requirements,
      preferences,
      needsClarification: clarificationQuestions.length > 0,
      clarificationQuestions,
      absurdityDetected: sanity.detected,
      absurdityNotes: sanity.notes,
      source: "RULE_BASED",
    };
  }
}

export const ruleBasedInterpreter: NeedInterpreter = new RuleBasedInterpreter();

export async function interpretNeed(
  rawInput: string,
  interpreter: NeedInterpreter = ruleBasedInterpreter
): Promise<{ ok: true; parsed: ParsedNeed } | { ok: false; reason: string }> {
  try {
    const raw = await interpreter.interpret(rawInput);
    const validated = parsedNeedSchema.parse(raw);
    return { ok: true, parsed: validated };
  } catch (error) {
    logger.error({ err: error }, "need interpreter failed");
    return {
      ok: false,
      reason:
        error instanceof z.ZodError
          ? "Hasil analisis kebutuhan nggak sesuai format yang diharapkan."
          : "Analisis kebutuhan sedang nggak tersedia.",
    };
  }
}
