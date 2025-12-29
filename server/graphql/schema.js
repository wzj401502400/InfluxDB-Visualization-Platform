// server/graphql/schema.js
import { buildSchema } from 'graphql';

export function generateSchema() {
  // 根据你需求可以再扩展类型（Bucket、LoginResult 等）
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
