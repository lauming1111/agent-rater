import "server-only";

import {
  DeleteCommand,
  GetCommand,
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
  phoneCountryCode: string;
  phone: string;
  summary?: string;
  tags: string[];
  createdAt: string;
};

export type Experience = {
  rating: number;
  notes: string;
  tags: string[];
  countryRegion: string;
  ghosted: boolean;
  fakeJob: boolean;
  noResponse: boolean;
  createdBySub?: string;
  createdByEmail?: string;
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
  const { summary: summaryToIgnore, ...agentWithoutSummary } = input.agent;
  void summaryToIgnore;

  const expCreatedAt = input.experience?.createdAt ?? createdAt;
  const experience: Experience | undefined = input.experience
    ? { ...input.experience, createdAt: expCreatedAt }
    : undefined;

  const transactItems: Array<{
    Put: {
      TableName: string;
      Item: Record<string, unknown>;
      ConditionExpression?: string;
    };
  }> = [
    {
      Put: {
        TableName: tableName,
        Item: {
          PK: pk(agentId),
          SK: "PROFILE",
          ...agentWithoutSummary,
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

export async function getExperienceItem(agentId: string, createdAt: string) {
  const ddb = getDocClient();
  const tableName = getTableName();

  const res = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: pk(agentId), SK: `EXPERIENCE#${createdAt}` },
    })
  );

  return (res.Item as Record<string, unknown> | undefined) ?? null;
}

export async function putExperienceItem(agentId: string, createdAt: string, item: Record<string, unknown>) {
  const ddb = getDocClient();
  const tableName = getTableName();

  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: pk(agentId),
        SK: `EXPERIENCE#${createdAt}`,
        ...item,
      },
    })
  );
}

export async function deleteExperienceItem(agentId: string, createdAt: string) {
  const ddb = getDocClient();
  const tableName = getTableName();

  await ddb.send(
    new DeleteCommand({
      TableName: tableName,
      Key: { PK: pk(agentId), SK: `EXPERIENCE#${createdAt}` },
    })
  );
}

export async function listExperiencesByUser(sub: string, limit = 50) {
  const ddb = getDocClient();
  const tableName = getTableName();

  const results: Array<{
    agentId: string;
    createdAt: string;
    rating: number;
    notes: string;
    countryRegion: string;
    tags: string[];
  }> = [];

  let lastEvaluatedKey: Record<string, unknown> | undefined;
  while (results.length < limit) {
    const scan = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastEvaluatedKey as never,
        FilterExpression: "begins_with(#sk, :exp) AND #createdBySub = :sub",
        ExpressionAttributeNames: { "#sk": "SK", "#createdBySub": "createdBySub" },
        ExpressionAttributeValues: { ":exp": "EXPERIENCE#", ":sub": sub },
        Limit: Math.min(200, limit * 5),
      })
    );

    const items = (scan.Items ?? []) as Array<Record<string, unknown>>;
    for (const item of items) {
      const pkValue = item.PK;
      const createdAt = String(item.createdAt ?? "");
      if (typeof pkValue !== "string" || !createdAt) continue;
      results.push({
        agentId: parseAgentId(pkValue),
        createdAt,
        rating: Number(item.rating ?? 0),
        notes: String(item.notes ?? ""),
        countryRegion: String(item.countryRegion ?? "unknown"),
        tags: Array.isArray(item.tags) ? (item.tags as string[]).filter((t) => typeof t === "string") : [],
      });
      if (results.length >= limit) break;
    }

    lastEvaluatedKey = scan.LastEvaluatedKey as Record<string, unknown> | undefined;
    if (!lastEvaluatedKey) break;
  }

  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return results.slice(0, limit);
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

  const profileItem = items.find((item) => item.SK === "PROFILE");
  const profile = profileItem
    ? ({
        id: agentId,
        name: String(profileItem.name ?? ""),
        role: String(profileItem.role ?? ""),
        location: String(profileItem.location ?? ""),
        linkedin: String(profileItem.linkedin ?? ""),
        phoneCountryCode: String(profileItem.phoneCountryCode ?? "+1"),
        phone: String(profileItem.phone ?? ""),
        summary: typeof profileItem.summary === "string" ? String(profileItem.summary ?? "") : undefined,
        tags: Array.isArray(profileItem.tags) ? (profileItem.tags as string[]) : [],
        createdAt: String(profileItem.createdAt ?? ""),
      } satisfies AgentProfile)
    : undefined;
  const experiences = items
    .filter((item) => typeof item.SK === "string" && item.SK.startsWith("EXPERIENCE#"))
    .map((item) => {
      const exp = item as unknown as Partial<Experience> & { SK: string };
      return {
        rating: Number(exp.rating ?? 0),
        notes: String(exp.notes ?? ""),
        tags: Array.isArray(exp.tags) ? (exp.tags as string[]) : [],
        countryRegion: String(exp.countryRegion ?? "unknown"),
        ghosted: Boolean(exp.ghosted),
        fakeJob: Boolean(exp.fakeJob),
        noResponse: Boolean(exp.noResponse),
        createdAt: String(exp.createdAt ?? ""),
      } satisfies Experience;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (profile) {
    const latest = experiences[0]?.notes;
    profile.summary = latest || profile.summary || "";
  }

  return { profile, experiences };
}

export async function listAgentsWithExperiences(limit = 50) {
  const ddb = getDocClient();
  const tableName = getTableName();

  const groups = new Map<string, { profile: AgentProfile; ids: string[] }>();
  let lastEvaluatedKey: Record<string, unknown> | undefined = undefined;

  while (groups.size < limit) {
    const scan: { Items?: Array<Record<string, unknown>>; LastEvaluatedKey?: Record<string, unknown> } =
      await ddb.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 100,
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
      const name = String(item.name ?? "").trim();
      if (!name) continue;

      const profileFromItem: AgentProfile = {
        id,
        name,
        role: String(item.role ?? ""),
        location: String(item.location ?? ""),
        linkedin: String(item.linkedin ?? ""),
        phoneCountryCode: String(item.phoneCountryCode ?? "+1"),
        phone: String(item.phone ?? ""),
        summary: typeof item.summary === "string" ? String(item.summary ?? "") : undefined,
        tags: Array.isArray(item.tags) ? (item.tags as string[]) : [],
        createdAt: String(item.createdAt ?? ""),
      };

      const existing = groups.get(name);
      if (!existing) {
        groups.set(name, { profile: profileFromItem, ids: [id] });
        if (groups.size >= limit) break;
        continue;
      }

      if (!existing.ids.includes(id)) existing.ids.push(id);

      const mergedTags = Array.from(new Set([...(existing.profile.tags ?? []), ...(profileFromItem.tags ?? [])]));
      existing.profile.tags = mergedTags;

      if (!existing.profile.linkedin && profileFromItem.linkedin) existing.profile.linkedin = profileFromItem.linkedin;
      if (!existing.profile.phone && profileFromItem.phone) existing.profile.phone = profileFromItem.phone;
      if (!existing.profile.location && profileFromItem.location) existing.profile.location = profileFromItem.location;
      if (!existing.profile.role && profileFromItem.role) existing.profile.role = profileFromItem.role;
      if (
        !existing.profile.phoneCountryCode &&
        profileFromItem.phoneCountryCode
      ) {
        existing.profile.phoneCountryCode = profileFromItem.phoneCountryCode;
      }

      const stableId = `name#${name}`;
      const existingHasStable = existing.ids.includes(stableId);
      const nextIsStable = id === stableId;
      if (!existingHasStable && nextIsStable) existing.profile.id = id;

      const createdAt = profileFromItem.createdAt;
      if (createdAt && createdAt.localeCompare(existing.profile.createdAt) > 0) {
        existing.profile.createdAt = createdAt;
        if (!existingHasStable && !nextIsStable) existing.profile.id = id;
      }
    }

    lastEvaluatedKey = scan.LastEvaluatedKey;
    if (!lastEvaluatedKey) break;
  }

  const profiles = Array.from(groups.values()).map((group) => group.profile);
  profiles.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const experiencesByAgentId: Record<string, Experience[]> = {};
  await Promise.all(
    Array.from(groups.values()).map(async ({ profile, ids }) => {
      const merged: Experience[] = [];

      await Promise.all(
        ids.map(async (agentId) => {
          const input: QueryCommandInput = {
            TableName: tableName,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
            ExpressionAttributeValues: { ":pk": pk(agentId), ":prefix": "EXPERIENCE#" },
          };
          const res = await ddb.send(new QueryCommand(input));
          const items = (res.Items ?? []) as Array<Record<string, unknown>>;
          for (const item of items) {
            const createdAt = String(item.createdAt ?? "");
            if (!createdAt) continue;
            merged.push({
              rating: Number(item.rating ?? 0),
              notes: String(item.notes ?? ""),
              tags: Array.isArray(item.tags) ? (item.tags as string[]) : [],
              countryRegion: String(item.countryRegion ?? "unknown"),
              ghosted: Boolean(item.ghosted),
              fakeJob: Boolean(item.fakeJob),
              noResponse: Boolean(item.noResponse),
              createdAt,
            });
          }
        })
      );

      merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      experiencesByAgentId[profile.id] = merged;
    })
  );

  for (const agent of profiles) {
    const latest = experiencesByAgentId[agent.id]?.[0]?.notes;
    agent.summary = latest || agent.summary || "";
  }

  return { agents: profiles, experiencesByAgentId };
}

export async function findAgentIdByLinkedin(linkedin: string) {
  const ddb = getDocClient();
  const tableName = getTableName();

  const res = await ddb.send(
    new ScanCommand({
      TableName: tableName,
      Limit: 1,
      FilterExpression: "#sk = :profile AND #linkedin = :linkedin",
      ExpressionAttributeNames: { "#sk": "SK", "#linkedin": "linkedin" },
      ExpressionAttributeValues: { ":profile": "PROFILE", ":linkedin": linkedin },
    })
  );

  const item = res.Items?.[0] as Record<string, unknown> | undefined;
  const partitionKey = item?.PK;
  if (typeof partitionKey !== "string") return null;
  return parseAgentId(partitionKey);
}

export async function getAgentProfile(agentId: string) {
  const ddb = getDocClient();
  const tableName = getTableName();

  const res = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: pk(agentId), SK: "PROFILE" },
    })
  );

  const item = res.Item as Record<string, unknown> | undefined;
  if (!item) return null;

  return {
    id: agentId,
    name: String(item.name ?? ""),
    role: String(item.role ?? ""),
    location: String(item.location ?? ""),
    linkedin: String(item.linkedin ?? ""),
    phoneCountryCode: String(item.phoneCountryCode ?? "+1"),
    phone: String(item.phone ?? ""),
    summary: typeof item.summary === "string" ? String(item.summary ?? "") : undefined,
    tags: Array.isArray(item.tags) ? (item.tags as string[]) : [],
    createdAt: String(item.createdAt ?? ""),
  } satisfies AgentProfile;
}

export async function putAgentProfile(profile: AgentProfile) {
  const ddb = getDocClient();
  const tableName = getTableName();
  const { summary: summaryToIgnore, ...profileWithoutSummary } = profile;
  void summaryToIgnore;

  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: pk(profile.id),
        SK: "PROFILE",
        ...profileWithoutSummary,
      },
    })
  );
}
