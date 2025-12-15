import crypto from "crypto";
import { NextResponse } from "next/server";

import { createStateCookie } from "@/lib/auth";
import { resolveLinkedinRedirectUri } from "@/lib/linkedin-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function getLinkedinScopes() {
  const configured = process.env.LINKEDIN_SCOPES?.trim();
  return configured ? configured : ["openid", "profile", "email"].join(" ");
}

export async function GET(req: Request) {
  const clientId = requiredEnv("LINKEDIN_CLIENT_ID");
  const redirectUri = resolveLinkedinRedirectUri(req);

  const state = crypto.randomBytes(24).toString("hex");
  const scope = getLinkedinScopes();

  const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", scope);

  const res = NextResponse.redirect(authUrl.toString());
  const cookie = createStateCookie(state);
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  return res;
}
