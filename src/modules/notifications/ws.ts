import type { UserRole } from "@prisma/client";
import jwt from "jsonwebtoken";
import type { Server } from "node:http";
import { WebSocketServer } from "ws";
import { env, isOriginAllowed } from "../../config/env";
import { logger } from "../../config/logger";
import { register } from "./hub";
import { unreadCount } from "./service";

export const NOTIFICATION_WS_PATH = "/ws/notifications";

type AccessTokenPayload = { sub: string; role: UserRole };

export function attachNotificationSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    if (url.pathname !== NOTIFICATION_WS_PATH) {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }

    const origin = request.headers.origin;
    if (origin && !isOriginAllowed(origin)) {
      logger.warn({ origin }, "origin ditolak saat upgrade WebSocket");
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }

    const token = url.searchParams.get("token");
    let payload: AccessTokenPayload;
    try {
      payload = jwt.verify(token ?? "", env.JWT_SECRET) as AccessTokenPayload;
    } catch {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      const unregister = register(payload.sub, ws);
      ws.on("close", unregister);
      ws.on("error", unregister);

      unreadCount(payload.sub)
        .then((data) => ws.send(JSON.stringify({ event: "unread-count", data })))
        .catch((error) => logger.error({ err: error }, "gagal kirim unread-count awal"));
    });
  });

  return wss;
}
