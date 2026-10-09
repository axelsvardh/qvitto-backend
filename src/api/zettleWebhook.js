import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const handleZettleWebhook = async (req, res) => {
  try {
    const expectedSecret = process.env.ZETTLE_WEBHOOK_SHARED_SECRET;
    if (!expectedSecret) {
      return res.status(500).json({ error: "ZETTLE_WEBHOOK_SHARED_SECRET is not set" });
    }

    // Stand-in for real webhook signature verification: Zettle's `signingKey`
    // mechanism has no publicly documented header/algorithm, so instead we rely
    // on a shared secret embedded in the `destination` URL we ourselves registered.
    // This is weaker than a real signature check — flag, don't treat as solved.
    if (req.query.secret !== expectedSecret) {
      return res.status(401).json({ error: "Invalid or missing secret" });
    }

    const testUserId = req.query.testUserId;
    if (!testUserId) {
      return res.status(400).json({
        error:
          "No consumer-identity mechanism exists yet — testUserId query param required for now (see known gap).",
      });
    }

    const { organizationUuid, eventName, timestamp } = req.body || {};

    let payload;
    try {
      payload = JSON.parse(req.body.payload);
    } catch (err) {
      return res.status(400).json({ error: "Malformed payload JSON" });
    }

    if (eventName !== "PurchaseCreated") {
      return res.status(200).json({ received: true, ignored: eventName });
    }

    const { purchaseUuid, currency, amount, vatAmount, products } = payload;
    const eventTimestamp = timestamp;

    let tx;
    try {
      tx = await prisma.transaction.create({
        data: {
          userId: testUserId,
          merchant: `Zettle store ${organizationUuid.slice(0, 8)}`,
          amount: amount / 100,
          currency: currency.toUpperCase(),
          timestamp: new Date(eventTimestamp),
          paymentReferenceId: purchaseUuid,
          receipt: {
            create: {
              total: amount / 100,
              vat: vatAmount / 100,
              source: `Zettle (org: ${organizationUuid})`,
              merchant: `Zettle store ${organizationUuid.slice(0, 8)}`,
              currency: currency.toUpperCase(),
              timestamp: new Date(eventTimestamp),
              posReferenceId: purchaseUuid,
              // products[] field names (name/quantity/unitPrice) are best-effort
              // from documentation, not a captured real payload — verify once
              // real Zettle test data is available.
              items: {
                create: (products || []).map((p) => ({
                  itemName: p.name,
                  quantity: p.quantity,
                  unitPrice: p.unitPrice / 100,
                  totalPrice: (p.quantity * p.unitPrice) / 100,
                })),
              },
            },
          },
        },
        include: { receipt: true },
      });
    } catch (err) {
      // Zettle delivers webhooks at-least-once; a duplicate delivery hits the
      // unique constraint on paymentReferenceId. Treat that as already-processed
      // success, not a failure.
      if (err.code === "P2002") {
        return res.status(200).json({ received: true, duplicate: true });
      }
      throw err;
    }

    res.status(201).json({ received: true, transaction: tx });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
