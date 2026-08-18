import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../lib/apiError";
import { buildMeta, toSkipTake } from "../../lib/pagination";
import type { CreateReportInput, ListReportsQuery, UpdateReportInput } from "./schema";

const reportSelect = {
  id: true,
  targetType: true,
  targetId: true,
  targetLabel: true,
  reason: true,
  description: true,
  priority: true,
  status: true,
  resolution: true,
  resolvedAt: true,
  createdAt: true,
  reporter: { select: { id: true, name: true, email: true } },
} satisfies Prisma.ReportSelect;

async function resolveTarget(
  targetType: CreateReportInput["targetType"],
  targetId: string
): Promise<string> {
  if (targetType === "PRODUCT") {
    const product = await prisma.product.findUnique({
      where: { id: targetId },
      select: { name: true },
    });
    if (!product) throw AppError.notFound("Produk yang dilaporkan nggak ketemu.");
    return product.name;
  }

  if (targetType === "SELLER") {
    const seller = await prisma.seller.findUnique({
      where: { id: targetId },
      select: { storeName: true },
    });
    if (!seller) throw AppError.notFound("Toko yang dilaporkan nggak ketemu.");
    return seller.storeName;
  }

  const review = await prisma.review.findUnique({
    where: { id: targetId },
    select: { comment: true, product: { select: { name: true } } },
  });
  if (!review) throw AppError.notFound("Ulasan yang dilaporkan nggak ketemu.");
  const excerpt = review.comment?.slice(0, 60) ?? "(tanpa komentar)";
  return `Ulasan ${review.product.name}: ${excerpt}`;
}

export async function createReport(reporterId: string, input: CreateReportInput) {
  const targetLabel = await resolveTarget(input.targetType, input.targetId);

  try {
    return await prisma.report.create({
      data: {
        reporterId,
        targetType: input.targetType,
        targetId: input.targetId,
        targetLabel,
        reason: input.reason,
        description: input.description ?? null,
      },
      select: reportSelect,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw AppError.conflict("Kamu udah pernah melaporkan ini.", "REPORT_DUPLICATE");
    }
    throw error;
  }
}

export async function listForAdmin(query: ListReportsQuery) {
  const where: Prisma.ReportWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.targetType ? { targetType: query.targetType } : {}),
  };
  const { skip, take } = toSkipTake(query);

  const [items, total] = await Promise.all([
    prisma.report.findMany({
      where,
      select: reportSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.report.count({ where }),
  ]);

  return { items, meta: buildMeta(query, total) };
}

export async function updateReport(adminUserId: string, id: string, input: UpdateReportInput) {
  const exists = await prisma.report.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw AppError.notFound("Laporan nggak ketemu.");

  return prisma.report.update({
    where: { id },
    data: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.priority ? { priority: input.priority } : {}),
      ...(input.resolution !== undefined ? { resolution: input.resolution } : {}),
      ...(input.status === "RESOLVED"
        ? { resolvedAt: new Date(), handledById: adminUserId }
        : {}),
      ...(input.status && input.status !== "RESOLVED"
        ? { resolvedAt: null, handledById: adminUserId }
        : {}),
    },
    select: reportSelect,
  });
}
