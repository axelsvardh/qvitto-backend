import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const [, , locationName] = process.argv;

if (!locationName) {
  console.error("Usage: node scripts/create-braintree-location.js <locationName>");
  process.exit(1);
}

const baseUrl = process.env.API_BASE_URL || "http://localhost:4000";
const apiKey = process.env.BRAINTREE_CHARGE_API_KEY || "test-braintree-charge-key";

async function main() {
  // Confirmed via GraphQL introspection (2026-08-30) — the full, real schema,
  // not a guess: InStoreLocationInput = { name: String!, internalName:
  // String!, address: InStoreLocationAddressInput!, payerId: ID (optional,
  // omitted here), enableQRCodePayments: Boolean! }. Address shape confirmed
  // separately: streetAddress/locality/region/postalCode/countryCode all
  // NonNull, extendedAddress optional (omitted).
  const response = await fetch(`${baseUrl}/api/braintree/locations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      location: {
        internalName: locationName,
        name: locationName,
        enableQRCodePayments: false,
        address: {
          streetAddress: "Testgatan 1",
          locality: "Stockholm",
          region: "Stockholm",
          postalCode: "11122",
          countryCode: "SE",
        },
      },
    }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    console.error(`Location creation failed (status ${response.status}):`, body);
    console.log(
      "\nGiven the unconfirmed InStoreLocationInput schema, this is expected and " +
        "informative rather than necessarily a bug — use the error to correct the shape."
    );
    process.exit(1);
  }

  console.log("Location created:");
  console.log(body);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
