import type { WebSocket } from "ws";

const clients = new Map<string, Set<WebSocket>>();

export function register(userId: string, socket: WebSocket): () => void {
  let set = clients.get(userId);
  if (!set) {
    set = new Set();
    clients.set(userId, set);
  }
  set.add(socket);

  return () => {
    const current = clients.get(userId);
    if (!current) return;
    current.delete(socket);
    if (current.size === 0) clients.delete(userId);
  };
}

export type SocketEvent =
  | { event: "notification"; data: unknown }
  | { event: "unread-count"; data: { unreadCount: number } }
  
  | { event: "tracking"; data: { orderId: string; event: unknown } };

export function publish(userId: string, payload: SocketEvent): void {
  const sockets = clients.get(userId);
  if (!sockets) return;

  const frame = JSON.stringify(payload);
  for (const socket of sockets) {
    if (socket.readyState === 1) socket.send(frame);
  }
}

export function connectedUserCount(): number {
  return clients.size;
}
