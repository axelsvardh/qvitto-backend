import dotenv from "dotenv";
import fetch from "node-fetch";
import crypto from "crypto";

dotenv.config();

const { ZETTLE_CLIENT_ID, ZETTLE_API_KEY, CONTACT_EMAIL } = process.env;

if (!ZETTLE_CLIENT_ID || !ZETTLE_API_KEY) {
  console.error("Set ZETTLE_CLIENT_ID and ZETTLE_API_KEY first.");
  process.exit(1);
}

const [, , destinationUrl, sharedSecret, testUserId, contactEmailArg] = process.argv;
const contactEmail = contactEmailArg || CONTACT_EMAIL;

if (!destinationUrl || !sharedSecret || !testUserId) {
  console.log(
    "Usage: node scripts/register-zettle-webhook.js <destinationUrl> <sharedSecret> <testUserId> [contactEmail]"
  );
  console.log(
    "destinationUrl must be a publicly reachable HTTPS URL — Zettle's cloud cannot " +
      "reach localhost, and Zettle has no local-tunnel tool like the Stripe CLI, so " +
      "use something like ngrok for local testing."
  );
  process.exit(1);
}

if (!contactEmail) {
  console.error("Set CONTACT_EMAIL or pass a fourth argv value — Zettle's API requires it.");
  process.exit(1);
}

async function main() {
  const tokenResponse = await fetch("https://oauth.zettle.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      client_id: ZETTLE_CLIENT_ID,
      assertion: ZETTLE_API_KEY,
    }),
  });

  if (!tokenResponse.ok) {
    console.error(`Token request failed (${tokenResponse.status}):`, await tokenResponse.text());
    process.exit(1);
  }

  const { access_token } = await tokenResponse.json();
  // 7200s validity, no refresh token documented — re-run this script once it expires.

  const destination = `${destinationUrl}?secret=${sharedSecret}&testUserId=${testUserId}`;

  // Exact path not independently confirmed against the current Zettle developer
  // portal — verify before relying on it in production.
  const subscriptionResponse = await fetch(
    "https://pusher.izettle.com/organizations/self/subscriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uuid: crypto.randomUUID(),
        transportName: "WEBHOOK",
        eventNames: ["PurchaseCreated"],
        destination,
        contactEmail,
      }),
    }
  );

  if (!subscriptionResponse.ok) {
    console.error(
      `Subscription creation failed (${subscriptionResponse.status}):`,
      await subscriptionResponse.text()
    );
    process.exit(1);
  }

  const subscription = await subscriptionResponse.json();
  console.log("Subscription created:", subscription);
  console.log(`signingKey: ${subscription.signingKey}`);
  console.log(
    "Real signature verification using this signingKey is NOT implemented (see known " +
      "gap in zettleWebhook.js) — the shared-secret query param is the only check in place."
  );
  console.log(
    "Make sure ZETTLE_WEBHOOK_SHARED_SECRET in .env matches the sharedSecret argv value " +
      "passed to this script."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
