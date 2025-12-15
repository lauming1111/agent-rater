import { NextResponse } from "next/server";

import { clearStateCookie, createSessionCookie, readStateCookie } from "@/lib/auth";
import { resolveLinkedinRedirectUri } from "@/lib/linkedin-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AuthDebugMode = "off" | "safe" | "full";

function getAuthDebugMode(): AuthDebugMode {
  const value = process.env.AUTH_DEBUG?.trim().toLowerCase();
  if (!value) return "off";
  if (value === "full") return "full";
  if (value === "1" || value === "true" || value === "yes") return "safe";
  return "off";
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

async function exchangeCodeForToken(code: string, redirectUri: string) {
  const clientId = requiredEnv("LINKEDIN_CLIENT_ID");
  const clientSecret = requiredEnv("LINKEDIN_CLIENT_SECRET");

  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("redirect_uri", redirectUri);
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);

  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    let details = "";
    try {
      details = await res.text();
    } catch {}
    throw new Error(
      `LinkedIn token exchange failed (${res.status})${details ? `: ${details.slice(0, 300)}` : ""}`
    );
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data?.access_token) throw new Error("LinkedIn token exchange missing access_token");
  return data.access_token;
}

async function fetchProfile(accessToken: string) {
  const res = await fetch("https://api.linkedin.com/v2/me", {
    headers: {
      authorization: `Bearer ${accessToken}`,
      "x-restli-protocol-version": "2.0.0",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`LinkedIn profile fetch failed (${res.status})`);
  const data = (await res.json()) as { id?: string } & Record<string, unknown>;
  if (getAuthDebugMode() === "full") console.info("[auth/linkedin/callback] legacy_me_raw", data);
  if (!data?.id) throw new Error("LinkedIn profile missing id");
  return { id: data.id };
}

async function fetchOpenIdUserInfo(accessToken: string) {
  const res = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    sub?: string;
    email?: string;
    name?: string;
    picture?: string;
  } & Record<string, unknown>;
  const debugMode = getAuthDebugMode();
  if (debugMode === "safe") {
    console.info("[auth/linkedin/callback] userinfo", {
      ok: true,
      keys: Object.keys(data ?? {}),
      hasEmail: typeof data?.email === "string",
      hasName: typeof data?.name === "string",
      hasPicture: typeof data?.picture === "string",
    });
  }
  if (debugMode === "full") console.info("[auth/linkedin/callback] userinfo_raw", data);
  if (!data?.sub) return null;
  return {
    sub: data.sub,
    email: typeof data.email === "string" ? data.email : undefined,
    name: typeof data.name === "string" ? data.name : undefined,
    picture: typeof data.picture === "string" ? data.picture : undefined,
  };
}

async function fetchEmail(accessToken: string) {
  const url =
    "https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))";
  const res = await fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      "x-restli-protocol-version": "2.0.0",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    elements?: Array<{ "handle~"?: { emailAddress?: string } }>;
  } & Record<string, unknown>;
  if (getAuthDebugMode() === "full") console.info("[auth/linkedin/callback] legacy_email_raw", data);
  const email = data?.elements?.[0]?.["handle~"]?.emailAddress;
  return typeof email === "string" ? email : null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") || "";
  const returnedState = url.searchParams.get("state") || "";

  const expectedState = readStateCookie(req) || "";
  const clearedState = clearStateCookie();
  const redirectUri = resolveLinkedinRedirectUri(req);

  const redirectTo = new URL("/", new URL(redirectUri).origin);
  if (!code || !returnedState || !expectedState || returnedState !== expectedState) {
    if (getAuthDebugMode() !== "off") {
      console.info("[auth/linkedin/callback] state_mismatch", {
        hasCode: Boolean(code),
        returnedStateLen: returnedState.length,
        expectedStateLen: expectedState.length,
      });
    }
    redirectTo.searchParams.set("authError", "state_mismatch");
    const res = NextResponse.redirect(redirectTo);
    res.cookies.set(clearedState.name, clearedState.value, clearedState.options);
    return res;
  }

  try {
    const accessToken = await exchangeCodeForToken(code, redirectUri);
    const userInfo = await fetchOpenIdUserInfo(accessToken);
    const profile = userInfo ? { id: userInfo.sub } : await fetchProfile(accessToken);
    const email = userInfo?.email ?? (await fetchEmail(accessToken));
    const name = userInfo?.name;
    const picture = userInfo?.picture && userInfo.picture.length <= 1024 ? userInfo.picture : undefined;

    const maxAgeSeconds = 7 * 24 * 60 * 60;
    const exp = Math.floor(Date.now() / 1000) + maxAgeSeconds;
    const sessionCookie = createSessionCookie(
      { sub: profile.id, email: email ?? undefined, name, picture, exp },
      maxAgeSeconds
    );

    if (getAuthDebugMode() !== "off") {
      console.info("[auth/linkedin/callback] session_created", {
        id: profile.id,
        email: email ?? null,
        name: name ?? null,
        hasPicture: Boolean(picture),
      });
    }

    const res = NextResponse.redirect(redirectTo);
    res.cookies.set(clearedState.name, clearedState.value, clearedState.options);
    res.cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.options);
    return res;
  } catch (err) {
    console.error("[auth/linkedin/callback] failed", err);
    redirectTo.searchParams.set("authError", "oauth_failed");
    const res = NextResponse.redirect(redirectTo);
    res.cookies.set(clearedState.name, clearedState.value, clearedState.options);
    return res;
  }
}
