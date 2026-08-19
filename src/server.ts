import { buildApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { prisma } from "./config/prisma";
import { attachNotificationSocket, NOTIFICATION_WS_PATH } from "./modules/notifications/ws";
import { settleCompletedOrders } from "./modules/wallet/service";

const app = buildApp();

// Render (dan sebagian besar PaaS) mewajibkan proses mendengar di 0.0.0.0,
// bukan hanya loopback, supaya health check dari luar container bisa masuk.
const server = app.listen(env.PORT, "0.0.0.0", () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV, baseUrl: env.API_BASE_URL, wsPath: NOTIFICATION_WS_PATH },
    "NeedBuy backend listening"
  );
});

const wss = attachNotificationSocket(server);

// Pencairan hasil penjualan disapu tiap jam. Pengkreditan sebenarnya sudah
// terjadi langsung saat pesanan selesai; ini jaring pengaman untuk pesanan
// yang statusnya sempat berubah tapi dompetnya belum terisi karena proses
// mati di tengah jalan.
const SETTLEMENT_INTERVAL_MS = 60 * 60 * 1000;

async function jalankanPencairan() {
  try {
    const hasil = await settleCompletedOrders();
    if (hasil.settled > 0) logger.info(hasil, "pencairan hasil penjualan");
  } catch (error) {
    logger.error({ err: error }, "penyapuan pencairan gagal");
  }
}

// Sekali saat start supaya sisa dari proses sebelumnya tidak menunggu sejam.
void jalankanPencairan();
const settlementTimer = setInterval(jalankanPencairan, SETTLEMENT_INTERVAL_MS);
settlementTimer.unref();

async function shutdown(signal: string) {
  logger.info({ signal }, "shutting down");
  clearInterval(settlementTimer);
  for (const client of wss.clients) client.close(1001, "server shutting down");
  wss.close();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "unhandled promise rejection");
});
