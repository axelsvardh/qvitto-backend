import { PrismaClient } from "@prisma/client";
import braintree from "braintree";
import { attemptMatchForTransaction } from "./matchingService.js";

const prisma = new PrismaClient();

let gatewayInstance = null;

function getBraintreeGateway() {
  if (gatewayInstance) return gatewayInstance;
  const { BRAINTREE_MERCHANT_ID, BRAINTREE_PUBLIC_KEY, BRAINTREE_PRIVATE_KEY } = process.env;
  if (!BRAINTREE_MERCHANT_ID || !BRAINTREE_PUBLIC_KEY || !BRAINTREE_PRIVATE_KEY) {
    throw new Error(
      "BRAINTREE_MERCHANT_ID, BRAINTREE_PUBLIC_KEY and BRAINTREE_PRIVATE_KEY must all be set"
    );
  }
  gatewayInstance = new braintree.BraintreeGateway({
    environment: braintree.Environment.Sandbox,
    merchantId: BRAINTREE_MERCHANT_ID,
    publicKey: BRAINTREE_PUBLIC_KEY,
    privateKey: BRAINTREE_PRIVATE_KEY,
  });
  return gatewayInstance;
}

export const handleBraintreeWebhook = async (req, res) => {
  try {
    const gateway = getBraintreeGateway();

    let notification;
    try {
      notification = await gateway.webhookNotification.parse(
        req.body.bt_signature,
        req.body.bt_payload
      );
    } catch (err) {
      // Deliberately not echoing err.message here — same reasoning as the
      // Stripe adapter, don't leak signature verification internals.
      return res.status(400).json({ error: "Webhook signature verification failed" });
    }

    if (notification.kind !== braintree.WebhookNotification.Kind.TransactionSettled) {
      return res.status(200).json({ received: true, ignored: notification.kind });
    }

    const transaction = notification.transaction;

    // Braintree has no concept of a Qvitto user; this custom field must be
    // configured by hand in the Braintree control panel (named exactly
    // "qvittoUserId") before it can ever be populated on a real transaction.
    const userId = transaction.customFields?.qvittoUserId;
    if (!userId) {
      console.error(
        `Braintree webhook: no qvittoUserId custom field on transaction ${transaction.id}`
      );
      return res.status(200).json({
        received: true,
        error: "no qvittoUserId custom field configured — known consumer-identity gap, see comment in this file",
      });
    }

    let tx;
    try {
      tx = await prisma.transaction.create({
        data: {
          userId,
          merchant: `Braintree merchant account ${transaction.merchantAccountId || "unknown"}`,
          // Braintree's amount is already a decimal string in major units,
          // unlike Stripe's integer minor-units convention — do not divide by 100.
          amount: parseFloat(transaction.amount),
          currency: transaction.currencyIsoCode.toUpperCase(),
          timestamp: new Date(transaction.createdAt),
          paymentReferenceId: transaction.id,
        },
      });
    } catch (err) {
      // Braintree delivers webhooks at-least-once; a duplicate delivery hits
      // the unique constraint on paymentReferenceId. Treat that as
      // already-processed success, not a failure.
      if (err.code === "P2002") {
        return res.status(200).json({ received: true, duplicate: true });
      }
      throw err;
    }

    const matchResult = await attemptMatchForTransaction(tx);

    res.status(200).json({ received: true, matched: Boolean(matchResult) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
