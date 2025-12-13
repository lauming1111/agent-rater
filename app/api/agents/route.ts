import { NextResponse } from "next/server";

import {
  addExperience,
  createAgentWithInitialExperience,
  findAgentIdByLinkedin,
  getAgentProfile,
  listAgentsWithExperiences,
  putAgentProfile,
} from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  if (digits.length > 10) return digits.slice(-10);
  if (digits.length < 10) return "";
  return digits;
}

function normalizeCountryCode(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 3);
  return digits ? `+${digits}` : "";
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
    phoneCountryCode?: string;
    phone?: string;
    summary?: string;
    tags?: string[] | string;
    rating?: number;
    notes?: string;
    experienceTags?: string[] | string;
    countryRegion?: string;
    createdAt?: string;
  };

  const normalizeLinkedin = (value: string) => value.trim().toLowerCase().replace(/\/+$/, "");

  const name = typeof input.name === "string" ? input.name.trim() : "";
  const linkedinRaw = typeof input.linkedin === "string" ? input.linkedin.trim() : "";
  const linkedin = linkedinRaw ? normalizeLinkedin(linkedinRaw) : "";
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
  const experienceTags =
    Array.isArray(input.experienceTags)
      ? input.experienceTags.filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim())
      : typeof input.experienceTags === "string"
        ? input.experienceTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

  const role = typeof input.role === "string" && input.role.trim() ? input.role.trim() : "HR Agent";
  const location = typeof input.location === "string" && input.location.trim() ? input.location.trim() : "Unknown";
  const summary = typeof input.summary === "string" && input.summary.trim() ? input.summary.trim() : "No summary yet.";
  const phoneCountryCode =
    typeof input.phoneCountryCode === "string" ? normalizeCountryCode(input.phoneCountryCode) : "";
  const phone = typeof input.phone === "string" ? normalizePhone(input.phone) : "";

  const rating = typeof input.rating === "number" ? input.rating : undefined;
  const notes = typeof input.notes === "string" ? input.notes : "";
  const countryRegion =
    (typeof input.countryRegion === "string" && input.countryRegion.trim()) || location || "unknown";
  const experience =
    rating && rating >= 1 && rating <= 5
      ? {
          rating,
          notes,
          tags: experienceTags.length ? experienceTags : tags,
          countryRegion,
          ghosted: false,
          fakeJob: false,
          noResponse: false,
          createdAt,
        }
      : undefined;

  try {
    const existingId = await findAgentIdByLinkedin(linkedin);
    if (existingId) {
      const profile = await getAgentProfile(existingId);
      let responseTags = tags;
      let responsePhone = phone;
      let responsePhoneCountryCode = phoneCountryCode;
      if (profile) {
        const mergedTags = Array.from(new Set([...(profile.tags ?? []), ...tags]));
        responseTags = mergedTags;
        responsePhone = phone || profile.phone;
        responsePhoneCountryCode = phoneCountryCode || profile.phoneCountryCode || "+1";
        await putAgentProfile({
          ...profile,
          name,
          role,
          location,
          linkedin,
          phoneCountryCode: responsePhoneCountryCode,
          phone: responsePhone,
          summary,
          tags: mergedTags,
          createdAt,
        });
      }

      if (experience) {
        await addExperience(existingId, experience);
      }

      return NextResponse.json(
        {
          agent: {
            id: existingId,
            name,
            role,
            location,
            linkedin,
            phoneCountryCode: responsePhoneCountryCode || "+1",
            phone: responsePhone,
            summary,
            tags: responseTags,
            createdAt,
          },
          experience,
        },
        { status: 200 }
      );
    }

    const resolvedPhoneCountryCode = phoneCountryCode || "+1";
    const res = await createAgentWithInitialExperience({
      agent: { id, name, role, location, linkedin, phoneCountryCode: resolvedPhoneCountryCode, phone, summary, tags, createdAt },
      experience,
    });

    return NextResponse.json(
      {
        agent: {
          id,
          name,
          role,
          location,
          linkedin,
          phoneCountryCode: resolvedPhoneCountryCode,
          phone,
          summary,
          tags,
          createdAt: res.createdAt,
        },
        experience: res.experience,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonError(503, message);
  }
}
