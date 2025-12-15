import { NextResponse } from "next/server";

import { addExperience, getAgentWithExperiences } from "@/lib/agents";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

function publicMessage(err: unknown) {
  if (process.env.NODE_ENV !== "production") {
    return err instanceof Error ? err.message : "Unknown error";
  }
  return "Service unavailable";
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return jsonError(400, "Missing agent id");

  try {
    const data = await getAgentWithExperiences(id);
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error("[api/agents/:id][GET] failed", { agentId: id }, err);
    return jsonError(503, publicMessage(err));
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = requireAuth(req);
  } catch {
    return jsonError(401, "Please sign in with LinkedIn to submit.");
  }

  const { id } = await ctx.params;
  if (!id) return jsonError(400, "Missing agent id");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON");
  }

  if (!body || typeof body !== "object") return jsonError(400, "Invalid request body");

  const input = body as {
    rating?: number;
    notes?: string;
    tags?: string[] | string;
    countryRegion?: string;
    ghosted?: boolean;
    fakeJob?: boolean;
    noResponse?: boolean;
    createdAt?: string;
  };

  const rating = typeof input.rating === "number" ? input.rating : NaN;
  if (!(rating >= 1 && rating <= 5)) return jsonError(400, "rating must be 1..5");

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
  const countryRegion = (typeof input.countryRegion === "string" && input.countryRegion.trim()) || "unknown";

  try {
    await addExperience(id, {
      rating,
      notes: typeof input.notes === "string" ? input.notes : "",
      tags,
      countryRegion,
      ghosted: Boolean(input.ghosted),
      fakeJob: Boolean(input.fakeJob),
      noResponse: Boolean(input.noResponse),
      createdBySub: session.sub,
      createdByEmail: session.email,
      createdAt,
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[api/agents/:id][POST] failed", { agentId: id }, err);
    return jsonError(503, publicMessage(err));
  }
}
