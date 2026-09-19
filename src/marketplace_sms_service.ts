import { z } from "zod";
import { infrai } from "./infrai";

const sellerAssetSchema = z.object({
  sellerId: z.string().min(1),
  shopName: z.string().min(1),
  signature: z.string().min(2),
  templates: z.object({
    buyerUpdate: z.string().min(10),
    orderHandoff: z.string().min(10)
  })
});

const buyerUpdateSchema = z.object({
  orderId: z.string().min(1),
  buyerPhone: z.string().min(6),
  sellerId: z.string().min(1),
  statusLabel: z.string().min(1),
  etaText: z.string().min(1)
});

const handoffSchema = z.object({
  orderId: z.string().min(1),
  buyerPhone: z.string().min(6),
  sellerId: z.string().min(1),
  courierName: z.string().min(1),
  handoffWindow: z.string().min(1),
  pickupReady: z.boolean()
});

export type SellerAssetInput = z.infer<typeof sellerAssetSchema>;
export type BuyerUpdateInput = z.infer<typeof buyerUpdateSchema>;
export type OrderHandoffInput = z.infer<typeof handoffSchema>;

export type ApprovedSellerAsset = SellerAssetInput & {
  approvalState: "approved";
};

export type HandoffDecision = {
  orderId: string;
  sellerId: string;
  state: "sms_sent" | "awaiting_pickup_ready";
  preview: string;
};

export function approveSellerAssets(input: SellerAssetInput): ApprovedSellerAsset {
  const asset = sellerAssetSchema.parse(input);
  return {
    ...asset,
    approvalState: "approved"
  };
}

export function buildBuyerUpdateText(asset: ApprovedSellerAsset, input: BuyerUpdateInput): string {
  const update = buyerUpdateSchema.parse(input);
  return `${asset.signature} ${asset.templates.buyerUpdate} Order ${update.orderId} is ${update.statusLabel}. ETA ${update.etaText}.`;
}

export function decideOrderHandoff(asset: ApprovedSellerAsset, input: OrderHandoffInput): HandoffDecision {
  const handoff = handoffSchema.parse(input);
  const preview = `${asset.signature} ${asset.templates.orderHandoff} Order ${handoff.orderId}. Courier ${handoff.courierName}. Window ${handoff.handoffWindow}.`;

  if (!handoff.pickupReady) {
    return {
      orderId: handoff.orderId,
      sellerId: handoff.sellerId,
      state: "awaiting_pickup_ready",
      preview
    };
  }

  return {
    orderId: handoff.orderId,
    sellerId: handoff.sellerId,
    state: "sms_sent",
    preview
  };
}

export async function sendBuyerUpdate(asset: ApprovedSellerAsset, input: BuyerUpdateInput) {
  const update = buyerUpdateSchema.parse(input);
  const text = buildBuyerUpdateText(asset, update);
  return infrai.sms.batch.send(
    {
      messages: [
        {
          to: update.buyerPhone,
          content: text
        }
      ]
    },
    {
      "Idempotency-Key": `buyer-update:${update.orderId}:${update.sellerId}`
    }
  );
}

export async function runOrderHandoff(asset: ApprovedSellerAsset, input: OrderHandoffInput): Promise<HandoffDecision> {
  const handoff = handoffSchema.parse(input);
  const decision = decideOrderHandoff(asset, handoff);

  if (decision.state === "awaiting_pickup_ready") {
    return decision;
  }

  await infrai.sms.batch.send(
    {
      messages: [
        {
          to: handoff.buyerPhone,
          content: decision.preview
        }
      ]
    },
    {
      "Idempotency-Key": `order-handoff:${handoff.orderId}:${handoff.sellerId}`
    }
  );

  return decision;
}
