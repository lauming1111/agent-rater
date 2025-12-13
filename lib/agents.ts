import "server-only";

import {
  PutCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
  type QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";

import { getDocClient, getTableName } from "./dynamo";

export type AgentProfile = {
  id: string;
  name: string;
  role: string;
  location: string;
  linkedin: string;
  summary: string;
  tags: string[];
  createdAt: string;
};

export type Experience = {
  rating: number;
  notes: string;
  ghosted: boolean;
  fakeJob: boolean;
  noResponse: boolean;
  createdAt: string;
};

function pk(agentId: string) {
  return `AGENT#${agentId}`;
}

function parseAgentId(partitionKey: string) {
  return partitionKey.startsWith("AGENT#") ? partitionKey.slice("AGENT#".length) : partitionKey;
}

export async function createAgentWithInitialExperience(input: {
  agent: Omit<AgentProfile, "createdAt"> & { createdAt?: string };
  experience?: Experience;
}) {
  const ddb = getDocClient();
  const tableName = getTableName();

  const createdAt = input.agent.createdAt ?? new Date().toISOString();
  const agentId = input.agent.id;

  const expCreatedAt = input.experience?.createdAt ?? createdAt;
  const experience: Experience | undefined = input.experience
    ? { ...input.experience, createdAt: expCreatedAt }
    : undefined;

  const transactItems = [
    {
      Put: {
        TableName: tableName,
        Item: {
          PK: pk(agentId),
          SK: "PROFILE",
          ...input.agent,
          createdAt,
        },
        ConditionExpression: "attribute_not_exists(PK)",
      },
    },
  ];

  if (experience) {
    transactItems.push({
      Put: {
        TableName: tableName,
        Item: {
          PK: pk(agentId),
          SK: `EXPERIENCE#${experience.createdAt}`,
          ...experience,
        },
      },
    });
  }

  await ddb.send(new TransactWriteCommand({ TransactItems: transactItems }));

  return { createdAt, experience };
}

export async function addExperience(agentId: string, experience: Experience) {
  const ddb = getDocClient();
  const tableName = getTableName();

  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: pk(agentId),
        SK: `EXPERIENCE#${experience.createdAt}`,
        ...experience,
      },
    })
  );
}

export async function getAgentWithExperiences(agentId: string) {
  const ddb = getDocClient();
  const tableName = getTableName();

  const res = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": pk(agentId) },
    })
  );

  const items = (res.Items ?? []) as Array<Record<string, unknown>>;

  const profile = items.find((item) => item.SK === "PROFILE") as unknown as AgentProfile | undefined;
  const experiences = items
    .filter((item) => typeof item.SK === "string" && item.SK.startsWith("EXPERIENCE#"))
    .map((item) => {
      const exp = item as unknown as Experience & { SK: string };
      return exp;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return { profile, experiences };
}

export async function listAgentsWithExperiences(limit = 50) {
  const ddb = getDocClient();
  const tableName = getTableName();

  const profiles: AgentProfile[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined = undefined;

  while (profiles.length < limit) {
    const remaining = limit - profiles.length;

    const scan = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: Math.min(remaining, 100),
        FilterExpression: "#sk = :profile",
        ExpressionAttributeNames: { "#sk": "SK" },
        ExpressionAttributeValues: { ":profile": "PROFILE" },
      })
    );

    const items = (scan.Items ?? []) as Array<Record<string, unknown>>;
    for (const item of items) {
      const partitionKey = item.PK;
      if (typeof partitionKey !== "string") continue;
      const id = parseAgentId(partitionKey);
      profiles.push({
        id,
        name: String(item.name ?? ""),
        role: String(item.role ?? ""),
        location: String(item.location ?? ""),
        linkedin: String(item.linkedin ?? ""),
        summary: String(item.summary ?? ""),
        tags: Array.isArray(item.tags) ? (item.tags as string[]) : [],
        createdAt: String(item.createdAt ?? ""),
      });
      if (profiles.length >= limit) break;
    }

    lastEvaluatedKey = scan.LastEvaluatedKey;
    if (!lastEvaluatedKey) break;
  }

  profiles.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const experiencesByAgentId: Record<string, Experience[]> = {};
  await Promise.all(
    profiles.map(async (agent) => {
      const input: QueryCommandInput = {
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: { ":pk": pk(agent.id), ":prefix": "EXPERIENCE#" },
      };
      const res = await ddb.send(new QueryCommand(input));
      const items = (res.Items ?? []) as Array<Record<string, unknown>>;
      const experiences = items
        .map((item) => ({
          rating: Number(item.rating ?? 0),
          notes: String(item.notes ?? ""),
          ghosted: Boolean(item.ghosted),
          fakeJob: Boolean(item.fakeJob),
          noResponse: Boolean(item.noResponse),
          createdAt: String(item.createdAt ?? ""),
        }))
        .filter((item) => item.createdAt)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      experiencesByAgentId[agent.id] = experiences;
    })
  );

  return { agents: profiles, experiencesByAgentId };
}

