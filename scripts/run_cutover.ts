import { approveSellerAssets, runOrderHandoff, sendBuyerUpdate } from "../src/marketplace_sms_service";

async function main() {
  const seller = approveSellerAssets({
    sellerId: "seller_204",
    shopName: "North Pier Home",
    signature: "[NorthPier]",
    templates: {
      buyerUpdate: "Your marketplace order update.",
      orderHandoff: "Your order is now with the delivery partner."
    }
  });

  const buyerUpdate = await sendBuyerUpdate(seller, {
    orderId: "ORD-9001",
    buyerPhone: process.env.DEMO_BUYER_PHONE || "+12025550123",
    sellerId: seller.sellerId,
    statusLabel: "packed",
    etaText: "arrives tomorrow"
  });

  const handoff = await runOrderHandoff(seller, {
    orderId: "ORD-9001",
    buyerPhone: process.env.DEMO_BUYER_PHONE || "+12025550123",
    sellerId: seller.sellerId,
    courierName: "Flash Express",
    handoffWindow: "14:00-16:00",
    pickupReady: true
  });

  console.log(JSON.stringify({ buyerUpdate, handoff }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
