import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { categorizeMerchant } from "../src/api/retailerService.js";

const prisma = new PrismaClient();

const TEST_USER = {
  name: "Test User",
  email: "test@qvitto.se",
  password: "password123",
};

const hoursAgo = (hours) => new Date(Date.now() - hours * 60 * 60 * 1000);

const RECEIPTS = [
  {
    merchant: "ICA Kvantum Solna",
    amount: 252.0,
    timestamp: hoursAgo(3),
    storeAddress: "Solnavägen 4, Solna",
    items: [
      { itemName: "Mjölk 1L", quantity: 2, unitPrice: 15.9 },
      { itemName: "Bananer", quantity: 1, unitPrice: 24.9 },
      { itemName: "Kycklingfilé", quantity: 1, unitPrice: 89.9 },
      { itemName: "Pasta", quantity: 3, unitPrice: 18.9 },
    ],
  },
  {
    merchant: "SL Reskassa",
    amount: 380.0,
    timestamp: hoursAgo(10),
    storeAddress: "Stockholm",
  },
  {
    merchant: "Espresso House",
    amount: 46.0,
    timestamp: hoursAgo(13),
    storeAddress: "Sergels Torg, Stockholm",
  },
  {
    merchant: "H&M Drottninggatan",
    amount: 599.0,
    timestamp: hoursAgo(27),
    storeAddress: "Drottninggatan 53, Stockholm",
    items: [
      { itemName: "T-shirt", quantity: 2, unitPrice: 149.5 },
      { itemName: "Strumpor 3-pack", quantity: 1, unitPrice: 99.0 },
      { itemName: "Jeans", quantity: 1, unitPrice: 201.0 },
    ],
  },
  {
    merchant: "Systembolaget",
    amount: 189.0,
    timestamp: hoursAgo(30),
    storeAddress: "Odenplan, Stockholm",
  },
  {
    merchant: "Apotek Hjärtat",
    amount: 128.5,
    timestamp: hoursAgo(32),
    storeAddress: "Vasagatan 10, Stockholm",
  },
  {
    merchant: "Clas Ohlson",
    amount: 349.0,
    timestamp: hoursAgo(85),
    storeAddress: "Gallerian, Stockholm",
  },
  {
    merchant: "McDonald's",
    amount: 112.0,
    timestamp: hoursAgo(50),
    storeAddress: "Kungsgatan 44, Stockholm",
  },
  {
    merchant: "Spotify",
    amount: 119.0,
    timestamp: hoursAgo(96),
    storeAddress: null,
  },
  {
    merchant: "Uber",
    amount: 145.0,
    timestamp: hoursAgo(58),
    storeAddress: "Stockholm",
  },
];

async function main() {
  const hashedPassword = await bcrypt.hash(TEST_USER.password, 10);
  const user = await prisma.user.upsert({
    where: { email: TEST_USER.email },
    update: {},
    create: {
      name: TEST_USER.name,
      email: TEST_USER.email,
      password: hashedPassword,
    },
  });

  const existingTransactionIds = (
    await prisma.transaction.findMany({ where: { userId: user.id }, select: { id: true } })
  ).map((t) => t.id);

  if (existingTransactionIds.length) {
    const existingReceiptIds = (
      await prisma.receipt.findMany({
        where: { transactionId: { in: existingTransactionIds } },
        select: { id: true },
      })
    ).map((r) => r.id);

    await prisma.receiptItem.deleteMany({ where: { receiptId: { in: existingReceiptIds } } });
    await prisma.receipt.deleteMany({ where: { id: { in: existingReceiptIds } } });
    await prisma.transaction.deleteMany({ where: { id: { in: existingTransactionIds } } });
  }

  for (const r of RECEIPTS) {
    const tx = await prisma.transaction.create({
      data: {
        userId: user.id,
        merchant: r.merchant,
        amount: r.amount,
        currency: "SEK",
        timestamp: r.timestamp,
      },
    });

    await prisma.receipt.create({
      data: {
        transactionId: tx.id,
        total: r.amount,
        vat: r.amount * 0.25,
        source: "Seed Data",
        storeAddress: r.storeAddress,
        category: categorizeMerchant(r.merchant),
        items: r.items
          ? {
              create: r.items.map((item) => ({
                itemName: item.itemName,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.quantity * item.unitPrice,
              })),
            }
          : undefined,
      },
    });
  }

  console.log(`Seeded user ${user.email} with ${RECEIPTS.length} receipts.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
