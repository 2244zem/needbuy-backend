import { prisma } from "../../config/prisma";
import { getCommissionPercent } from "./config.service";

type RevenueBucketRow = { bucket: Date; gmv: number; revenue: number };
type CategoryRow = { name: string; revenue: number };

export async function dashboard() {
  const commissionPercent = await getCommissionPercent();

  const [
    users,
    sellers,
    activeSellers,
    products,
    activeProducts,
    needs,
    completedNeeds,
    orders,
    paidOrders,
    revenue,
    revenueBuckets,
    categoryRevenue,
    recentOrders,
    inactiveProductList,
  ] = await prisma.$transaction([
    prisma.user.count(),
    prisma.seller.count(),
    prisma.seller.count({ where: { status: "ACTIVE" } }),
    prisma.product.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.need.count(),
    prisma.need.count({ where: { status: "COMPLETED" } }),
    prisma.order.count(),
    prisma.order.count({ where: { payment: { status: "PAID" } } }),
    
    prisma.order.aggregate({
      where: { payment: { status: "PAID" } },
      _sum: { total: true, commissionAmount: true },
    }),

    prisma.$queryRaw<RevenueBucketRow[]>`
      SELECT date_trunc('month', o.created_at) AS bucket,
             COALESCE(SUM(o.total), 0)::float8 AS gmv,
             COALESCE(SUM(o.commission_amount), 0)::float8 AS revenue
      FROM orders o
      JOIN payments p ON p.order_id = o.id
      WHERE p.status = 'PAID'
        AND o.created_at >= date_trunc('month', now()) - interval '6 months'
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
      GROUP BY c.name
      ORDER BY revenue DESC
      LIMIT 5
    `,

    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
        user: { select: { name: true } },
        seller: { select: { storeName: true } },
      },
    }),

    prisma.product.findMany({
      where: { isActive: false },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, seller: { select: { storeName: true } } },
    }),
  ]);

  const inactiveProducts = products - activeProducts;
  const categoryTotal = categoryRevenue.reduce((sum, row) => sum + row.revenue, 0);

  const gmv = Number(revenue._sum.total ?? 0);
  const platform = Number(revenue._sum.commissionAmount ?? 0);

  return {
    users: { total: users },
    sellers: { total: sellers, active: activeSellers, suspended: sellers - activeSellers },
    products: { total: products, active: activeProducts, inactive: inactiveProducts },
    needs: { total: needs, completed: completedNeeds },
    orders: { total: orders, paid: paidOrders },
    revenue: {
      commissionPercent,
      
      gmv,
      
      platform,
    },

    revenueSeries: revenueBuckets.map((row) => ({
      month: row.bucket.toISOString().slice(0, 7),
      gmv: row.gmv,
      revenue: row.revenue,
    })),

    topCategories: categoryRevenue.map((row) => ({
      name: row.name,
      revenue: row.revenue,
      percentage: categoryTotal > 0 ? Math.round((row.revenue / categoryTotal) * 100) : 0,
    })),

    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customer: order.user.name,
      store: order.seller.storeName,
      amount: Number(order.total),
      status: order.status,
      createdAt: order.createdAt,
    })),

    pendingProducts: {
      total: inactiveProducts,
      items: inactiveProductList.map((product) => ({
        id: product.id,
        name: product.name,
        store: product.seller.storeName,
      })),
    },
  };
}
