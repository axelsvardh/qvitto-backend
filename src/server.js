import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { getAllTransactions, createTransaction } from "./api/transactions.js";
import { registerUser, loginUser } from "./api/auth.js";
import { authenticateToken } from "./middleware/auth.js";
import { bankWebhook, pspWebhook } from "./api/transactions.js";
import { savePushToken } from "./api/auth.js";
import { submitPosReceipt } from "./api/receipts.js";
import { requireApiKey } from "./middleware/apiKey.js";
import { handleStripeWebhook } from "./api/stripeWebhook.js";
import { handleZettleWebhook } from "./api/zettleWebhook.js";
import { handleBraintreeWebhook } from "./api/braintreeWebhook.js";
import { createSetupIntent, confirmCardLink } from "./api/cards.js";
import { createLocation, chargeReader } from "./api/braintreeCharge.js";
import { createTestPayment } from "./api/devPayments.js";

dotenv.config();
const prisma = new PrismaClient();
const app = express();

// Stripe signature verification needs the raw, unparsed request body, and
// Braintree posts application/x-www-form-urlencoded (not JSON) — the global
// JSON parser must skip both routes (each gets its own parser below).
app.use((req, res, next) => {
  if (
    req.originalUrl === "/api/psp/stripe/webhook" ||
    req.originalUrl === "/api/psp/braintree/webhook"
  ) {
    return next();
  }
  express.json()(req, res, next);
});
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(helmet());

// --- Test route ---
app.get("/", (req, res) => {
  res.send("Kvitto backend live!");
});

// --- Example route: get all users ---
app.get("/api/users", async (req, res) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

app.get("/api/transactions", authenticateToken, getAllTransactions);
app.post("/api/transactions", authenticateToken, createTransaction);

// AUTH ROUTES
app.post("/api/register", registerUser);
app.post("/api/login", loginUser);

app.post("/api/bank/webhook", bankWebhook);

app.post("/api/pos/receipts", requireApiKey("POS_API_KEY", "test-pos-key"), submitPosReceipt);
app.post("/api/psp/webhook", requireApiKey("PSP_API_KEY", "test-psp-key"), pspWebhook);
app.post(
  "/api/psp/stripe/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);
app.post("/api/psp/zettle/webhook", handleZettleWebhook);
app.post(
  "/api/psp/braintree/webhook",
  express.urlencoded({ extended: false }),
  handleBraintreeWebhook
);
app.post(
  "/api/braintree/locations",
  requireApiKey("BRAINTREE_CHARGE_API_KEY", "test-braintree-charge-key"),
  createLocation
);
app.post(
  "/api/braintree/charge",
  requireApiKey("BRAINTREE_CHARGE_API_KEY", "test-braintree-charge-key"),
  chargeReader
);

app.post("/api/push-token", authenticateToken, savePushToken);

app.post("/api/cards/setup-intent", authenticateToken, createSetupIntent);
app.post("/api/cards/link", authenticateToken, confirmCardLink);

// Opt-in only (fails closed): fires real Stripe test-mode payments, so it must
// never be reachable unless someone explicitly turns it on in that environment.
if (process.env.ENABLE_DEV_ENDPOINTS === "true") {
  app.post("/api/dev/test-payment", requireApiKey("POS_API_KEY", "test-pos-key"), createTestPayment);
}
