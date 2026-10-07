import { PrismaClient } from "@prisma/client";
import { getStripeClient } from "../utils/stripeClient.js";
import { categorizeMerchant } from "./retailerService.js";
import { attemptMatchForReceipt } from "./matchingService.js";
import {
  CATALOG_CATEGORIES,
  generateItems,
  generateMerchant,
  sumItems,
} from "../utils/randomReceipt.js";

const prisma = new PrismaClient();

export const createTestPayment = async (req, res) => {
  try {
    const {
      userId,
      category,
      merchant: merchantInput,
      amount: amountInput,
      items: itemsInput,
    } = req.body ?? {};

    if (category && !CATALOG_CATEGORIES.includes(category)) {
      return res
        .status(400)
        .json({ error: `category must be one of: ${CATALOG_CATEGORIES.join(", ")}` });
    }

    const merchant = merchantInput ?? generateMerchant(category);

    // Sending neither amount nor items means "surprise me": random items for
    // the store's category, with the amount derived from them so they add up.
    const items =
      itemsInput === undefined && amountInput === undefined
        ? generateItems(merchant)
        : itemsInput;

    const amountNumber = Number(amountInput ?? (items?.length ? sumItems(items) : 252));
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }

    const stripe = getStripeClient();

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amountNumber * 100),
      currency: "sek",
      payment_method_types: ["card"],
      payment_method: "pm_card_visa",
      confirm: true,
      metadata: userId ? { userId, merchant } : { merchant },
    });

    let receipt = null;
    let matchedImmediately = false;

    if (items?.length) {
      receipt = await prisma.receipt.create({
        data: {
          total: amountNumber,
          vat: amountNumber * 0.25,
          source: "Dev Test Payment",
          merchant,
          currency: "SEK",
          timestamp: new Date(),
          posReferenceId: paymentIntent.id,
          category: categorizeMerchant(merchant),
          items: {
            create: items.map((item) => ({
              itemName: item.itemName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.quantity * item.unitPrice,
            })),
          },
        },
      });

      // The Stripe webhook may have already created the Transaction before the
      // receipt existed; if so, the webhook's own match attempt found nothing,
      // so match from the receipt side too.
      matchedImmediately = Boolean(await attemptMatchForReceipt(receipt));
    }

    res.status(201).json({
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      merchant,
      category: categorizeMerchant(merchant),
      amount: amountNumber,
      items: items ?? [],
      receiptId: receipt?.id ?? null,
      matchedImmediately,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
