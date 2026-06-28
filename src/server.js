import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { getAllTransactions, createTransaction } from "./api/transactions.js";
import { registerUser, loginUser } from "./api/auth.js";
import { authenticateToken } from "./middleware/auth.js";
import { bankWebhook } from "./api/transactions.js";
import { savePushToken } from "./api/auth.js";

dotenv.config();
const prisma = new PrismaClient();
const app = express();

app.use(express.json());
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

app.post("/api/push-token", authenticateToken, savePushToken);
