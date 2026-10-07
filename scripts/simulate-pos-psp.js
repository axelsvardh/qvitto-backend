const BASE_URL = process.env.API_BASE_URL || "http://localhost:4000";
const PSP_API_KEY = process.env.PSP_API_KEY || "test-psp-key";
const POS_API_KEY = process.env.POS_API_KEY || "test-pos-key";

const TEST_USER = { email: "test@qvitto.se", password: "password123" };

async function login() {
  const res = await fetch(`${BASE_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(TEST_USER),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function pspWebhook(payload) {
  const res = await fetch(`${BASE_URL}/api/psp/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": PSP_API_KEY },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function posReceipt(payload) {
  const res = await fetch(`${BASE_URL}/api/pos/receipts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": POS_API_KEY },
    body: JSON.stringify(payload),
  });
  return res.json();
}

function report(name, passed, detail) {
  const symbol = passed ? "✔" : "✘";
  console.log(`${symbol} ${name}${detail ? `: ${detail}` : ""}`);
  return passed;
}

async function main() {
  const { user } = await login();
  const userId = user.id;

  let allPassed = true;

  // Scenario A — happy path, explicit reference
  {
    const now = new Date().toISOString();
    await pspWebhook({
      userId,
      merchant: "ICA Kvantum Solna",
      amount: 100,
      currency: "SEK",
      timestamp: now,
      referenceId: "REF-A-1",
    });
    const { receipt, matched } = await posReceipt({
      merchant: "ICA Kvantum Solna",
      amount: 100,
      currency: "SEK",
      timestamp: now,
      referenceId: "REF-A-1",
    });
    const passed = matched === true;
    allPassed &&= report(
      "Scenario A",
      passed,
      passed ? "matched as expected" : `expected matched=true, got matched=${matched} (receipt ${receipt?.id})`
    );
  }

  // Scenario B — happy path, amount+time fallback
  {
    const now = new Date();
    await pspWebhook({
      userId,
      merchant: "Espresso House",
      amount: 200,
      currency: "SEK",
      timestamp: now.toISOString(),
    });
    const receiptTimestamp = new Date(now.getTime() + 60 * 1000).toISOString();
    const { receipt, matched } = await posReceipt({
      merchant: "Espresso House",
      amount: 200,
      currency: "SEK",
      timestamp: receiptTimestamp,
    });
    const passed = matched === true;
    allPassed &&= report(
      "Scenario B",
      passed,
      passed ? "matched as expected" : `expected matched=true, got matched=${matched} (receipt ${receipt?.id})`
    );
  }

  // Scenario C — mismatch, wrong amount
  {
    const now = new Date().toISOString();
    const { transaction, matched: txMatched } = await pspWebhook({
      userId,
      merchant: "H&M Drottninggatan",
      amount: 300,
      currency: "SEK",
      timestamp: now,
    });
    const { receipt, matched: receiptMatched } = await posReceipt({
      merchant: "H&M Drottninggatan",
      amount: 301,
      currency: "SEK",
      timestamp: now,
    });
    const passed = txMatched === false && receiptMatched === false;
    allPassed &&= report(
      "Scenario C",
      passed,
      passed
        ? "no match as expected"
        : `expected no match, got matched=${receiptMatched} (transaction ${transaction?.id}, receipt ${receipt?.id})`
    );
  }

  // Scenario D — mismatch, late arrival
  {
    const now = new Date();
    const { transaction, matched: txMatched } = await pspWebhook({
      userId,
      merchant: "Systembolaget",
      amount: 400,
      currency: "SEK",
      timestamp: now.toISOString(),
    });
    const lateTimestamp = new Date(now.getTime() + 6 * 60 * 1000).toISOString();
    const { receipt, matched: receiptMatched } = await posReceipt({
      merchant: "Systembolaget",
      amount: 400,
      currency: "SEK",
      timestamp: lateTimestamp,
    });
    const passed = txMatched === false && receiptMatched === false;
    allPassed &&= report(
      "Scenario D",
      passed,
      passed
        ? "no match as expected"
        : `expected no match, got matched=${receiptMatched} (transaction ${transaction?.id}, receipt ${receipt?.id})`
    );
  }

  if (!allPassed) {
    console.error("\nOne or more scenarios failed.");
    process.exit(1);
  }
  console.log("\nAll scenarios passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
