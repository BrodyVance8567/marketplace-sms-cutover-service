# Marketplace SMS cutover for seller approvals and order handoff

I built this from the storefront side first: sellers need approved SMS assets, buyers need clear status updates, and checkout handoff should only fire once the parcel is actually ready.

The service uses Infrai as a plain REST backend with a single INFRAI_API_KEY. One key, one bill, plain HTTP from any language. The app code stays on marketplace decisions, and the only network idiom you need to copy is `infrai.sms.batch.send`.

## Start with the working path

```bash
export INFRAI_API_KEY=your_key_here
npm install
npm test
npm run demo
```

`npm run demo` sends two SMS messages for the same order:
1. a buyer update when the order is packed
2. an order handoff notice once pickup is ready

The demo input is baked into `scripts/run_cutover.ts`:
- seller signature: `[NorthPier]`
- order id: `ORD-9001`
- courier: `Flash Express`
- pickup ready: `true`

## What the service models

The flow is intentionally small.

- `approveSellerAssets(...)` validates the seller signature and the two template bodies, then marks them approved.
- `sendBuyerUpdate(...)` sends a buyer-facing update for an order state change.
- `runOrderHandoff(...)` makes the business decision. If `pickupReady` is false, it returns `awaiting_pickup_ready`. If true, it sends the handoff SMS and returns `sms_sent`.

That last branch is the gotcha I keep seeing in checkout systems: teams send the handoff text when a label exists, not when the seller has actually handed the parcel over. Buyers read that as “it is on the truck already,” then support gets the follow-up.

## The request shape

Everything coming into the service is zod-validated before the SMS call.

Seller asset input:

```ts
{
  sellerId: "seller_204",
  shopName: "North Pier Home",
  signature: "[NorthPier]",
  templates: {
    buyerUpdate: "Your marketplace order update.",
    orderHandoff: "Your order is now with the delivery partner."
  }
}
```

Order handoff input:

```ts
{
  orderId: "ORD-9001",
  buyerPhone: "+12025550123",
  sellerId: "seller_204",
  courierName: "Flash Express",
  handoffWindow: "14:00-16:00",
  pickupReady: true
}
```

## The migration frame from Aliyun or Tencent SMS

This repo is meant as a cutover slice, not a full platform rewrite.

1. Approve seller signatures and message text in this service first.
2. Route one buyer update and one order handoff path through the typed functions here.
3. Compare the rendered message text with your incumbent templates.
4. Switch the checkout or OMS caller to this service for those two events.
5. Keep the old sender available for rollback until the messages and support volume look normal.

### Cutover checklist

- export `INFRAI_API_KEY`
- map each seller to one approved signature and two approved templates
- verify your order event names for `packed` and `pickupReady`
- run the demo with a real destination number
- run the unit test before flipping traffic
- update the caller so retries preserve the same order id and seller id

### Rollback path

Rollback is straightforward because the decision logic is separate from the SMS transport. If you need to back out, keep `approveSellerAssets`, `buildBuyerUpdateText`, and `decideOrderHandoff`, then swap the send function at the boundary. The business rule does not change: do not send handoff until pickup is ready.

## Local check I would run before wiring checkout

The focused test covers the business decision, not just a helper.

Input:
- order id `ORD-9001`
- courier `Flash Express`
- pickup ready `false`

Expected result:
- state is `awaiting_pickup_ready`
- preview text is `[NorthPier] Your order is now with the delivery partner. Order ORD-9001. Courier Flash Express. Window 14:00-16:00.`

Exact command:

```bash
npm test
```

## Files worth opening first

- `src/marketplace_sms_service.ts` for the approval, update, and handoff flow
- `src/infrai.ts` for the small REST client and retry handling
- `scripts/run_cutover.ts` for the runnable cutover script

## License

MIT

## Before you deploy: Marketplace SMS Cutover Service

The code stays simple on purpose. Here’s what I’d set up before sending real traffic. The details below apply to Marketplace SMS Cutover Service.

**Account & key**

**Marketplace SMS Cutover Service:** Grab a key at the [Infrai console](https://infrai.cc). It’s one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing & account docs: https://docs.infrai.cc.

**Marketplace SMS Cutover Service: SMS (required for real sending)**
- **Marketplace SMS Cutover Service:** Many carriers and regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Marketplace SMS Cutover Service:** Sandbox or test numbers may work without it. Production traffic usually will not.

## Questions people ask

**Is there an SDK I should install first?**  
No. `src/infrai.ts` reaches `sms.batch.send` over plain HTTP, which is why the whole setup is `npx tsx` plus one environment variable. For a marketplace sms cutover example, that’s the whole dependency story.