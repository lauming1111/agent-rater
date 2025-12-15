import "server-only";

import crypto from "crypto";

const SESSION_COOKIE = "ar_session";
const STATE_COOKIE = "ar_linkedin_state";

export type AuthUser = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  exp: number;
};

function base64url(input: Buffer | string) {
  const buffer = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buffer
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlToBuffer(input: string) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Missing env var: AUTH_SECRET");
  return secret;
}

function sign(payloadB64: string) {
  const secret = getAuthSecret();
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payloadB64);
  return base64url(hmac.digest());
}

export function createSessionCookie(value: AuthUser, maxAgeSeconds: number) {
  const payloadJson = JSON.stringify(value);
  const payloadB64 = base64url(payloadJson);
  const sig = sign(payloadB64);
  return {
    name: SESSION_COOKIE,
    value: `${payloadB64}.${sig}`,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: maxAgeSeconds,
    },
  };
}

export function clearSessionCookie() {
  return {
    name: SESSION_COOKIE,
    value: "",
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    },
  };
}

export function readSessionCookie(req: Request): AuthUser | null {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;

  const token = match[1] ?? "";
  const [payloadB64, sig] = token.split(".", 2);
  if (!payloadB64 || !sig) return null;

  let expectedSig = "";
  try {
    expectedSig = sign(payloadB64);
  } catch {
    return null;
  }
  const sigBuf = base64urlToBuffer(sig);
  const expectedBuf = base64urlToBuffer(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const payloadJson = base64urlToBuffer(payloadB64).toString("utf8");
    const parsed = JSON.parse(payloadJson) as Partial<AuthUser>;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.sub !== "string" || !parsed.sub) return null;
    if (typeof parsed.exp !== "number" || !Number.isFinite(parsed.exp)) return null;
    if (parsed.exp * 1000 < Date.now()) return null;
    const email = typeof parsed.email === "string" ? parsed.email : undefined;
    const name = typeof parsed.name === "string" ? parsed.name : undefined;
    const picture = typeof parsed.picture === "string" ? parsed.picture : undefined;
    return { sub: parsed.sub, email, name, picture, exp: parsed.exp };
  } catch {
    return null;
  }
}

export function requireAuth(req: Request): AuthUser {
  const session = readSessionCookie(req);
  if (!session) throw new Error("unauthorized");
  return session;
}

export function createStateCookie(state: string) {
  return {
    name: STATE_COOKIE,
    value: state,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 10 * 60,
    },
  };
}

export function clearStateCookie() {
  return {
    name: STATE_COOKIE,
    value: "",
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    },
  };
}

export function readStateCookie(req: Request) {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${STATE_COOKIE}=([^;]+)`));
  return match?.[1] ?? null;
}
