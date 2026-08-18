export type SnapItem = { id: string; price: number; quantity: number; name: string };

export type SnapItemsInput = {
  items: { productId: string; productName: string; price: number; quantity: number }[];
  shippingCost: number;
  
  discount: number;
};

export const SHIPPING_ITEM_ID = "SHIPPING";
export const DISCOUNT_ITEM_ID = "DISCOUNT";

const MAX_NAME = 50;

export function buildSnapItems(input: SnapItemsInput): SnapItem[] {
  const lines: SnapItem[] = input.items.map((item) => ({
    id: item.productId,
    price: item.price,
    quantity: item.quantity,
    name: item.productName.slice(0, MAX_NAME),
  }));

  if (input.shippingCost > 0) {
    lines.push({
      id: SHIPPING_ITEM_ID,
      price: input.shippingCost,
      quantity: 1,
      name: "Ongkos kirim",
    });
  }

  if (input.discount > 0) {
    lines.push({
      id: DISCOUNT_ITEM_ID,
      price: -input.discount,
      quantity: 1,
      name: "Potongan kupon",
    });
  }

  return lines;
}

export function sumSnapItems(lines: SnapItem[]): number {
  return lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
}
