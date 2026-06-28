import { PrismaClient } from "@prisma/client";
import fetch from "node-fetch";
const prisma = new PrismaClient();

export const getAllTransactions = async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      include: { receipt: true },
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

// SEND NOTIFICATION
async function sendPushNotification(pushToken, title, body) {
  if (!pushToken) return;
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: pushToken,
      sound: "default",
      title,
      body,
    }),
  });
}
