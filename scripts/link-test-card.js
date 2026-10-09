import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const [, , emailArg, passwordArg, paymentMethodIdArg] = process.argv;

const email = emailArg || "test@qvitto.se";
const password = passwordArg || "password123";
const paymentMethodId = paymentMethodIdArg || "pm_card_visa";

const baseUrl = process.env.API_BASE_URL || "http://localhost:4000";

async function main() {
  const loginRes = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const loginBody = await loginRes.json();

  if (!loginRes.ok) {
    console.error("Login failed:", loginBody);
    process.exit(1);
  }

  const { token } = loginBody;

  const linkRes = await fetch(`${baseUrl}/api/cards/link`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ paymentMethodId }),
  });
  const linkBody = await linkRes.json();

  if (linkRes.status === 409) {
    console.log(
      "Card already linked (expected if this script has been run before): ",
      linkBody
    );
    return;
  }

  if (!linkRes.ok) {
    console.error(`Card link failed (status ${linkRes.status}):`, linkBody);
    process.exit(1);
  }

  console.log("Card linked successfully:");
  console.log(`  brand: ${linkBody.brand}`);
  console.log(`  last4: ${linkBody.last4}`);
  console.log(`  fingerprint: ${linkBody.fingerprint}`);
  console.log(
    `\nRunning "node scripts/create-stripe-test-payment.js ${loginBody.user.id}" again should now ` +
      "resolve the user via fingerprint match instead of metadata — you can verify this by " +
      "checking the resulting Transaction's userId matches even if metadata were absent."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
