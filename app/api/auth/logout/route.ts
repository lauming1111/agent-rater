import { NextResponse } from "next/server";

import { clearSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true }, { status: 200 });
  const cleared = clearSessionCookie();
  res.cookies.set(cleared.name, cleared.value, cleared.options);
  return res;
}

