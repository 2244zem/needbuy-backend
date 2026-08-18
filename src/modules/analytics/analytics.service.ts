import type { OrderStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { buildShopInsights } from "../../lib/shopInsights";
import { requireOwnSeller } from "../sellers/service";
import type { AnalyticsQuery } from "./analytics.schema";

function parsePeriodDates(query: AnalyticsQuery) {
  const now = new Date();
  let currentStart: Date;
  let currentEnd = now;

  if (query.startDate && query.endDate) {
    currentStart = new Date(query.startDate);
    currentEnd = new Date(query.endDate);
  } else {
    currentStart = new Date(now);
    switch (query.period) {
      case "day":
        currentStart.setHours(0, 0, 0, 0);
        break;
      case "week":
        currentStart.setDate(now.getDate() - 7);
        break;
      case "year":
        currentStart.setFullYear(now.getFullYear() - 1);
        break;
      case "month":
      default:
        currentStart.setMonth(now.getMonth() - 1);
        break;
    }
  }

  const durationMs = currentEnd.getTime() - currentStart.getTime();
  const prevEnd = new Date(currentStart.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);

  return { currentStart, currentEnd, prevStart, prevEnd };
}

function calculateGrowth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  const change = ((current - previous) / previous) * 100;
  return Number(change.toFixed(1));
}

export async function getKpiCards(query: AnalyticsQuery) {
  const { currentStart, currentEnd, prevStart, prevEnd } = parsePeriodDates(query);

  const [
    totalNeeds,
    prevTotalNeeds,
    completedNeeds,
    prevCompletedNeeds,
    shoppingPlans,
    prevShoppingPlans,
    abandonedNeeds,
    prevAbandonedNeeds,
  ] = await Promise.all([
    prisma.need.count({ where: { createdAt: { gte: currentStart, lte: currentEnd } } }),
    prisma.need.count({ where: { createdAt: { gte: prevStart, lte: prevEnd } } }),
    prisma.need.count({ where: { status: "COMPLETED", createdAt: { gte: currentStart, lte: currentEnd } } }),
    prisma.need.count({ where: { status: "COMPLETED", createdAt: { gte: prevStart, lte: prevEnd } } }),
    prisma.shoppingPlan.aggregate({
      where: { createdAt: { gte: currentStart, lte: currentEnd } },
      _avg: { budget: true },
      _count: true,
    }),
    prisma.shoppingPlan.aggregate({
      where: { createdAt: { gte: prevStart, lte: prevEnd } },
      _avg: { budget: true },
    }),
    prisma.need.count({
      where: {
        status: "DRAFT",
        updatedAt: { lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        createdAt: { gte: currentStart, lte: currentEnd },
      },
    }),
    prisma.need.count({
      where: {
        status: "DRAFT",
        updatedAt: { lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        createdAt: { gte: prevStart, lte: prevEnd },
      },
    }),
  ]);

  const conversionRate = totalNeeds > 0 ? Math.round((completedNeeds / totalNeeds) * 100) : 0;
  const prevConversionRate = prevTotalNeeds > 0 ? Math.round((prevCompletedNeeds / prevTotalNeeds) * 100) : 0;
  const abandonmentRate = totalNeeds > 0 ? Math.round((abandonedNeeds / totalNeeds) * 100) : 0;
  const prevAbandonmentRate = prevTotalNeeds > 0 ? Math.round((prevAbandonedNeeds / prevTotalNeeds) * 100) : 0;
  const avgPlanValue = Number(shoppingPlans._avg.budget ?? 0);
  const prevAvgPlanValue = Number(prevShoppingPlans._avg.budget ?? 0);

  return {
    rekomendasiTingkatKonversi: {
      value: conversionRate,
      unit: "%",
      growthPercentage: calculateGrowth(conversionRate, prevConversionRate),
      description: "Persentase kebutuhan yang berhasil dikonversi",
    },
    rataRataNilaiRencanaBelanja: {
      value: avgPlanValue,
      formatted: `Rp ${avgPlanValue.toLocaleString("id-ID")}`,
      growthPercentage: calculateGrowth(avgPlanValue, prevAvgPlanValue),
      description: "Nilai rata-rata rencana belanja",
    },
    tingkatAbandonment: {
      value: abandonmentRate,
      unit: "%",
      growthPercentage: calculateGrowth(abandonmentRate, prevAbandonmentRate),
      description: "Persentase kebutuhan yang ditinggalkan",
    },
  };
}

export async function getQueryOvertime(query: AnalyticsQuery) {
  const { currentStart, currentEnd } = parsePeriodDates(query);

  const needs = await prisma.need.findMany({
    where: { createdAt: { gte: currentStart, lte: currentEnd } },
    select: { createdAt: true, status: true },
    orderBy: { createdAt: "asc" },
  });

  const chartMap = new Map<string, { date: string; total: number; completed: number; draft: number; processing: number }>();

  for (const need of needs) {
    const dateStr = need.createdAt.toISOString().split("T")[0];
    const existing = chartMap.get(dateStr) ?? { date: dateStr, total: 0, completed: 0, draft: 0, processing: 0 };
    existing.total += 1;
    if (need.status === "COMPLETED") existing.completed += 1;
    else if (need.status === "DRAFT") existing.draft += 1;
    else existing.processing += 1;
    chartMap.set(dateStr, existing);
  }

  return Array.from(chartMap.values());
}

export async function getMostRequestedCategories(query: AnalyticsQuery) {
  const { currentStart, currentEnd } = parsePeriodDates(query);

  const recommendations = await prisma.recommendation.findMany({
    where: { createdAt: { gte: currentStart, lte: currentEnd } },
    select: { product: { select: { categoryId: true } } },
  });

  const categoryCount = new Map<string, number>();
  for (const rec of recommendations) {
    if (rec.product.categoryId) {
      categoryCount.set(rec.product.categoryId, (categoryCount.get(rec.product.categoryId) ?? 0) + 1);
    }
  }

  const sortedCategories = Array.from(categoryCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const categoryIds = sortedCategories.map(([id]) => id);
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true },
  });
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  return sortedCategories.map(([id, count]) => ({
    categoryId: id,
    categoryName: categoryMap.get(id) ?? "Kategori",
    requestCount: count,
  }));
}

export async function getMatchScoreDistribution(query: AnalyticsQuery) {
  const { currentStart, currentEnd } = parsePeriodDates(query);

  const recommendations = await prisma.recommendation.findMany({
    where: { createdAt: { gte: currentStart, lte: currentEnd } },
    select: { matchScore: true },
  });

  const total = recommendations.length;
  if (total === 0) {
    return {
      tinggi: { count: 0, percentage: 0 },
      sedang: { count: 0, percentage: 0 },
      rendah: { count: 0, percentage: 0 },
      total: 0,
    };
  }

  let tinggi = 0;
  let sedang = 0;
  let rendah = 0;

  for (const rec of recommendations) {
    const score = Number(rec.matchScore);
    if (score >= 85) tinggi++;
    else if (score >= 70) sedang++;
    else rendah++;
  }

  return {
    tinggi: { count: tinggi, percentage: Math.round((tinggi / total) * 100) },
    sedang: { count: sedang, percentage: Math.round((sedang / total) * 100) },
    rendah: { count: rendah, percentage: Math.round((rendah / total) * 100) },
    total,
  };
}

export async function getAnalyticsOverview(query: AnalyticsQuery) {
  const [kpiCards, queryOvertime, mostRequestedCategories, matchScoreDistribution] = await Promise.all([
    getKpiCards(query),
    getQueryOvertime(query),
    getMostRequestedCategories(query),
    getMatchScoreDistribution(query),
  ]);

  const { currentStart, currentEnd } = parsePeriodDates(query);

  return {
    period: query.period,
    dateRange: {
      startDate: currentStart.toISOString(),
      endDate: currentEnd.toISOString(),
    },
    kpiCards,
    grafikTrenKebutuhan: queryOvertime,
    grafikKategoriPalingDiminta: mostRequestedCategories,
    distribusiSkorKecocokan: matchScoreDistribution,
  };
}

const PAID_ORDER_STATUSES: OrderStatus[] = ["PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED"];

function conversionOf(orders: number, views: number): number {
  if (views === 0) return 0;
  return Number(((orders / views) * 100).toFixed(2));
}

async function countShopOrders(sellerId: string, from: Date, to: Date) {
  return prisma.order.count({
    where: { sellerId, status: { in: PAID_ORDER_STATUSES }, createdAt: { gte: from, lte: to } },
  });
}

async function countShopViews(sellerId: string, from: Date, to: Date) {
  return prisma.productView.count({ where: { sellerId, createdAt: { gte: from, lte: to } } });
}

export async function getShopConversion(userId: string, query: AnalyticsQuery) {
  const seller = await requireOwnSeller(userId);
  const { currentStart, currentEnd, prevStart, prevEnd } = parsePeriodDates(query);

  const [views, orders, viewsPrev, ordersPrev] = await Promise.all([
    countShopViews(seller.id, currentStart, currentEnd),
    countShopOrders(seller.id, currentStart, currentEnd),
    countShopViews(seller.id, prevStart, prevEnd),
    countShopOrders(seller.id, prevStart, prevEnd),
  ]);

  const rate = conversionOf(orders, views);
  const ratePrev = conversionOf(ordersPrev, viewsPrev);

  return {
    period: query.period,
    dateRange: { startDate: currentStart.toISOString(), endDate: currentEnd.toISOString() },
    views,
    orders,
    conversionRate: rate,
    previous: { views: viewsPrev, orders: ordersPrev, conversionRate: ratePrev },
    changePoint: Number((rate - ratePrev).toFixed(2)),
  };
}

export async function getShopTopProducts(userId: string, query: AnalyticsQuery, limit = 5) {
  const seller = await requireOwnSeller(userId);
  const { currentStart, currentEnd } = parsePeriodDates(query);

  const grouped = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: {
      order: {
        sellerId: seller.id,
        status: { in: PAID_ORDER_STATUSES },
        createdAt: { gte: currentStart, lte: currentEnd },
      },
    },
    _sum: { quantity: true, subtotal: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });

  const products = await prisma.product.findMany({
    where: { id: { in: grouped.map((row) => row.productId) } },
    select: { id: true, name: true, slug: true, stock: true, isActive: true },
  });
  const byId = new Map(products.map((product) => [product.id, product]));

  return grouped.map((row, index) => {
    const product = byId.get(row.productId);
    return {
      rank: index + 1,
      productId: row.productId,
      productName: product?.name ?? "(produk dihapus)",
      slug: product?.slug ?? null,
      stock: product?.stock ?? 0,
      isActive: product?.isActive ?? false,
      quantitySold: row._sum.quantity ?? 0,
      revenue: Number(row._sum.subtotal ?? 0),
    };
  });
}

export async function getShopInsights(userId: string, query: AnalyticsQuery) {
  const seller = await requireOwnSeller(userId);
  const { currentStart, currentEnd, prevStart, prevEnd } = parsePeriodDates(query);

  const [conversion, topProducts, revenueAgg, revenuePrevAgg, activeProductCount, outOfStockCount, viewedProductIds] =
    await Promise.all([
      getShopConversion(userId, query),
      getShopTopProducts(userId, query, 5),
      prisma.order.aggregate({
        where: {
          sellerId: seller.id,
          status: { in: PAID_ORDER_STATUSES },
          createdAt: { gte: currentStart, lte: currentEnd },
        },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: {
          sellerId: seller.id,
          status: { in: PAID_ORDER_STATUSES },
          createdAt: { gte: prevStart, lte: prevEnd },
        },
        _sum: { total: true },
      }),
      prisma.product.count({ where: { sellerId: seller.id, isActive: true } }),
      prisma.product.count({ where: { sellerId: seller.id, isActive: true, stock: 0 } }),
      prisma.productView.findMany({
        where: { sellerId: seller.id, createdAt: { gte: currentStart, lte: currentEnd } },
        distinct: ["productId"],
        select: { productId: true },
      }),
    ]);

  const insights = buildShopInsights({
    revenue: Number(revenueAgg._sum.total ?? 0),
    orders: conversion.orders,
    views: conversion.views,
    conversionRate: conversion.conversionRate,
    revenuePrev: Number(revenuePrevAgg._sum.total ?? 0),
    ordersPrev: conversion.previous.orders,
    conversionRatePrev: conversion.previous.conversionRate,
    topProducts: topProducts.map((product) => ({
      name: product.productName,
      quantity: product.quantitySold,
      stock: product.stock,
    })),
    outOfStockCount,
    unviewedCount: Math.max(activeProductCount - viewedProductIds.length, 0),
    activeProductCount,
  });

  return {
    period: query.period,
    dateRange: { startDate: currentStart.toISOString(), endDate: currentEnd.toISOString() },
    insights,
  };
}
