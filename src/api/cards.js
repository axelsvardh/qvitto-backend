import { PrismaClient } from "@prisma/client";
import { getStripeClient } from "../utils/stripeClient.js";

const prisma = new PrismaClient();

export const createSetupIntent = async (req, res) => {
  try {
    const stripe = getStripeClient();

    const setupIntent = await stripe.setupIntents.create({
      payment_method_types: ["card"],
      metadata: { qvittoUserId: req.user.userId },
    });

    res.status(201).json({ clientSecret: setupIntent.client_secret });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const confirmCardLink = async (req, res) => {
  try {
    const { paymentMethodId } = req.body;
    if (!paymentMethodId) {
      return res.status(400).json({ error: "paymentMethodId is required" });
    }

    const stripe = getStripeClient();

    let paymentMethod;
    try {
      paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    if (paymentMethod.type !== "card" || !paymentMethod.card) {
      return res.status(400).json({ error: "This endpoint only supports card payment methods" });
    }

    const { fingerprint, brand, last4, exp_month, exp_year } = paymentMethod.card;

    let linkedCard;
    try {
      linkedCard = await prisma.linkedCard.create({
        data: {
          userId: req.user.userId,
          stripePaymentMethodId: paymentMethodId,
          fingerprint,
          brand,
          last4,
          expMonth: exp_month,
          expYear: exp_year,
        },
      });
    } catch (err) {
      // Don't disclose whether the conflicting card belongs to this same
      // user or a different one — either way the caller just needs to know
      // it can't be linked again.
      if (err.code === "P2002") {
        return res.status(409).json({ error: "This card is already linked to an account." });
      }
      throw err;
    }

    res.status(201).json(linkedCard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
