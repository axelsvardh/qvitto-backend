import dotenv from "dotenv";
import Stripe from "stripe";

dotenv.config();

// Requires `stripe listen --forward-to localhost:4000/api/psp/stripe/webhook`
// running via the Stripe CLI, and STRIPE_WEBHOOK_SECRET set to the signing
// secret it prints, for the resulting webhook to actually reach our server.

const [, , userId, merchant = "ICA Kvantum Solna", amount = "252.00"] = process.argv;

if (!userId) {
  console.log("Usage: node scripts/create-stripe-test-payment.js <userId> [merchant] [amount]");
  process.exit(1);
}

if (!process.env.STRIPE_SECRET_KEY) {
  console.error("Set STRIPE_SECRET_KEY first (a Stripe test-mode secret key).");
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function main() {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(parseFloat(amount) * 100),
    currency: "sek",
    payment_method_types: ["card"],
    payment_method: "pm_card_visa",
    confirm: true,
    metadata: { userId, merchant },
  });

  console.log(`PaymentIntent ${paymentIntent.id} status: ${paymentIntent.status}`);
  console.log(
    "This only produces a visible effect on our side if `stripe listen --forward-to " +
      "localhost:4000/api/psp/stripe/webhook` is running and STRIPE_WEBHOOK_SECRET is " +
      "set to the CLI's printed signing secret."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
