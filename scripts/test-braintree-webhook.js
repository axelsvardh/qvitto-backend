import dotenv from "dotenv";
import fetch from "node-fetch";
import braintree from "braintree";

dotenv.config();

const { BRAINTREE_MERCHANT_ID, BRAINTREE_PUBLIC_KEY, BRAINTREE_PRIVATE_KEY } = process.env;

if (!BRAINTREE_MERCHANT_ID || !BRAINTREE_PUBLIC_KEY || !BRAINTREE_PRIVATE_KEY) {
  console.error(
    "Set BRAINTREE_MERCHANT_ID, BRAINTREE_PUBLIC_KEY and BRAINTREE_PRIVATE_KEY first."
  );
  process.exit(1);
}

const gateway = new braintree.BraintreeGateway({
  environment: braintree.Environment.Sandbox,
  merchantId: BRAINTREE_MERCHANT_ID,
  publicKey: BRAINTREE_PUBLIC_KEY,
  privateKey: BRAINTREE_PRIVATE_KEY,
});

async function main() {
  const { bt_signature, bt_payload } = gateway.webhookTesting.sampleNotification(
    braintree.WebhookNotification.Kind.TransactionSettled,
    "test-transaction-id"
  );

  const url = `${process.env.API_BASE_URL || "http://localhost:4000"}/api/psp/braintree/webhook`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ bt_signature, bt_payload }),
  });

  const body = await response.json().catch(() => null);
  console.log(`Response (${response.status}):`, body);

  console.log(
    "\nA response containing 'no qvittoUserId custom field' is the EXPECTED outcome " +
      "here, not a failure — Braintree's own sampleNotification tool does not populate " +
      "customFields meaningfully, so this test proves signature verification and event " +
      "routing work, not the full consumer-identity flow."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
