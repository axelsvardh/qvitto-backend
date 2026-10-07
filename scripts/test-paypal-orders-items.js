import crypto from "crypto";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

// This exercises PayPal's general sandbox Orders API (api-m.sandbox.paypal.com)
// purely as a convenient source of a realistically-shaped itemized purchase to
// sanity-check our own receipt-parsing/matching logic. It is NOT Zettle's
// Purchase API and has no bearing on the Braintree/Zettle POS integration work
// elsewhere in this project — see prisma/seed.js and scripts/simulate-pos-psp.js
// for where itemized-purchase parsing is actually proven against our own models.

const { PAYPAL_CLIENT_ID, PAYPAL_SECRET_KEY } = process.env;

if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET_KEY) {
  console.error("Set PAYPAL_CLIENT_ID and PAYPAL_SECRET_KEY in .env (from developer.paypal.com > Apps & Credentials).");
  process.exit(1);
}

const [, , itemNameArg, amountArg, currencyArg] = process.argv;

const itemName = itemNameArg || "Test 1";
const amount = amountArg || "20.00";
const currency = currencyArg || "SEK";

const BASE = "https://api-m.sandbox.paypal.com";

async function getAccessToken() {
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET_KEY}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const body = await res.json();
  if (!body.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(body)}`);
  }
  return body.access_token;
}

async function createAndCaptureOrder(accessToken) {
  const res = await fetch(`${BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      // Required by PayPal whenever payment_source is set directly on order
      // creation — an idempotency key, same role as Braintree's
      // Idempotency-Key header used elsewhere in this project.
      "PayPal-Request-Id": crypto.randomUUID(),
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          items: [
            {
              name: itemName,
              quantity: "1",
              unit_amount: { currency_code: currency, value: amount },
            },
          ],
          amount: {
            currency_code: currency,
            value: amount,
            breakdown: { item_total: { currency_code: currency, value: amount } },
          },
        },
      ],
      payment_source: {
        card: {
          number: "4005519200000004",
          expiry: "2030-12",
          security_code: "123",
        },
      },
    }),
  });

  const order = await res.json();

  if (!order.id) {
    throw new Error(`Order creation/capture failed: ${JSON.stringify(order, null, 2)}`);
  }

  // The id alone doesn't mean the payment actually completed — an order can
  // come back with an id while still PAYER_ACTION_REQUIRED (e.g. 3DS) or
  // otherwise not captured. Check the real status before declaring success.
  if (order.status !== "COMPLETED") {
    throw new Error(
      `Order ${order.id} was created but did not complete (status: ${order.status}). Full response: ${JSON.stringify(order, null, 2)}`
    );
  }

  return order.id;
}

async function fetchOrder(accessToken, orderId) {
  const res = await fetch(`${BASE}/v2/checkout/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.json();
}

async function main() {
  console.log("1) Getting access token...");
  const accessToken = await getAccessToken();
  console.log("   Got token.");

  console.log(`2) Creating + capturing a test order (item: "${itemName}", ${amount} ${currency})...`);
  const orderId = await createAndCaptureOrder(accessToken);
  console.log(`   Order ${orderId} completed.`);

  console.log("3) Fetching the order back to confirm the items array...");
  const orderDetails = await fetchOrder(accessToken, orderId);

  console.log("\n=== Items array (purchase_units[0].items) ===");
  console.log(JSON.stringify(orderDetails.purchase_units?.[0]?.items, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
