import { PrismaClient } from "@prisma/client";
import { categorizeMerchant } from "./retailerService.js";
import { sendPushNotification } from "../utils/pushNotifications.js";
import { attemptMatchForTransaction } from "./matchingService.js";
const prisma = new PrismaClient();

export const getAllTransactions = async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId: req.user.userId },
      include: { receipt: { include: { items: true } } },
    });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createTransaction = async (req, res) => {
  const { merchant, amount, currency } = req.body;
  const userId = req.user.userId;

  try {
    const tx = await prisma.transaction.create({
      data: { userId, merchant, amount, currency, timestamp: new Date() },
    });

    // 🔹 Hämta användaren och skicka notisen här 👇
    const user = await prisma.user.findUnique({ where: { id: userId } });
    await sendPushNotification(
      user?.pushToken,
      "Nytt kvitto mottaget",
      `${merchant} – ${amount.toFixed(2)} ${currency}`
    );

    res.json(tx);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// 🔹 Simulerad webhook från bank
export const bankWebhook = async (req, res) => {
  try {
    const { userId, merchant, amount, currency } = req.body;

    const tx = await prisma.transaction.create({
      data: { userId, merchant, amount, currency, timestamp: new Date() },
    });

    const receipt = await prisma.receipt.create({
      data: {
        transactionId: tx.id,
        total: amount,
        vat: amount * 0.25,
        source: "Simulated Bank",
        category: categorizeMerchant(merchant),
      },
    });

    // 🔹 Skicka notis även här 👇
    const user = await prisma.user.findUnique({ where: { id: userId } });
    await sendPushNotification(
      user?.pushToken,
      "Nytt kvitto mottaget",
      `${merchant} – ${amount.toFixed(2)} ${currency}`
    );

    res.status(201).json({ tx, receipt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 🔹 Simulerad webhook från PSP
export const pspWebhook = async (req, res) => {
  try {
    const { userId, merchant, amount, currency, timestamp, referenceId } = req.body;

    const tx = await prisma.transaction.create({
      data: {
        userId,
        merchant,
        amount,
        currency,
        timestamp: new Date(timestamp),
        paymentReferenceId: referenceId ?? null,
      },
    });

    const matchResult = await attemptMatchForTransaction(tx);

    res.status(201).json({ transaction: tx, matched: Boolean(matchResult) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
