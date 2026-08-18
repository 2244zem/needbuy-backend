import { Router } from "express";
import { addressesRouter } from "../modules/addresses";
import { adminPublicRouter, adminRouter } from "../modules/admin";
import { authRouter } from "../modules/auth";
import { cartRouter } from "../modules/cart";
import { categoriesRouter } from "../modules/categories";
import { checkoutRouter } from "../modules/checkout";
import { couponsRouter } from "../modules/coupons";
import { messagesRouter } from "../modules/messages";
import { inventRouter } from "../modules/invent";
import { analyticsRouter } from "../modules/analytics";
import { dashboardRouter } from "../modules/dashboard";
import { needsRouter } from "../modules/needs";
import { notificationsRouter } from "../modules/notifications";
import { uploadsRouter } from "../modules/uploads";
import { ordersRouter } from "../modules/orders";
import { paymentsRouter } from "../modules/payments";
import { productsRouter } from "../modules/products";
import { savedProductsRouter } from "../modules/saved-products";
import { sellersRouter } from "../modules/sellers";
import { shoppingPlansRouter } from "../modules/shopping-plans";
import { usersRouter } from "../modules/users";
import { walletRouter } from "../modules/wallet";

import { aiRouter } from "../modules/ai";
import { reportsRouter } from "../modules/reports";
import { reviewsRouter } from "../modules/reviews";

export const MODULE_ROUTES = [
  { prefix: "/auth", router: authRouter },
  { prefix: "/users", router: usersRouter },
  { prefix: "/categories", router: categoriesRouter },
  { prefix: "/sellers", router: sellersRouter },
  { prefix: "/products", router: productsRouter },
  { prefix: "/invent", router: inventRouter },
  { prefix: "/analytics", router: analyticsRouter },
  { prefix: "/dashboard", router: dashboardRouter },
  { prefix: "/addresses", router: addressesRouter },
  { prefix: "/saved-products", router: savedProductsRouter },
  { prefix: "/needs", router: needsRouter },
  { prefix: "/shopping-plans", router: shoppingPlansRouter },
  { prefix: "/cart", router: cartRouter },
  { prefix: "/checkout", router: checkoutRouter },
  { prefix: "/orders", router: ordersRouter },
  { prefix: "/payments", router: paymentsRouter },
  { prefix: "/wallet", router: walletRouter },
  { prefix: "/coupons", router: couponsRouter },
  { prefix: "/messages", router: messagesRouter },
  { prefix: "/notifications", router: notificationsRouter },
  { prefix: "/uploads", router: uploadsRouter },
  { prefix: "/admin", router: adminRouter },
  { prefix: "/public", router: adminPublicRouter },
  { prefix: "/ai", router: aiRouter },
  { prefix: "/reviews", router: reviewsRouter },
  { prefix: "/reports", router: reportsRouter },
] as const;
export const apiV1Router = Router();

for (const { prefix, router } of MODULE_ROUTES) {
  apiV1Router.use(prefix, router);
}

type ExpressLayer = {
  route?: { path: string | string[]; methods: Record<string, boolean> };
};

export function listRegisteredRoutes(): string[] {
  const found: string[] = [];

  for (const { prefix, router } of MODULE_ROUTES) {
    const stack = (router as unknown as { stack: ExpressLayer[] }).stack;
    for (const layer of stack) {
      if (!layer.route) continue;
      const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
      for (const routePath of paths) {
        const full = normalize(`${prefix}${routePath === "/" ? "" : routePath}`);
        for (const [method, enabled] of Object.entries(layer.route.methods)) {
          if (enabled && method !== "_all") found.push(`${method.toUpperCase()} ${full}`);
        }
      }
    }
  }

  return [...new Set(found)].sort();
}

function normalize(path: string): string {
  const openApiStyle = path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
  return openApiStyle.length > 1 ? openApiStyle.replace(/\/$/, "") : openApiStyle;
}