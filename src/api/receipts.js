import { PrismaClient } from "@prisma/client";
import { categorizeMerchant } from "./retailerService.js";
import { attemptMatchForReceipt } from "./matchingService.js";

const prisma = new PrismaClient();

// 🔹 Simulerad kvittoinlämning från POS
export const submitPosReceipt = async (req, res) => {
  try {
    const { merchant, amount, currency, timestamp, referenceId, storeAddress, items } = req.body;

    const receipt = await prisma.receipt.create({
      data: {
        total: amount,
        vat: amount * 0.25,
        source: "POS Simulator",
        merchant,
        currency,
        timestamp: new Date(timestamp),
        posReferenceId: referenceId ?? null,
        storeAddress,
        category: categorizeMerchant(merchant),
        items: items
          ? {
              create: items.map((item) => ({
                itemName: item.itemName,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.quantity * item.unitPrice,
              })),
            }
          : undefined,
      },
    });

    const matchResult = await attemptMatchForReceipt(receipt);

    res.status(201).json({ receipt, matched: Boolean(matchResult) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
