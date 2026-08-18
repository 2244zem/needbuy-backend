import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../lib/apiError";
import { bulkDiscountFor, bulkSubtotal } from "../../lib/bulkPrice";
import { assertNotOwnStore } from "../sellers/service";

const cartItemSelect = {
  id: true,
  quantity: true,
  variant: true,
  priceAtAdd: true,
  subtotal: true,
  createdAt: true,
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      stock: true,
      isActive: true,
      bulkMinQty: true,
      bulkDiscountPercent: true,
      seller: { select: { id: true, storeName: true } },
      images: {
        select: { url: true },
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        take: 1,
      },
    },
  },
} satisfies Prisma.CartItemSelect;

async function ensureCart(userId: string) {
  const existing = await prisma.cart.findUnique({ where: { userId }, select: { id: true, budget: true } });
  if (existing) return existing;
  return prisma.cart.create({ data: { userId }, select: { id: true, budget: true } });
}

export async function getCart(userId: string) {
  const cart = await ensureCart(userId);
  const items = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    select: cartItemSelect,
    orderBy: { createdAt: "desc" },
  });

  const subtotal = items.reduce((sum, item) => sum.plus(item.subtotal), new Prisma.Decimal(0));

  const budget = cart.budget;
  const overBudget = budget !== null && subtotal.greaterThan(budget);
  const budgetPercentage =
    budget !== null && !budget.isZero()
      ? subtotal.dividedBy(budget).times(100).toNumber()
      : null;

  return {
    id: cart.id,
    budget,

    items: items.map((item) => ({
      ...item,
      bulkDiscountPercent: bulkDiscountFor(item.product, item.quantity),
    })),
    itemCount: items.length,
    subtotal,

    budgetCheck:
      budget === null
        ? null
        : {
            overBudget,
            remaining: budget.minus(subtotal),
            budgetPercentage: Number(budgetPercentage?.toFixed(2) ?? 0),
          },

    unavailableItems: items
      .filter((item) => !item.product.isActive || item.product.stock < item.quantity)
      .map((item) => ({
        cartItemId: item.id,
        productId: item.product.id,
        requested: item.quantity,
        available: item.product.isActive ? item.product.stock : 0,
      })),
  };
}

export async function getCartCount(userId: string) {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!cart) return { unreadCount: 0, totalQuantity: 0 };

  const aggregate = await prisma.cartItem.aggregate({
    where: { cartId: cart.id },
    _count: { id: true },
    _sum: { quantity: true },
  });

  return { unreadCount: aggregate._count.id || 0, totalQuantity: aggregate._sum.quantity || 0 };
}

export async function addItem(
  userId: string,
  productId: string,
  quantity: number,
  variant?: string | null
) {
  const cart = await ensureCart(userId);

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        price: true,
        stock: true,
        isActive: true,
        bulkMinQty: true,
        bulkDiscountPercent: true,
        sellerId: true,
        seller: { select: { vacationMode: true, storeName: true } },
      },
    });
    if (!product || !product.isActive) throw AppError.notFound("Produk nggak ketemu.");

    // Dihadang sedini mungkin biar penjual tahu sebelum sampai halaman bayar.
    // Penjaga yang sebenarnya tetap ada di checkout.
    await assertNotOwnStore(userId, [product.sellerId], tx);

    if (product.seller.vacationMode) {
      throw AppError.conflict(
        `Toko "${product.seller.storeName}" sedang libur dan belum menerima pesanan baru.`,
        "SELLER_ON_VACATION"
      );
    }

    const existing = await tx.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } },
      select: { id: true, quantity: true, priceAtAdd: true },
    });

    const newQuantity = (existing?.quantity ?? 0) + quantity;
    if (newQuantity > product.stock) {
      throw AppError.conflict(
        `Stoknya nggak cukup. Sisa ${product.stock}, kamu minta ${newQuantity}.`,
        "INSUFFICIENT_STOCK"
      );
    }

    const price = existing?.priceAtAdd ?? product.price;

    const subtotal = bulkSubtotal(price, newQuantity, product);

    const saved = existing
      ? await tx.cartItem.update({
          where: { id: existing.id },
          data: {
            quantity: newQuantity,
            subtotal,
            ...(variant !== undefined ? { variant: variant || null } : {}),
          },
          select: cartItemSelect,
        })
      : await tx.cartItem.create({
          data: {
            cartId: cart.id,
            productId,
            quantity: newQuantity,
            variant: variant || null,
            priceAtAdd: price,
            subtotal,
          },
          select: cartItemSelect,
        });

    return { ...saved, bulkDiscountPercent: bulkDiscountFor(product, newQuantity) };
  });
}

export async function updateItem(userId: string, cartItemId: string, quantity: number) {
  const cart = await ensureCart(userId);

  return prisma.$transaction(async (tx) => {
    const item = await tx.cartItem.findFirst({
      where: { id: cartItemId, cartId: cart.id },
      select: {
        id: true,
        priceAtAdd: true,
        product: {
          select: { stock: true, isActive: true, bulkMinQty: true, bulkDiscountPercent: true },
        },
      },
    });
    if (!item) throw AppError.notFound("Item cart nggak ketemu.");
    if (!item.product.isActive) throw AppError.conflict("Produk udah nggak dijual.", "PRODUCT_INACTIVE");

    if (quantity > item.product.stock) {
      throw AppError.conflict(
        `Stoknya nggak cukup. Sisa ${item.product.stock}, kamu minta ${quantity}.`,
        "INSUFFICIENT_STOCK"
      );
    }

    const saved = await tx.cartItem.update({
      where: { id: item.id },
      data: { quantity, subtotal: bulkSubtotal(item.priceAtAdd, quantity, item.product) },
      select: cartItemSelect,
    });

    return { ...saved, bulkDiscountPercent: bulkDiscountFor(item.product, quantity) };
  });
}

export async function removeItem(userId: string, cartItemId: string) {
  const cart = await ensureCart(userId);
  const deleted = await prisma.cartItem.deleteMany({ where: { id: cartItemId, cartId: cart.id } });
  if (deleted.count === 0) throw AppError.notFound("Item cart nggak ketemu.");
  return { deleted: true };
}

export async function clearCart(userId: string) {
  const cart = await ensureCart(userId);
  const result = await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  return { deleted: result.count };
}

export async function setBudget(userId: string, budget: number | null) {
  const cart = await ensureCart(userId);
  const updated = await prisma.cart.update({
    where: { id: cart.id },
    data: { budget: budget === null ? null : new Prisma.Decimal(budget) },
    select: { id: true, budget: true },
  });
  return updated;
}
