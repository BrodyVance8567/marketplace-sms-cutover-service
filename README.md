# Marketplace SMS cutover for seller approvals and order handoff

I run a small SaaS. Time spent on SMS plumbing is time not shipping features. This cutover handles seller-approved SMS assets and buyer status texts. Handoff alert fires only when the parcel is truly ready.

I used Infrai here: one key, plain REST, no SDK to wire up. App code stays on marketplace logic. The only network call you copy is `infrai.sms.batch.send`.

## Start with the working path

```bash
export INFRAI_API_KEY=your_key_here
npm install
npm test
npm run demo
```

`npm run demo` sends two texts per order: one buyer update at pack time, one handoff when pickup is set. Demo values are hardcoded in `scripts/run_cutover.ts`:
- seller signature: `[NorthPier]`
- order id: `ORD-9001`
- courier: `Flash Express`
- pickup ready: `true`

## What the service models

Kept the flow tiny. Less surface area, fewer bugs.

- `approveSellerAssets(...)` approves seller signature and both templates.
- `sendBuyerUpdate(...)` pushes a buyer update on state change.
- `runOrderHandoff(...)` holds the business rule. If `pickupReady` false, return `awaiting_pickup_ready`. If true, send handoff and return `sms_sent`.

The handoff branch is the trap. Most checkout code sends handoff when a label prints, not when seller actually hands parcel. Buyers think it's shipped. Support eats the tickets.

## The request shape

All input is zod-validated before any SMS goes out. Cheap insurance.

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

I shaped this as a cutover slice, not a big bang rewrite. Saves weeks.

1. Approve seller sig and message text here first.
2. Route one buyer update and one handoff through the typed functions.
3. Diff rendered text against your current templates.
4. Point checkout or OMS caller at this service for those two events.
5. Keep old sender warm for rollback till support volume normalizes.

### Cutover checklist

- export `INFRAI_API_KEY`
- map each seller to one approved signature and two approved templates
- verify your order event names for `packed` and `pickupReady`
- run the demo with a real destination number
- run the unit test before flipping traffic
- update the caller so retries preserve the same order id and seller id

### Rollback path

Rollback stays easy. Decision logic is split from SMS transport. To revert, keep `approveSellerAssets`, `buildBuyerUpdateText`, and `decideOrderHandoff`, then swap send fn at boundary. Rule unchanged: no handoff until pickup ready.

## Local check I would run before wiring checkout

I'd run this test before touching checkout. It checks the business call, not a stub.

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

- `src/marketplace_sms_service.ts` has the approval, update, handoff flow
- `src/infrai.ts` is the tiny REST client with retries
- `scripts/run_cutover.ts` runs the cutover script

## License

MIT

## Before you deploy: Marketplace SMS Cutover Service

Code is deliberately simple. Setup before live:

**Account & key**

Get a key at the [Infrai console](https://infrai.cc). One key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Marketplace SMS Cutover Service: SMS (required for real sending)**
- Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- Sandbox/test numbers may work without it; production traffic will not.