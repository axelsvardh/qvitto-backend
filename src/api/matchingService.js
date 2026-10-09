import { PrismaClient } from "@prisma/client";
import { sendPushNotification } from "../utils/pushNotifications.js";

const prisma = new PrismaClient();

const MATCH_WINDOW_MS = 5 * 60 * 1000;

async function notifyMatch(transaction) {
  const user = await prisma.user.findUnique({ where: { id: transaction.userId } });
  await sendPushNotification(
    user?.pushToken,
    "Nytt kvitto mottaget",
    `${transaction.merchant} – ${transaction.amount.toFixed(2)} ${transaction.currency}`
  );
}

// An ambiguous fallback (0 or >1 candidates) is treated as no match — a wrong
// auto-match is worse than leaving both sides pending for manual reconciliation.
function pickUnambiguousCandidate(candidates) {
  return candidates.length === 1 ? candidates[0] : null;
}

export async function attemptMatchForReceipt(receipt) {
  let transaction = null;

  if (receipt.posReferenceId) {
    transaction = await prisma.transaction.findFirst({
      where: {
        paymentReferenceId: receipt.posReferenceId,
        receipt: { is: null },
      },
    });
  } else {
    const candidates = await prisma.transaction.findMany({
      where: {
        receipt: { is: null },
        amount: receipt.total,
        currency: receipt.currency,
        timestamp: {
          gte: new Date(receipt.timestamp.getTime() - MATCH_WINDOW_MS),
          lte: new Date(receipt.timestamp.getTime() + MATCH_WINDOW_MS),
        },
      },
    });
    transaction = pickUnambiguousCandidate(candidates);
  }

  if (!transaction) return null;

  await prisma.receipt.update({
    where: { id: receipt.id },
    data: { transactionId: transaction.id },
  });

  await notifyMatch(transaction);

  return transaction;
}

export async function attemptMatchForTransaction(transaction) {
  let receipt = null;

  if (transaction.paymentReferenceId) {
    receipt = await prisma.receipt.findFirst({
      where: {
        posReferenceId: transaction.paymentReferenceId,
        transactionId: null,
      },
    });
  } else {
    const candidates = await prisma.receipt.findMany({
      where: {
        transactionId: null,
        total: transaction.amount,
        currency: transaction.currency,
        timestamp: {
          gte: new Date(transaction.timestamp.getTime() - MATCH_WINDOW_MS),
          lte: new Date(transaction.timestamp.getTime() + MATCH_WINDOW_MS),
        },
      },
    });
    receipt = pickUnambiguousCandidate(candidates);
  }

  if (!receipt) return null;

  await prisma.receipt.update({
    where: { id: receipt.id },
    data: { transactionId: transaction.id },
  });

  await notifyMatch(transaction);

  return receipt;
}
