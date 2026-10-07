import fetch from "node-fetch";

// Sandbox-only endpoint/version — production would be
// https://payments.braintree-api.com/graphql, and both this URL and the
// Braintree-Version string should become env-configurable once this project
// ever has a production Braintree account.
const BRAINTREE_GRAPHQL_URL = "https://payments.sandbox.braintree-api.com/graphql";
const BRAINTREE_VERSION = "2019-01-01";

export async function braintreeGraphqlRequest(query, variables, extraHeaders = {}) {
  const { BRAINTREE_PUBLIC_KEY, BRAINTREE_PRIVATE_KEY } = process.env;
  if (!BRAINTREE_PUBLIC_KEY || !BRAINTREE_PRIVATE_KEY) {
    throw new Error("BRAINTREE_PUBLIC_KEY and BRAINTREE_PRIVATE_KEY must both be set");
  }

  const auth = Buffer.from(`${BRAINTREE_PUBLIC_KEY}:${BRAINTREE_PRIVATE_KEY}`).toString("base64");

  const response = await fetch(BRAINTREE_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
      "Braintree-Version": BRAINTREE_VERSION,
      ...extraHeaders,
    },
    body: JSON.stringify({ query, variables }),
  });

  const body = await response.json();

  if (body.errors && body.errors.length > 0) {
    throw new Error(body.errors.map((e) => e.message).join("; "));
  }

  return body.data;
}
