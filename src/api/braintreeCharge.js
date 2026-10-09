import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { categorizeMerchant } from "./retailerService.js";
import { braintreeGraphqlRequest } from "../utils/braintreeGraphqlClient.js";

const prisma = new PrismaClient();

const CREATE_IN_STORE_LOCATION_MUTATION = `
  mutation CreateInStoreLocation($input: CreateInStoreLocationInput!) {
    createInStoreLocation(input: $input) {
      location { id }
    }
  }
`;

const REQUEST_CHARGE_FROM_IN_STORE_READER_MUTATION = `
  mutation RequestChargeFromInStoreReader($input: RequestChargeFromInStoreReaderInput!) {
    requestChargeFromInStoreReader(input: $input) {
      inStoreContext { id status }
    }
  }
`;

// Exact required sub-fields of InStoreLocationInput's nested location object
// are unconfirmed — pass req.body.location straight through rather than
// guessing a shape; verify against Braintree's GraphQL API Explorer.
export const createLocation = async (req, res) => {
  try {
    const { location } = req.body;

    let data;
    try {
      data = await braintreeGraphqlRequest(CREATE_IN_STORE_LOCATION_MUTATION, {
        input: { location },
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const chargeReader = async (req, res) => {
  try {
    const { readerId, amount, currency, merchant, storeAddress, lineItems, qvittoUserId } = req.body;

    const receipt = await prisma.receipt.create({
      data: {
        total: amount,
        vat: amount * 0.25,
        source: "Braintree In-Person",
        merchant: merchant || "Unknown (Braintree In-Person)",
        currency,
        timestamp: new Date(),
        storeAddress,
        category: categorizeMerchant(merchant),
        // No posReferenceId here on purpose — the eventual Braintree
        // transaction id doesn't exist yet at charge-request time. This
        // Receipt stays unmatched until attemptMatchForReceipt's
        // amount+currency+time-window fallback links it to whatever
        // Transaction braintreeWebhook.js creates once the real
        // TransactionSettled webhook arrives later.
        items: lineItems?.length
          ? {
              create: lineItems.map((item) => ({
                itemName: item.itemName,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.quantity * item.unitPrice,
              })),
            }
          : undefined,
      },
    });

    let chargeResult;
    try {
      // Confirmed via GraphQL introspection (2026-08-30): InStoreTransactionInput
      // nests lineItems (TransactionLineItemInput[]: name, kind [DEBIT/CREDIT
      // enum], quantity/unitAmount/totalAmount as strings) and customFields
      // ([CustomFieldInput]: name is a CustomFieldName enum, value a plain
      // string). The "qvittoUserId" enum value only exists once a custom
      // field with that exact name has been created by hand in the Braintree
      // Control Panel — calling this before that setup step will fail with a
      // clear "not a valid CustomFieldName" error, which is expected, not a
      // bug in this code.
      chargeResult = await braintreeGraphqlRequest(
        REQUEST_CHARGE_FROM_IN_STORE_READER_MUTATION,
        {
          input: {
            readerId,
            transaction: {
              amount: String(amount),
              lineItems: lineItems?.length
                ? lineItems.map((item) => ({
                    name: item.itemName,
                    kind: "DEBIT",
                    quantity: String(item.quantity),
                    unitAmount: String(item.unitPrice),
                    totalAmount: String(item.quantity * item.unitPrice),
                  }))
                : undefined,
              customFields: qvittoUserId
                ? [{ name: "qvittoUserId", value: qvittoUserId }]
                : undefined,
            },
          },
        },
        { "Idempotency-Key": crypto.randomUUID() }
      );
    } catch (err) {
      return res.status(502).json({ error: err.message, receipt });
    }

    res.status(201).json({ receipt, chargeResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
