import { NextResponse } from "next/server";

import {
  addExperience,
  createAgentWithInitialExperience,
  getAgentProfile,
  listAgentsWithExperiences,
  putAgentProfile,
} from "@/lib/agents";
import { requireAuth } from "@/lib/auth";
import { validateAndNormalizePhone } from "@/lib/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function idFromName(name: string) {
  return `name#${name}`;
}

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

function publicMessage(err: unknown) {
  if (process.env.NODE_ENV !== "production") {
    return err instanceof Error ? err.message : "Unknown error";
  }
  return "Service unavailable";
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
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
    console.error("[api/agents][GET] failed", err);
    return jsonError(503, publicMessage(err));
  }
}

export async function POST(req: Request) {
  let session;
  try {
    session = requireAuth(req);
  } catch {
    return jsonError(401, "Please sign in with LinkedIn to submit.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON");
  }

  if (!body || typeof body !== "object") return jsonError(400, "Invalid request body");

  const input = body as {
    name?: string;
    location?: string;
    linkedin?: string;
    phoneCountryCode?: string;
    phone?: string;
    tags?: string[] | string;
    rating?: number;
    notes?: string;
    experienceTags?: string[] | string;
    countryRegion?: string;
    createdAt?: string;
  };

  const normalizeLinkedin = (value: string) => value.trim().toLowerCase().replace(/\/+$/, "");

  const name = typeof input.name === "string" ? normalizeName(input.name) : "";
  if (!name) return jsonError(400, "Missing name");

  const linkedinRaw = typeof input.linkedin === "string" ? input.linkedin.trim() : "";
  const linkedin = linkedinRaw ? normalizeLinkedin(linkedinRaw) : "";
  const id = idFromName(name);

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

  const locationInput = typeof input.location === "string" ? input.location.trim() : "";
  const location = locationInput || "Unknown";
  const phoneCountryCode =
    typeof input.phoneCountryCode === "string" ? normalizeCountryCode(input.phoneCountryCode) : "";
  const phoneRaw = typeof input.phone === "string" ? input.phone : "";
  let phone = typeof input.phone === "string" ? input.phone.trim() : "";
  if (phoneRaw.trim()) {
    const validated = validateAndNormalizePhone(phoneCountryCode, phoneRaw);
    if (!validated) return jsonError(400, "Invalid mobile phone for country code.");
    phone = validated.phone;
  } else {
    phone = "";
  }
  if (typeof input.phoneCountryCode === "string" && input.phoneCountryCode.trim() && !phoneCountryCode) {
    return jsonError(400, "Mobile phone country code is invalid.");
  }

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
          createdBySub: session.sub,
          createdByEmail: session.email,
          createdAt,
        }
      : undefined;

  try {
    const resolvedPhoneCountryCode = phoneCountryCode || "+1";

    const profile = await getAgentProfile(id);
    if (profile) {
      const mergedTags = Array.from(new Set([...(profile.tags ?? []), ...tags]));
      const resolvedPhone = phone || profile.phone;
      const resolvedLinkedin = linkedin || profile.linkedin || "";
      const resolvedLocation = locationInput || profile.location || location;
      const resolvedPhoneCountryCodeValue = phone ? resolvedPhoneCountryCode : profile.phoneCountryCode || "+1";

      await putAgentProfile({
        ...profile,
        name,
        location: resolvedLocation,
        linkedin: resolvedLinkedin,
        phoneCountryCode: resolvedPhoneCountryCodeValue,
        phone: resolvedPhone,
        tags: mergedTags,
        createdAt,
      });

      if (experience) await addExperience(id, experience);

      return NextResponse.json(
        {
          agent: {
            id,
            name,
            role: profile.role,
            location: resolvedLocation,
            linkedin: resolvedLinkedin,
            phoneCountryCode: resolvedPhoneCountryCodeValue,
            phone: resolvedPhone,
            summary: experience?.notes ?? notes,
            tags: mergedTags,
            createdAt,
          },
          experience,
        },
        { status: 200 }
      );
    }

    const res = await createAgentWithInitialExperience({
      agent: {
        id,
        name,
        role: "HR Agent",
        location,
        linkedin,
        phoneCountryCode: resolvedPhoneCountryCode,
        phone,
        tags,
        createdAt,
      },
      experience,
    });

    return NextResponse.json(
      {
        agent: {
          id,
          name,
          role: "HR Agent",
          location,
          linkedin,
          phoneCountryCode: resolvedPhoneCountryCode,
          phone,
          summary: experience?.notes ?? notes,
          tags,
          createdAt: res.createdAt,
        },
        experience: res.experience,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[api/agents][POST] failed", { agentId: id }, err);
    return jsonError(503, publicMessage(err));
  }
}
