import { Prisma } from "@prisma/client";
import { logger } from "../../config/logger";
import { prisma } from "../../config/prisma";
import { AppError } from "../../lib/apiError";
import { bulkSubtotal } from "../../lib/bulkPrice";
import { commissionFor } from "../../lib/commission";
import { generateMidtransOrderId, generateOrderNumber } from "../../lib/orderNumber";
import { requireOwnedAddress } from "../addresses/service";
import { assertNotOwnStore } from "../sellers/service";
import { splitDiscount } from "../../lib/coupon";
import { consumeCoupon, grantRandomReward, resolveCoupon } from "../coupons/redeem.service";
import { sendOrderCard } from "../messages/service";
import { debitForOrder } from "../wallet/service";
import { pushCreated } from "../notifications/service";
import { addEvent as addTrackingEvent } from "../orders/tracking.service";
import { stageForStatus } from "../../lib/tracking";
import { getCommissionPercent } from "../admin/config.service";
import type { CheckoutInput } from "./schema";

type CartLine = {
  id: string;
  quantity: number;
  variant: string | null;
  priceAtAdd: Prisma.Decimal;
  product: {
    id: string;
    name: string;
    slug: string;
    stock: number;
    isActive: boolean;
    sellerId: string;
    bulkMinQty: number | null;
    bulkDiscountPercent: number | null;
    seller: { vacationMode: boolean; storeName: string };
    images: { url: string }[];
  };
};

const MAX_TX_RETRIES = 3;

const cartLineSelect = {
  id: true,
  quantity: true,
  variant: true,
  priceAtAdd: true,
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      stock: true,
      isActive: true,
      sellerId: true,

      bulkMinQty: true,
      bulkDiscountPercent: true,
      seller: { select: { vacationMode: true, storeName: true } },
      images: {
        select: { url: true },
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        take: 1,
      },
    },
  },
} satisfies Prisma.CartItemSelect;

function selectionWhere(cartId: string, cartItemIds?: string[]): Prisma.CartItemWhereInput {
  return cartItemIds ? { cartId, id: { in: cartItemIds } } : { cartId };
}

function assertSelectionComplete(items: CartLine[], cartItemIds?: string[]) {
  if (!cartItemIds) return;
  const found = new Set(items.map((item) => item.id));
  const missing = cartItemIds.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw AppError.badRequest(
      "Sebagian item yang dipilih udah nggak ada di keranjang. Muat ulang halaman.",
      "CART_ITEM_NOT_FOUND"
    );
  }
}

async function loadCartLines(userId: string, cartItemIds?: string[]): Promise<CartLine[]> {
  const cart = await prisma.cart.findUnique({ where: { userId }, select: { id: true } });
  if (!cart) throw AppError.badRequest("Cart kamu kosong.", "CART_EMPTY");

  const items = await prisma.cartItem.findMany({
    where: selectionWhere(cart.id, cartItemIds),
    select: cartLineSelect,
  });

  assertSelectionComplete(items, cartItemIds);
  if (items.length === 0) throw AppError.badRequest("Cart kamu kosong.", "CART_EMPTY");
  return items;
}

function groupBySeller(items: CartLine[]): Map<string, CartLine[]> {
  const groups = new Map<string, CartLine[]>();
  for (const item of items) {
    const list = groups.get(item.product.sellerId) ?? [];
    list.push(item);
    groups.set(item.product.sellerId, list);
  }
  return groups;
}

function findStockProblems(items: CartLine[]) {
  return items
    .filter((item) => !item.product.isActive || item.product.stock < item.quantity)
    .map((item) => ({
      productId: item.product.id,
      productName: item.product.name,
      requested: item.quantity,
      available: item.product.isActive ? item.product.stock : 0,
    }));
}

export async function preview(userId: string, shippingCostPerOrder = 0, cartItemIds?: string[]) {
  const items = await loadCartLines(userId, cartItemIds);
  const problems = findStockProblems(items);
  const groups = groupBySeller(items);

  const sellers = await prisma.seller.findMany({
    where: { id: { in: [...groups.keys()] } },
    select: { id: true, storeName: true },
  });
  const sellerName = new Map(sellers.map((seller) => [seller.id, seller.storeName]));

  const shipping = new Prisma.Decimal(shippingCostPerOrder);
  const orders = [...groups.entries()].map(([sellerId, lines]) => {
    const subtotal = lines.reduce(
      (sum, line) => sum.plus(bulkSubtotal(line.priceAtAdd, line.quantity, line.product)),
      new Prisma.Decimal(0)
    );
    return {
      sellerId,
      storeName: sellerName.get(sellerId) ?? null,
      items: lines.map((line) => ({
        cartItemId: line.id,
        productId: line.product.id,
        productName: line.product.name,

        productSlug: line.product.slug,
        imageUrl: line.product.images[0]?.url ?? null,
        quantity: line.quantity,
        variant: line.variant,
        price: line.priceAtAdd,
        subtotal: bulkSubtotal(line.priceAtAdd, line.quantity, line.product),

        bulkDiscountPercent:
          line.priceAtAdd.times(line.quantity).equals(bulkSubtotal(line.priceAtAdd, line.quantity, line.product))
            ? 0
            : (line.product.bulkDiscountPercent ?? 0),
      })),
      subtotal,
      shippingCost: shipping,
      total: subtotal.plus(shipping),
    };
  });

  return {
    orderCount: orders.length,
    orders,
    grandTotal: orders.reduce((sum, order) => sum.plus(order.total), new Prisma.Decimal(0)),
    stockProblems: problems,
    canCheckout: problems.length === 0,
  };
}

export async function checkout(userId: string, input: CheckoutInput) {
  await requireOwnedAddress(userId, input.addressId);

  for (let attempt = 0; attempt < MAX_TX_RETRIES; attempt += 1) {
    try {
      const created = await runCheckoutTransaction(userId, input);

      await pushOrderNotifications(created.map((order) => order.orderId));

      await sendOrderCards(userId, created).catch((error) => {
        logger.error({ err: error, userId }, "gagal kirim kartu pesanan ke chat");
      });

      const reward = await grantRandomReward(userId).catch((error) => {
        logger.error({ err: error, userId }, "gagal kasih kupon hadiah checkout");
        return null;
      });

      return created.map((order) => ({ ...order, reward }));
    } catch (error) {
      const isWriteConflict =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
      if (!isWriteConflict || attempt === MAX_TX_RETRIES - 1) throw error;
    }
  }

  throw AppError.conflict("Ada bentrok stok, coba lagi ya.", "STOCK_CONFLICT");
}

async function sendOrderCards(buyerId: string, created: { orderId: string }[]) {
  const orders = await prisma.order.findMany({
    where: { id: { in: created.map((order) => order.orderId) } },
    select: { id: true, orderNumber: true, sellerId: true },
  });

  for (const order of orders) {
    await sendOrderCard({
      buyerId,
      sellerId: order.sellerId,
      orderId: order.id,
      orderNumber: order.orderNumber,
    });
  }
}

async function pushOrderNotifications(orderIds: string[]) {
  try {
    const rows = await prisma.notification.findMany({
      where: { orderId: { in: orderIds }, type: "ORDER_NEW" },
      select: { id: true, userId: true },
    });
    await pushCreated(rows);
  } catch (error) {
    logger.error({ err: error, orderIds }, "gagal push notifikasi order baru");
  }
}

async function runCheckoutTransaction(userId: string, input: CheckoutInput) {
  const commissionPercent = new Prisma.Decimal(await getCommissionPercent());

  return prisma.$transaction(
    async (tx) => {
      const cart = await tx.cart.findUnique({ where: { userId }, select: { id: true } });
      if (!cart) throw AppError.badRequest("Cart kamu kosong.", "CART_EMPTY");

      const items = await tx.cartItem.findMany({
        where: selectionWhere(cart.id, input.cartItemIds),
        select: cartLineSelect,
      });
      assertSelectionComplete(items, input.cartItemIds);
      if (items.length === 0) throw AppError.badRequest("Cart kamu kosong.", "CART_EMPTY");

      // Penjaga utama anti-beli-toko-sendiri. Ditaruh di dalam transaksi, bukan
      // hanya di keranjang: barang bisa masuk keranjang lebih dulu lalu user
      // mendaftar jadi penjual, dan cek di luar transaksi bisa dilewati balapan.
      await assertNotOwnStore(
        userId,
        items.map((item) => item.product.sellerId),
        tx
      );

      const onVacation = [
        ...new Set(
          items.filter((item) => item.product.seller.vacationMode).map((item) => item.product.seller.storeName)
        ),
      ];
      if (onVacation.length > 0) {
        throw AppError.conflict(
          `Toko ${onVacation.map((name) => `"${name}"`).join(", ")} sedang libur. Hapus barangnya dari keranjang atau tunggu toko buka kembali.`,
          "SELLER_ON_VACATION"
        );
      }

      const problems = findStockProblems(items);
      if (problems.length > 0) {
        throw new AppError(
          409,
          "INSUFFICIENT_STOCK",
          "Sebagian item nggak punya stok yang cukup.",
          problems.map((problem) => ({
            path: problem.productId,
            message: `${problem.productName}: diminta ${problem.requested}, tersedia ${problem.available}`,
          }))
        );
      }

      const shipping = new Prisma.Decimal(input.shippingCost);
      const groups = groupBySeller(items);
      const isCod = input.paymentMethod === "COD";
      const isNeedPay = input.paymentMethod === "NEEDPAY";
      const created: {
        orderId: string;
        orderNumber: string;
        midtransOrderId: string;
        paymentMethod: "MIDTRANS" | "COD" | "NEEDPAY";
      }[] = [];

      const groupList = [...groups.entries()].map(([sellerId, lines]) => ({
        sellerId,
        lines,
        subtotal: lines.reduce(
          (sum, line) => sum.plus(bulkSubtotal(line.priceAtAdd, line.quantity, line.product)),
          new Prisma.Decimal(0)
        ),
      }));

      const grandSubtotal = groupList.reduce((sum, g) => sum.plus(g.subtotal), new Prisma.Decimal(0));
      const totalShipping = shipping.times(groupList.length);

      const coupon = input.couponCode
        ? await resolveCoupon(tx, userId, input.couponCode, grandSubtotal, totalShipping)
        : null;

      const discounts = coupon
        ? splitDiscount(groupList.map((g) => g.subtotal), coupon.discount)
        : groupList.map(() => new Prisma.Decimal(0));

      if (coupon) await consumeCoupon(tx, coupon.claimId);

      for (const [index, group] of groupList.entries()) {
        const { sellerId, lines, subtotal } = group;
        const discount = discounts[index];
        const orderNumber = generateOrderNumber();

        const orderTotal = Prisma.Decimal.max(
          subtotal.plus(shipping).minus(discount),
          new Prisma.Decimal(0)
        );
        const commissionAmount = commissionFor(orderTotal, commissionPercent);

        const order = await tx.order.create({
          data: {
            orderNumber,
            userId,
            sellerId,
            addressId: input.addressId,
            status: isCod || isNeedPay ? "PROCESSING" : "WAITING_PAYMENT",
            subtotal,
            shippingCost: shipping,
            discount,
            couponId: coupon?.couponId ?? null,
            total: orderTotal,
            commissionPercent,
            commissionAmount,
            items: {
              create: lines.map((line) => ({
                productId: line.product.id,
                productName: line.product.name,
                variant: line.variant,
                quantity: line.quantity,
                price: line.priceAtAdd,
                subtotal: bulkSubtotal(line.priceAtAdd, line.quantity, line.product),
              })),
            },
          },
          select: { id: true, orderNumber: true },
        });

        for (const line of lines) {
          const updated = await tx.product.updateMany({
            where: { id: line.product.id, stock: { gte: line.quantity } },
            data: {
              stock: { decrement: line.quantity },
              ...(isCod || isNeedPay ? { soldCount: { increment: line.quantity } } : {}),
            },
          });
          if (updated.count === 0) {
            throw AppError.conflict(
              `Stok ${line.product.name} keburu habis. Coba lagi ya.`,
              "STOCK_CONFLICT"
            );
          }
        }

        if (isNeedPay) {
          await debitForOrder(
            tx,
            userId,
            order.id,
            orderTotal,
            `Pembayaran order ${order.orderNumber}`
          );
        }

        const midtransOrderId = generateMidtransOrderId(order.orderNumber);
        await tx.payment.create({
          data: {
            orderId: order.id,
            status: isNeedPay ? "PAID" : "PENDING",
            method: input.paymentMethod,
            midtransOrderId,
            ...(isNeedPay ? { paidAt: new Date() } : {}),
          },
        });

        // Order COD dan NeedPay lahir langsung di PROCESSING, jadi tidak
        // pernah melewati applyTransition yang biasanya menuliskan event
        // tracking pertama. Tanpa ini halaman lacak paket kosong melompong
        // dan pembeli mengira pesanannya belum diproses.
        if (isCod || isNeedPay) {
          const stage = stageForStatus("PROCESSING");
          if (stage) {
            await addTrackingEvent(tx, {
              orderId: order.id,
              stage: stage.stage,
              description: stage.description,
            });
          }
        }

        const owner = await tx.seller.findUnique({
          where: { id: sellerId },
          select: { userId: true },
        });
        if (owner) {
          const barang = lines
            .map((line) => `${line.product.name} x${line.quantity}`)
            .join(", ");
          await tx.notification.create({
            data: {
              userId: owner.userId,
              type: "ORDER_NEW",
              title: "Orderan baru masuk",
              message: `Order ${order.orderNumber} (${input.paymentMethod}): ${barang}`,
              orderId: order.id,
            },
          });
        }

        created.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          midtransOrderId,
          paymentMethod: input.paymentMethod,
        });
      }

      await tx.cartItem.deleteMany({ where: { id: { in: items.map((item) => item.id) } } });

      return created;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 }
  );
}
