import { OrderStatus, PlanStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { requireOwnSeller } from "../sellers/service";
import type {
  ActiveOrdersQuery,
  DashboardQuery,
  InventoryAlertsQuery,
  RecentOrdersQuery,
  TopNeedsQuery,
} from "./schema";

const PAID_ORDER_STATUSES: OrderStatus[] = ["PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED"];

const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "WAITING_PAYMENT",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
];

const PENDING_ORDER_STATUSES: OrderStatus[] = ["WAITING_PAYMENT", "PROCESSING"];

export async function getSummaryCards(userId: string, query: DashboardQuery) {
  const seller = await requireOwnSeller(userId);
  const { currentStart, currentEnd, prevStart, prevEnd } = parsePeriodDates(query);

  const [
    currentRevenueRaw,
    prevRevenueRaw,
    currentOrdersCount,
    prevOrdersCount,
    currentRecommendations,
    prevRecommendationsCount,
    currentActivePlansCount,
    prevActivePlansCount,
  ] = await Promise.all([
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
    prisma.order.count({
      where: { sellerId: seller.id, createdAt: { gte: currentStart, lte: currentEnd } },
    }),
    prisma.order.count({
      where: { sellerId: seller.id, createdAt: { gte: prevStart, lte: prevEnd } },
    }),
    prisma.recommendation.findMany({
      where: { product: { sellerId: seller.id }, createdAt: { gte: currentStart, lte: currentEnd } },
      select: { matchScore: true },
    }),
    prisma.recommendation.count({
      where: { product: { sellerId: seller.id }, createdAt: { gte: prevStart, lte: prevEnd } },
    }),
    prisma.shoppingPlan.count({
      where: {
        status: { in: ["READY", "DRAFT"] as PlanStatus[] },
        items: { some: { product: { sellerId: seller.id } } },
        updatedAt: { gte: currentStart, lte: currentEnd },
      },
    }),
    prisma.shoppingPlan.count({
      where: {
        status: { in: ["READY", "DRAFT"] as PlanStatus[] },
        items: { some: { product: { sellerId: seller.id } } },
        updatedAt: { gte: prevStart, lte: prevEnd },
      },
    }),
  ]);

  const totalRevenue = Number(currentRevenueRaw._sum.total ?? 0);
  const prevRevenue = Number(prevRevenueRaw._sum.total ?? 0);

  const totalMatches = currentRecommendations.length;
  const highPrecisionCount = currentRecommendations.filter((r) => Number(r.matchScore) >= 85).length;
  const lowPrecisionCount = totalMatches - highPrecisionCount;

  return {
    totalPendapatan: {
      value: totalRevenue,
      growthPercentage: calculateGrowth(totalRevenue, prevRevenue),
      formatted: `Rp ${totalRevenue.toLocaleString("id-ID")}`,
    },
    totalOrderan: {
      value: currentOrdersCount,
      growthPercentage: calculateGrowth(currentOrdersCount, prevOrdersCount),
    },
    tingkatKecocokan: {
      totalMatches,
      growthPercentage: calculateGrowth(totalMatches, prevRecommendationsCount),
      presisiTinggi: {
        count: highPrecisionCount,
        percentage: totalMatches > 0 ? Math.round((highPrecisionCount / totalMatches) * 100) : 0,
      },
      presisiRendah: {
        count: lowPrecisionCount,
        percentage: totalMatches > 0 ? Math.round((lowPrecisionCount / totalMatches) * 100) : 0,
      },
    },
    rencanaBelanjaAktif: {
      value: currentActivePlansCount,
      growthPercentage: calculateGrowth(currentActivePlansCount, prevActivePlansCount),
    },
  };
}

export async function getChartData(userId: string, query: DashboardQuery) {
  const seller = await requireOwnSeller(userId);
  const { currentStart, currentEnd } = parsePeriodDates(query);

  const recommendations = await prisma.recommendation.findMany({
    where: {
      product: { sellerId: seller.id },
      createdAt: { gte: currentStart, lte: currentEnd },
    },
    select: { matchScore: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const chartMap = new Map<string, { date: string; highPrecision: number; lowPrecision: number; total: number }>();

  for (const item of recommendations) {
    const dateStr = item.createdAt.toISOString().split("T")[0];
    const existing = chartMap.get(dateStr) ?? { date: dateStr, highPrecision: 0, lowPrecision: 0, total: 0 };
    if (Number(item.matchScore) >= 85) {
      existing.highPrecision += 1;
    } else {
      existing.lowPrecision += 1;
    }
    existing.total += 1;
    chartMap.set(dateStr, existing);
  }

  return Array.from(chartMap.values());
}

export async function getTopNeeds(userId: string, query: TopNeedsQuery) {
  const seller = await requireOwnSeller(userId);
  const { currentStart, currentEnd } = parsePeriodDates(query);
  const limit = query.limit ?? 5;

  const topNeedsRaw = await prisma.recommendation.groupBy({
    by: ["productId"],
    where: {
      product: { sellerId: seller.id },
      createdAt: { gte: currentStart, lte: currentEnd },
    },
    _count: { _all: true },
    _avg: { matchScore: true },
    orderBy: { _count: { productId: "desc" } },
    take: limit,
  });

  const productIds = topNeedsRaw.map((t) => t.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, category: { select: { name: true } } },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  return topNeedsRaw.map((item) => {
    const prod = productMap.get(item.productId);
    return {
      productId: item.productId,
      productName: prod?.name ?? "Produk",
      categoryName: prod?.category?.name ?? "Umum",
      matchCount: item._count._all,
      averageMatchScore: Number((item._avg.matchScore ?? 0).toFixed(1)),
    };
  });
}

export async function getRecentOrders(userId: string, query: RecentOrdersQuery) {
  const seller = await requireOwnSeller(userId);
  const limit = query.limit ?? 10;

  const where: any = { sellerId: seller.id };
  if (query.status) {
    where.status = query.status as OrderStatus;
  }

  const recentOrdersRaw = await prisma.order.findMany({
    where,
    select: {
      id: true,
      orderNumber: true,
      total: true,
      status: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return recentOrdersRaw.map((o) => ({
    orderId: o.id,
    orderNumber: o.orderNumber,
    customer: o.user.name,
    customerEmail: o.user.email,
    jumlah: Number(o.total),
    status: o.status,
    statusLabel: mapOrderStatusLabel(o.status),
    createdAt: o.createdAt,
  }));
}

export async function getOverview(userId: string, query: DashboardQuery) {
  const [cards, chart, topNeeds, recentOrders] = await Promise.all([
    getSummaryCards(userId, query),
    getChartData(userId, query),
    getTopNeeds(userId, { ...query, limit: 5 }),
    getRecentOrders(userId, { limit: 10 }),
  ]);

  const { currentStart, currentEnd } = parsePeriodDates(query);

  return {
    period: query.period,
    dateRange: {
      startDate: currentStart.toISOString(),
      endDate: currentEnd.toISOString(),
    },
    summaryCards: cards,
    chartData: chart,
    topKecocokanNeed: topNeeds,
    riwayatOrder: recentOrders,
  };
}

export async function getTotalSales(userId: string, query: DashboardQuery) {
  const seller = await requireOwnSeller(userId);
  const { currentStart, currentEnd, prevStart, prevEnd } = parsePeriodDates(query);

  const paid = { sellerId: seller.id, status: { in: PAID_ORDER_STATUSES } };

  const [allTime, current, previous] = await Promise.all([
    prisma.order.aggregate({ where: paid, _sum: { total: true }, _count: { _all: true } }),
    prisma.order.aggregate({
      where: { ...paid, createdAt: { gte: currentStart, lte: currentEnd } },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where: { ...paid, createdAt: { gte: prevStart, lte: prevEnd } },
      _sum: { total: true },
    }),
  ]);

  const totalAllTime = Number(allTime._sum.total ?? 0);
  const totalPeriod = Number(current._sum.total ?? 0);

  return {
    period: query.period,
    value: totalAllTime,
    formatted: formatRupiah(totalAllTime),
    periodValue: totalPeriod,
    periodFormatted: formatRupiah(totalPeriod),
    orderCount: allTime._count._all,
    periodOrderCount: current._count._all,
    growthPercentage: calculateGrowth(totalPeriod, Number(previous._sum.total ?? 0)),
  };
}

export async function getPendingOrders(userId: string) {
  const seller = await requireOwnSeller(userId);

  const [total, waitingPayment, processing] = await Promise.all([
    prisma.order.count({ where: { sellerId: seller.id, status: { in: PENDING_ORDER_STATUSES } } }),
    prisma.order.count({ where: { sellerId: seller.id, status: "WAITING_PAYMENT" } }),
    prisma.order.count({ where: { sellerId: seller.id, status: "PROCESSING" } }),
  ]);

  return { value: total, breakdown: { waitingPayment, processing } };
}

export async function getCustomerRating(userId: string) {
  const seller = await requireOwnSeller(userId);

  const [aggregate, distributionRaw] = await Promise.all([
    prisma.review.aggregate({
      where: { product: { sellerId: seller.id } },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.review.groupBy({
      by: ["rating"],
      where: { product: { sellerId: seller.id } },
      _count: { _all: true },
    }),
  ]);

  const distribution: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  for (const row of distributionRaw) distribution[String(row.rating)] = row._count._all;

  const average = aggregate._avg.rating ?? 0;

  return {
    value: Number(average.toFixed(2)),
    scale: 5,
    reviewCount: aggregate._count._all,
    distribution,
  };
}

export async function getProductViews(userId: string, query: DashboardQuery) {
  const seller = await requireOwnSeller(userId);
  const { currentStart, currentEnd, prevStart, prevEnd } = parsePeriodDates(query);

  const [current, previous, uniqueVisitors] = await Promise.all([
    prisma.productView.count({
      where: { sellerId: seller.id, createdAt: { gte: currentStart, lte: currentEnd } },
    }),
    prisma.productView.count({
      where: { sellerId: seller.id, createdAt: { gte: prevStart, lte: prevEnd } },
    }),
    prisma.productView.findMany({
      where: {
        sellerId: seller.id,
        userId: { not: null },
        createdAt: { gte: currentStart, lte: currentEnd },
      },
      distinct: ["userId"],
      select: { userId: true },
    }),
  ]);

  return {
    period: query.period,
    value: current,
    uniqueVisitors: uniqueVisitors.length,
    growthPercentage: calculateGrowth(current, previous),
    dateRange: { startDate: currentStart.toISOString(), endDate: currentEnd.toISOString() },
  };
}

const BUCKET_BY_PERIOD = {
  day: "hour",
  week: "day",
  month: "day",
  year: "month",
} as const;

type SalesBucketRow = { bucket: Date; items: number; orders: number; revenue: Prisma.Decimal | null };

export async function getSalesPerformance(userId: string, query: DashboardQuery) {
  const seller = await requireOwnSeller(userId);
  const { currentStart, currentEnd } = parsePeriodDates(query);
  const granularity = BUCKET_BY_PERIOD[query.period];

  const rows = await prisma.$queryRaw<SalesBucketRow[]>`
    SELECT date_trunc(${Prisma.raw(`'${granularity}'`)}, o.created_at) AS bucket,
           COALESCE(SUM(oi.quantity), 0)::int AS items,
           COUNT(DISTINCT o.id)::int AS orders,
           COALESCE(SUM(oi.subtotal), 0) AS revenue
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.seller_id = ${seller.id}
      AND o.status::text IN (${Prisma.join(PAID_ORDER_STATUSES)})
      AND o.created_at >= ${currentStart}
      AND o.created_at <= ${currentEnd}
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  const points = rows.map((row) => ({
    bucket: row.bucket.toISOString(),
    items: row.items,
    orders: row.orders,
    revenue: Number(row.revenue ?? 0),
  }));

  return {
    period: query.period,
    granularity,
    dateRange: { startDate: currentStart.toISOString(), endDate: currentEnd.toISOString() },
    totals: {
      items: points.reduce((sum, point) => sum + point.items, 0),
      orders: points.reduce((sum, point) => sum + point.orders, 0),
      revenue: points.reduce((sum, point) => sum + point.revenue, 0),
    },
    points,
  };
}

export async function getInventoryAlerts(userId: string, query: InventoryAlertsQuery) {
  const seller = await requireOwnSeller(userId);
  const threshold = query.threshold;

  const products = await prisma.product.findMany({
    where: { sellerId: seller.id, isActive: true, stock: { lte: threshold } },
    select: { id: true, name: true, slug: true, stock: true, price: true },
    orderBy: { stock: "asc" },
    take: query.limit,
  });

  const items = products.map((product) => ({
    productId: product.id,
    productName: product.name,
    slug: product.slug,
    stock: product.stock,
    price: Number(product.price),
    level: product.stock === 0 ? ("OUT_OF_STOCK" as const) : ("LOW_STOCK" as const),
  }));

  return {
    threshold,
    outOfStockCount: items.filter((item) => item.level === "OUT_OF_STOCK").length,
    lowStockCount: items.filter((item) => item.level === "LOW_STOCK").length,
    items,
  };
}

export async function getActiveOrders(userId: string, query: ActiveOrdersQuery) {
  const seller = await requireOwnSeller(userId);
  const where = { sellerId: seller.id, status: { in: ACTIVE_ORDER_STATUSES } };

  const [count, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        total: true,
        status: true,
        createdAt: true,
        user: { select: { name: true } },
        payment: { select: { method: true } },
        items: { select: { productName: true, quantity: true } },
      },
      orderBy: { createdAt: "desc" },
      take: query.limit,
    }),
  ]);

  return {
    value: count,
    items: orders.map((order) => ({
      orderId: order.id,
      orderNumber: order.orderNumber,
      customer: order.user.name,
      amount: Number(order.total),
      status: order.status,
      statusLabel: mapOrderStatusLabel(order.status),
      orderType: order.payment?.method ?? null,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      products: order.items.map((item) => item.productName),
      createdAt: order.createdAt,
    })),
  };
}

function formatRupiah(value: number): string {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

function parsePeriodDates(query: DashboardQuery) {
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

function mapOrderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case "WAITING_PAYMENT":
      return "Pending (Menunggu Pembayaran)";
    case "PROCESSING":
      return "Proses (Diproses Seller)";
    case "SHIPPED":
      return "Dikirim";
    case "DELIVERED":
      return "Sampai";
    case "COMPLETED":
      return "Lunas / Selesai";
    case "CANCELLED":
      return "Batal";
    default:
      return status;
  }
}
