const CATEGORY_KEYWORDS = {
  GROCERIES: ["ica", "coop", "willys", "hemköp", "hemkop", "lidl", "city gross"],
  TRANSPORTATION: ["\\bsl\\b", "uber", "bolt", "taxi", "\\bsj\\b", "västtrafik", "vasttrafik"],
  FOOD: ["mcdonald", "\\bmax\\b", "burger king", "espresso house", "starbucks"],
  ENTERTAINMENT: ["netflix", "spotify", "sf bio", "filmstaden"],
  HEALTH: ["apotek", "kry"],
  SHOPPING: ["h&m", "zara", "ikea", "elgiganten", "systembolaget", "clas ohlson"],
  UTILITIES: ["vattenfall", "telia", "tele2"],
};

const matchesKeyword = (normalizedName, keyword) =>
  keyword.startsWith("\\b")
    ? new RegExp(keyword, "i").test(normalizedName)
    : normalizedName.includes(keyword);

export const categorizeMerchant = (merchantName) => {
  if (!merchantName) return "OTHER";

  const normalized = merchantName.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => matchesKeyword(normalized, keyword))) {
      return category;
    }
  }

  return "OTHER";
};
