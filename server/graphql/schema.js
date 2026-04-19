// server/graphql/schema.js
import { buildSchema } from 'graphql';

export function generateSchema() {
  // Extend types as needed (Bucket, LoginResult, etc.)
  return buildSchema(/* GraphQL */ `
    type Bucket {
      id: ID
      name: String!
    }

    type LoginResult {
      ok: Boolean!
      error: String
    }

    type Query {
      hello: String
      getBuckets: [Bucket!]!
    }

    type Mutation {
      echo(msg: String!): String
      login(url: String!, token: String!): LoginResult!
      logout: Boolean!
    }
  `);
}
