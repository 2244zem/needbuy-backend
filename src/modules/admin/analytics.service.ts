import { prisma } from "../../config/prisma";
import { PAID_ORDER_WHERE } from "../../lib/revenue";

const WINDOW_DAYS = 30;

type SeriesRow = { bucket: Date; revenue: number };
type CategoryRow = { name: string; revenue: number };
type StoreRow = { name: string; sales: number; previous_sales: number };
type StatusRow = { status: string; count: number };

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

export async function analytics() {
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);
  const previousStart = new Date(now.getTime() - 2 * WINDOW_DAYS * 86_400_000);

  const paidIn = (from: Date, to: Date) => ({
    ...PAID_ORDER_WHERE,
    createdAt: { gte: from, lt: to },
  });

  const [
    revenueNow,
    revenuePrev,
    ordersNow,
    ordersPrev,
    buyersNow,
    buyersPrev,
    viewsNow,
    viewsPrev,
    revenueBuckets,
    categoryRevenue,
    storeRows,
    statusRows,
  ] = await prisma.$transaction([
    prisma.order.aggregate({
      where: paidIn(windowStart, now),
      _sum: { commissionAmount: true },
    }),
    prisma.order.aggregate({
      where: paidIn(previousStart, windowStart),
      _sum: { commissionAmount: true },
    }),

    prisma.order.count({ where: { createdAt: { gte: windowStart, lt: now } } }),
    prisma.order.count({ where: { createdAt: { gte: previousStart, lt: windowStart } } }),

    prisma.order.findMany({
      where: { createdAt: { gte: windowStart, lt: now } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: previousStart, lt: windowStart } },
      distinct: ["userId"],
      select: { userId: true },
    }),

    prisma.productView.count({ where: { createdAt: { gte: windowStart, lt: now } } }),
    prisma.productView.count({
      where: { createdAt: { gte: previousStart, lt: windowStart } },
    }),

    prisma.$queryRaw<SeriesRow[]>`
      SELECT date_trunc('month', o.created_at) AS bucket,
             COALESCE(SUM(o.commission_amount), 0)::float8 AS revenue
      FROM orders o
      JOIN payments p ON p.order_id = o.id
      WHERE p.status = 'PAID'
        AND o.created_at >= date_trunc('month', now()) - interval '11 months'
      GROUP BY 1
      ORDER BY 1
    `,

    prisma.$queryRaw<CategoryRow[]>`
      SELECT c.name AS name, SUM(oi.subtotal)::float8 AS revenue
      FROM order_items oi
      JOIN products pr ON pr.id = oi.product_id
      JOIN categories c ON c.id = pr.category_id
      JOIN orders o ON o.id = oi.order_id
      JOIN payments p ON p.order_id = o.id
      WHERE p.status = 'PAID'
        AND o.created_at >= ${windowStart}
      GROUP BY c.name
      ORDER BY revenue DESC
      LIMIT 6
    `,

    prisma.$queryRaw<StoreRow[]>`
      SELECT s.store_name AS name,
             COALESCE(SUM(o.total) FILTER (WHERE o.created_at >= ${windowStart}), 0)::float8 AS sales,
             COALESCE(SUM(o.total) FILTER (WHERE o.created_at <  ${windowStart}), 0)::float8 AS previous_sales
      FROM orders o
      JOIN payments p ON p.order_id = o.id
      JOIN sellers s ON s.id = o.seller_id
      WHERE p.status = 'PAID'
        AND o.created_at >= ${previousStart}
      GROUP BY s.store_name
      ORDER BY sales DESC
      LIMIT 5
    `,

    prisma.$queryRaw<StatusRow[]>`
      SELECT o.status::text AS status, COUNT(*)::int AS count
      FROM orders o
      WHERE o.created_at >= ${windowStart}
      GROUP BY o.status
    `,
  ]);

  const revenue = Number(revenueNow._sum.commissionAmount ?? 0);
  const revenuePrevious = Number(revenuePrev._sum.commissionAmount ?? 0);
  const activeUsers = buyersNow.length;
  const activeUsersPrevious = buyersPrev.length;

  const conversionRate = viewsNow > 0 ? Number(((ordersNow / viewsNow) * 100).toFixed(2)) : 0;
  const conversionPrevious =
    viewsPrev > 0 ? Number(((ordersPrev / viewsPrev) * 100).toFixed(2)) : 0;

  const categoryTotal = categoryRevenue.reduce((sum, row) => sum + row.revenue, 0);
  const statusTotal = statusRows.reduce((sum, row) => sum + row.count, 0);

  return {
    windowDays: WINDOW_DAYS,

    totals: {
      revenue,
      orders: ordersNow,
      activeUsers,
      conversionRate,
    },

    changes: {
      revenue: pctChange(revenue, revenuePrevious),
      orders: pctChange(ordersNow, ordersPrev),
      activeUsers: pctChange(activeUsers, activeUsersPrevious),
      conversionRate: pctChange(conversionRate, conversionPrevious),
    },

    revenueSeries: revenueBuckets.map((row) => ({
      month: row.bucket.toISOString().slice(0, 7),
      revenue: row.revenue,
    })),

    topCategories: categoryRevenue.map((row) => ({
      name: row.name,
      revenue: row.revenue,
      percentage: categoryTotal > 0 ? Math.round((row.revenue / categoryTotal) * 100) : 0,
    })),

    topStores: storeRows.map((row) => ({
      name: row.name,
      sales: row.sales,
      growth: pctChange(row.sales, row.previous_sales),
    })),

    ordersByStatus: statusRows.map((row) => ({
      status: row.status,
      count: row.count,
      percentage: statusTotal > 0 ? Math.round((row.count / statusTotal) * 100) : 0,
    })),
  };
}
