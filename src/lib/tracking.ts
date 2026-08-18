import type { OrderStatus, TrackingStage } from "@prisma/client";

export const STAGE_ORDER: TrackingStage[] = [
  "PACKING",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

export function stageForStatus(
  status: OrderStatus
): { stage: TrackingStage; description: string } | null {
  switch (status) {
    case "PROCESSING":
      return { stage: "PACKING", description: "Penjual lagi nyiapin paketmu." };
    case "SHIPPED":
      return { stage: "PICKED_UP", description: "Paket udah diserahkan ke kurir." };
    case "DELIVERED":
      return { stage: "DELIVERED", description: "Paket sampai di alamat tujuan." };
    case "CANCELLED":
      return { stage: "CANCELLED", description: "Pesanan dibatalkan, pengiriman disetop." };
    default:
      return null;
  }
}

export function furthestStage(stages: TrackingStage[]): TrackingStage | null {
  let best = -1;
  for (const stage of stages) {
    const index = STAGE_ORDER.indexOf(stage);
    if (index > best) best = index;
  }
  return best === -1 ? null : STAGE_ORDER[best];
}

export function isTerminal(stage: TrackingStage): boolean {
  return stage === "DELIVERED" || stage === "CANCELLED" || stage === "RETURNED";
}
