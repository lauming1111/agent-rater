import "server-only";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

let cachedDocClient: DynamoDBDocumentClient | null = null;

export function getTableName(): string {
  const tableName = process.env.DDB_TABLE;
  if (!tableName) throw new Error("Missing env var: DDB_TABLE");
  return tableName;
}

export function getDocClient(): DynamoDBDocumentClient {
  if (cachedDocClient) return cachedDocClient;

  const region = process.env.AWS_REGION;
  if (!region) throw new Error("Missing env var: AWS_REGION");

  const client = new DynamoDBClient({ region });
  cachedDocClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });

  return cachedDocClient;
}

