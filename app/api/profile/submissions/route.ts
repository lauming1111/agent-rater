import { NextResponse } from "next/server";

import { deleteExperienceItem, getAgentProfile, getExperienceItem, listExperiencesByUser, putAgentProfile, putExperienceItem } from "@/lib/agents";
import { requireAuth } from "@/lib/auth";
import { validateAndNormalizePhone } from "@/lib/phone";

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

function normalizeCountryCode(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 3);
  return digits ? `+${digits}` : "";
}

export async function GET(req: Request) {
  let session;
  try {
    session = requireAuth(req);
  } catch {
    return jsonError(401, "Please sign in with LinkedIn.");
  }

  try {
    const experiences = await listExperiencesByUser(session.sub, 50);

    const profileCache = new Map<string, Awaited<ReturnType<typeof getAgentProfile>>>();
    const submissions = await Promise.all(
      experiences.map(async (exp) => {
        if (!profileCache.has(exp.agentId)) {
          profileCache.set(exp.agentId, await getAgentProfile(exp.agentId));
        }
        const profile = profileCache.get(exp.agentId);
        return {
          agentId: exp.agentId,
          createdAt: exp.createdAt,
          rating: exp.rating,
          notes: exp.notes,
          countryRegion: exp.countryRegion,
          quickTags: exp.tags,
          focusTags: profile?.tags ?? [],
          agent: profile
            ? {
                id: profile.id,
                name: profile.name,
                location: profile.location,
                linkedin: profile.linkedin,
                phoneCountryCode: profile.phoneCountryCode,
                phone: profile.phone,
              }
            : null,
        };
      })
    );

    return NextResponse.json({ submissions }, { status: 200 });
  } catch (err) {
    console.error("[api/profile/submissions][GET] failed", err);
    return jsonError(503, publicMessage(err));
  }
}

export async function PATCH(req: Request) {
  let session;
  try {
    session = requireAuth(req);
  } catch {
    return jsonError(401, "Please sign in with LinkedIn.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON");
  }
  if (!body || typeof body !== "object") return jsonError(400, "Invalid request body");

  const input = body as {
    agentId?: string;
    createdAt?: string;
    rating?: number;
    notes?: string;
    countryRegion?: string;
    quickTags?: string[] | string;
    agentName?: string;
    focusTags?: string[] | string;
    phoneCountryCode?: string;
    phone?: string;
  };

  const agentId = typeof input.agentId === "string" ? input.agentId : "";
  const createdAt = typeof input.createdAt === "string" ? input.createdAt : "";
  const rating = typeof input.rating === "number" ? input.rating : NaN;
  const notes = typeof input.notes === "string" ? input.notes : "";
  const countryRegion = typeof input.countryRegion === "string" ? input.countryRegion.trim() : "";
  const quickTags =
    Array.isArray(input.quickTags)
      ? input.quickTags.filter((t) => typeof t === "string").map((t) => t.trim()).filter(Boolean)
      : typeof input.quickTags === "string"
        ? input.quickTags.split(",").map((t) => t.trim()).filter(Boolean)
        : undefined;
  const agentName = typeof input.agentName === "string" ? input.agentName.trim() : "";
  const focusTags =
    Array.isArray(input.focusTags)
      ? input.focusTags.filter((t) => typeof t === "string").map((t) => t.trim()).filter(Boolean)
      : typeof input.focusTags === "string"
        ? input.focusTags.split(",").map((t) => t.trim()).filter(Boolean)
        : undefined;
  const hasPhoneCountryCode = Object.prototype.hasOwnProperty.call(input, "phoneCountryCode");
  const hasPhone = Object.prototype.hasOwnProperty.call(input, "phone");
  const phoneCountryCodeRaw = hasPhoneCountryCode ? String(input.phoneCountryCode ?? "") : "";
  const phoneRaw = hasPhone ? String(input.phone ?? "") : "";
  const phoneCountryCode = hasPhoneCountryCode ? normalizeCountryCode(phoneCountryCodeRaw) : undefined;
  let phone = hasPhone ? phoneRaw.trim() : undefined;
  if (hasPhone && phoneRaw.trim()) {
    const validated = validateAndNormalizePhone(phoneCountryCodeRaw, phoneRaw);
    if (!validated) return jsonError(400, "Invalid mobile phone for country code.");
    phone = validated.phone;
  } else if (hasPhone) {
    phone = "";
  }
  if (hasPhoneCountryCode && phoneCountryCodeRaw.trim() && !phoneCountryCode) {
    return jsonError(400, "Mobile phone country code is invalid.");
  }

  if (!agentId) return jsonError(400, "Missing agentId");
  if (!createdAt) return jsonError(400, "Missing createdAt");
  if (!(rating >= 1 && rating <= 5)) return jsonError(400, "rating must be 1..5");

  try {
    const existing = await getExperienceItem(agentId, createdAt);
    if (!existing) return jsonError(404, "Submission not found");
    if (String(existing.createdBySub ?? "") !== session.sub) return jsonError(403, "Forbidden");

    const next: Record<string, unknown> = {
      ...existing,
      rating,
      notes,
      countryRegion: countryRegion || String(existing.countryRegion ?? "unknown"),
      ...(quickTags ? { tags: quickTags } : null),
      updatedAt: new Date().toISOString(),
    };

    delete next.PK;
    delete next.SK;

    if ((focusTags && focusTags.length) || agentName || hasPhoneCountryCode || hasPhone) {
      const profile = await getAgentProfile(agentId);
      if (profile) {
        const mergedTags = focusTags && focusTags.length ? Array.from(new Set([...(profile.tags ?? []), ...focusTags])) : profile.tags ?? [];
        const normalizedName = agentName
          .trim()
          .replace(/\s+/g, " ")
          .toLowerCase();
        const nextName = normalizedName || profile.name;
        const nextPhoneCountryCode =
          typeof phoneCountryCode === "string"
            ? phoneCountryCode
            : typeof phone === "string" && phone
              ? profile.phoneCountryCode || "+1"
              : profile.phoneCountryCode;
        const nextPhone = typeof phone === "string" ? phone : profile.phone;
        await putAgentProfile({
          ...profile,
          name: nextName,
          tags: mergedTags,
          phoneCountryCode: nextPhoneCountryCode,
          phone: nextPhone,
        });
      }
    }

    await putExperienceItem(agentId, createdAt, next);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[api/profile/submissions][PATCH] failed", err);
    return jsonError(503, publicMessage(err));
  }
}

export async function DELETE(req: Request) {
  let session;
  try {
    session = requireAuth(req);
  } catch {
    return jsonError(401, "Please sign in with LinkedIn.");
  }

  const url = new URL(req.url);
  const agentId = url.searchParams.get("agentId") || "";
  const createdAt = url.searchParams.get("createdAt") || "";
  if (!agentId) return jsonError(400, "Missing agentId");
  if (!createdAt) return jsonError(400, "Missing createdAt");

  try {
    const existing = await getExperienceItem(agentId, createdAt);
    if (!existing) return jsonError(404, "Submission not found");
    if (String(existing.createdBySub ?? "") !== session.sub) return jsonError(403, "Forbidden");

    await deleteExperienceItem(agentId, createdAt);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[api/profile/submissions][DELETE] failed", err);
    return jsonError(503, publicMessage(err));
  }
}
