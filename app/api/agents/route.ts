import { NextResponse } from "next/server";

import { createAgentWithInitialExperience, listAgentsWithExperiences } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const data = await listAgentsWithExperiences(100);
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonError(503, message);
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON");
  }

  if (!body || typeof body !== "object") return jsonError(400, "Invalid request body");

  const input = body as {
    id?: string;
    name?: string;
    role?: string;
    location?: string;
    linkedin?: string;
    summary?: string;
    tags?: string[] | string;
    rating?: number;
    createdAt?: string;
  };

  const name = typeof input.name === "string" ? input.name.trim() : "";
  const linkedin = typeof input.linkedin === "string" ? input.linkedin.trim() : "";
  if (!name) return jsonError(400, "Missing name");
  if (!linkedin) return jsonError(400, "Missing linkedin");

  const id = (typeof input.id === "string" && input.id.trim()) || crypto.randomUUID();
  const createdAt = (typeof input.createdAt === "string" && input.createdAt) || new Date().toISOString();

  const tags =
    Array.isArray(input.tags)
      ? input.tags.filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim())
      : typeof input.tags === "string"
        ? input.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

  const role = typeof input.role === "string" && input.role.trim() ? input.role.trim() : "HR Agent";
  const location = typeof input.location === "string" && input.location.trim() ? input.location.trim() : "Unknown";
  const summary = typeof input.summary === "string" && input.summary.trim() ? input.summary.trim() : "No summary yet.";

  const rating = typeof input.rating === "number" ? input.rating : undefined;
  const experience =
    rating && rating >= 1 && rating <= 5
      ? {
          rating,
          notes: "",
          ghosted: false,
          fakeJob: false,
          noResponse: false,
          createdAt,
        }
      : undefined;

  try {
    const res = await createAgentWithInitialExperience({
      agent: { id, name, role, location, linkedin, summary, tags, createdAt },
      experience,
    });

    return NextResponse.json(
      {
        agent: { id, name, role, location, linkedin, summary, tags, createdAt: res.createdAt },
        experience: res.experience,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonError(503, message);
  }
}

