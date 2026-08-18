declare module "midtrans-client" {
  export type MidtransConfig = {
    isProduction: boolean;
    serverKey: string;
    clientKey?: string;
  };

  export type TransactionDetails = {
    order_id: string;
    gross_amount: number;
  };

  export type ItemDetail = {
    id: string;
    price: number;
    quantity: number;
    name: string;
    merchant_name?: string;
  };

  export type CustomerDetails = {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  };

  export type SnapTransactionPayload = {
    transaction_details: TransactionDetails;
    item_details?: ItemDetail[];
    customer_details?: CustomerDetails;
    credit_card?: { secure?: boolean };
    expiry?: { unit: string; duration: number };
    callbacks?: { finish?: string };
  };

  export type SnapTransactionResult = {
    token: string;
    redirect_url: string;
  };

  export class Snap {
    constructor(config: MidtransConfig);
    createTransaction(payload: SnapTransactionPayload): Promise<SnapTransactionResult>;
    createTransactionToken(payload: SnapTransactionPayload): Promise<string>;
    createTransactionRedirectUrl(payload: SnapTransactionPayload): Promise<string>;
  }

  export class CoreApi {
    constructor(config: MidtransConfig);
    transaction: {
      status(orderId: string): Promise<Record<string, unknown>>;
      notification(payload: unknown): Promise<Record<string, unknown>>;
      cancel(orderId: string): Promise<Record<string, unknown>>;
      expire(orderId: string): Promise<Record<string, unknown>>;
    };
  }

  const midtransClient: {
    Snap: typeof Snap;
    CoreApi: typeof CoreApi;
  };

  export default midtransClient;
}
