import Stripe from "stripe";

let stripeClient = null;

export function getStripeClient() {
  if (stripeClient) return stripeClient;
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripeClient;
}
