import dotenv from "dotenv";
import { braintreeGraphqlRequest } from "../src/utils/braintreeGraphqlClient.js";

dotenv.config();

const [, , typeName] = process.argv;

if (!typeName) {
  console.error("Usage: node scripts/introspect-braintree-type.js <GraphQLTypeName>");
  process.exit(1);
}

const INTROSPECT_QUERY = `
  query IntrospectType($name: String!) {
    __type(name: $name) {
      name
      kind
      inputFields {
        name
        type {
          name
          kind
          ofType { name kind ofType { name kind } }
        }
      }
      fields {
        name
        type {
          name
          kind
          ofType { name kind ofType { name kind } }
        }
      }
      enumValues {
        name
      }
    }
  }
`;

function describeType(type) {
  if (!type) return "unknown";
  if (type.kind === "NON_NULL") return `${describeType(type.ofType)}!`;
  if (type.kind === "LIST") return `[${describeType(type.ofType)}]`;
  return type.name || type.kind;
}

async function main() {
  const data = await braintreeGraphqlRequest(INTROSPECT_QUERY, { name: typeName });
  const type = data.__type;

  if (!type) {
    console.log(`No type named "${typeName}" found (introspection may be disabled, or the name is wrong).`);
    return;
  }

  console.log(`${type.name} (${type.kind})`);

  if (type.kind === "ENUM") {
    const values = type.enumValues || [];
    if (!values.length) {
      console.log("  (no enum values returned)");
      return;
    }
    for (const v of values) {
      console.log(`  ${v.name}`);
    }
    return;
  }

  const fields = type.inputFields || type.fields || [];
  if (!fields.length) {
    console.log("  (no fields returned)");
    return;
  }

  for (const field of fields) {
    console.log(`  ${field.name}: ${describeType(field.type)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
