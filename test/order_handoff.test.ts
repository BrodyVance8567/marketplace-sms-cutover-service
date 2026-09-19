import test from "node:test";
import assert from "node:assert/strict";
import { approveSellerAssets, decideOrderHandoff } from "../src/marketplace_sms_service";

test("order handoff waits until pickup is ready", () => {
  const seller = approveSellerAssets({
    sellerId: "seller_204",
    shopName: "North Pier Home",
    signature: "[NorthPier]",
    templates: {
      buyerUpdate: "Your marketplace order update.",
      orderHandoff: "Your order is now with the delivery partner."
    }
  });

  const decision = decideOrderHandoff(seller, {
    orderId: "ORD-9001",
    buyerPhone: "+12025550123",
    sellerId: "seller_204",
    courierName: "Flash Express",
    handoffWindow: "14:00-16:00",
    pickupReady: false
  });

  assert.equal(decision.state, "awaiting_pickup_ready");
  assert.equal(
    decision.preview,
    "[NorthPier] Your order is now with the delivery partner. Order ORD-9001. Courier Flash Express. Window 14:00-16:00."
  );
});
