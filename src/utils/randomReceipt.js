import { categorizeMerchant } from "../api/retailerService.js";

// Store names must classify into their own category via categorizeMerchant,
// otherwise the generated receipt would show a different category than intended.
const CATALOG = {
  GROCERIES: {
    stores: [
      "ICA Kvantum Solna",
      "Coop Sockenplan",
      "Willys Hornstull",
      "Hemköp Odenplan",
      "Lidl Medborgarplatsen",
      "City Gross Barkarby",
    ],
    items: [
      ["Mjölk 1L", 15.9],
      ["Bröd", 32.9],
      ["Bananer", 7.3],
      ["Kycklingfilé", 89.9],
      ["Pasta", 18.9],
      ["Ägg 12-pack", 42.5],
      ["Smör", 54.9],
      ["Äpplen", 24.9],
      ["Kaffe", 59.9],
      ["Ost", 69.9],
    ],
  },
  FOOD: {
    stores: [
      "McDonald's Slussen",
      "Max Burgers Odenplan",
      "Espresso House Sergel",
      "Burger King Kungsgatan",
      "Starbucks Centralen",
    ],
    items: [
      ["Hamburgare", 59],
      ["Pommes", 32],
      ["Cheeseburgermeny", 99],
      ["Cappuccino", 45],
      ["Kanelbulle", 38],
      ["Läsk", 29],
      ["Latte", 52],
      ["Kycklingwrap", 79],
    ],
  },
  TRANSPORTATION: {
    stores: ["SL Reskassa", "Uber", "Bolt", "SJ"],
    items: [
      ["Enkelbiljett", 41],
      ["Dygnsbiljett", 130],
      ["Taxiresa", 189],
      ["Tågbiljett", 249],
    ],
  },
  ENTERTAINMENT: {
    stores: ["Spotify", "Netflix", "SF Bio Rigoletto", "Filmstaden Sickla"],
    items: [
      ["Biobiljett", 135],
      ["Popcorn", 59],
      ["Månadsabonnemang", 119],
      ["Dryck", 39],
    ],
  },
  HEALTH: {
    stores: ["Apotek Hjärtat Vasagatan", "Apoteket Kungsgatan"],
    items: [
      ["Alvedon", 39],
      ["Nässpray", 89],
      ["Vitamin D", 119],
      ["Plåster", 35],
      ["Halstabletter", 49],
    ],
  },
  SHOPPING: {
    stores: [
      "H&M Drottninggatan",
      "IKEA Kungens Kurva",
      "Elgiganten Solna",
      "Clas Ohlson Gallerian",
      "Zara Sturegallerian",
    ],
    items: [
      ["T-shirt", 149],
      ["Jeans", 499],
      ["Skruvmejsel", 79],
      ["LED-lampa", 49],
      ["Hörlurar", 599],
      ["Kudde", 129],
    ],
  },
  UTILITIES: {
    stores: ["Vattenfall", "Telia", "Tele2"],
    items: [
      ["Elavgift", 612.5],
      ["Mobilabonnemang", 349],
      ["Bredband", 399],
      ["Nätavgift", 285],
    ],
  },
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export const CATALOG_CATEGORIES = Object.keys(CATALOG);

export function generateMerchant(category) {
  return pick(CATALOG[category ?? pick(CATALOG_CATEGORIES)].stores);
}

export function generateItems(merchant) {
  const pool = CATALOG[categorizeMerchant(merchant)] ?? CATALOG[pick(CATALOG_CATEGORIES)];
  const count = 1 + Math.floor(Math.random() * 4);
  const chosen = [...pool.items].sort(() => Math.random() - 0.5).slice(0, count);

  return chosen.map(([itemName, unitPrice]) => ({
    itemName,
    unitPrice,
    quantity: 1 + Math.floor(Math.random() * 3),
  }));
}

export const sumItems = (items) =>
  Math.round(items.reduce((total, item) => total + item.quantity * item.unitPrice, 0) * 100) / 100;
