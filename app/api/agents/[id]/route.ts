import { NextResponse } from "next/server";

import { addExperience, getAgentWithExperiences } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return jsonError(400, "Missing agent id");

  try {
    const data = await getAgentWithExperiences(id);
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonError(503, message);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
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

  try {
    await addExperience(id, {
      rating,
      notes: typeof input.notes === "string" ? input.notes : "",
      tags,
      ghosted: Boolean(input.ghosted),
      fakeJob: Boolean(input.fakeJob),
      noResponse: Boolean(input.noResponse),
      createdAt,
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonError(503, message);
  }
}
