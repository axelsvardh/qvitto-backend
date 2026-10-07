import { PrismaClient } from "@prisma/client";
import { attemptMatchForTransaction } from "./matchingService.js";
import { getStripeClient } from "../utils/stripeClient.js";

const prisma = new PrismaClient();

export const handleStripeWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return res.status(500).json({ error: "STRIPE_WEBHOOK_SECRET is not set" });
    }

    const stripe = getStripeClient();

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers["stripe-signature"],
        webhookSecret
      );
    } catch (err) {
      // Deliberately not echoing err.message here — it would leak signature
      // verification internals to an unauthenticated caller.
      return res.status(400).json({ error: "Webhook signature verification failed" });
    }

    if (event.type !== "payment_intent.succeeded") {
      return res.status(200).json({ received: true, ignored: event.type });
    }

    const paymentIntent = event.data.object;
    const merchant = paymentIntent.metadata?.merchant;

    // A real card-present/card-not-present purchase has no reason to carry our
    // internal userId in metadata, so resolve it via the card's fingerprint
    // first (this is the whole point of card linking) and only fall back to
    // metadata for flows like create-stripe-test-payment.js that still set it.
    let userId;
    let userIdSource;
    if (paymentIntent.payment_method) {
      try {
        const paymentMethod = await stripe.paymentMethods.retrieve(paymentIntent.payment_method);
        const fingerprint = paymentMethod.card?.fingerprint;
        if (fingerprint) {
          const linkedCard = await prisma.linkedCard.findUnique({ where: { fingerprint } });
          if (linkedCard) {
            userId = linkedCard.userId;
            userIdSource = "fingerprint";
          }
        }
      } catch (err) {
        console.error(
          `Stripe webhook: fingerprint lookup failed for PaymentIntent ${paymentIntent.id}: ${err.message}`
        );
      }
    }

    if (!userId) {
      userId = paymentIntent.metadata?.userId;
      if (userId) userIdSource = "metadata";
    }

    if (userId) {
      console.log(
        `Stripe webhook: resolved userId for PaymentIntent ${paymentIntent.id} via ${userIdSource}`
      );
    }

    if (!userId) {
      console.error(
        `Stripe webhook: no linked card fingerprint match and no metadata fallback for PaymentIntent ${paymentIntent.id}`
      );
      return res
        .status(200)
        .json({ received: true, error: "no linked card fingerprint match and no metadata fallback" });
    }

    let tx;
    try {
      tx = await prisma.transaction.create({
        data: {
          userId,
          merchant: merchant || "Unknown (Stripe)",
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency.toUpperCase(),
          timestamp: new Date(paymentIntent.created * 1000),
          paymentReferenceId: paymentIntent.id,
        },
      });
    } catch (err) {
      // Stripe delivers webhooks at-least-once; a duplicate delivery hits the
      // unique constraint on paymentReferenceId. Treat that as already-processed
      // success, not a failure, so Stripe doesn't keep retrying it.
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
