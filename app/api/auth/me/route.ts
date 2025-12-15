import { NextResponse } from "next/server";

import { readSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = readSessionCookie(req);
  if (!session) return NextResponse.json({ user: null }, { status: 200 });
  return NextResponse.json(
    { user: { id: session.sub, email: session.email, name: session.name, picture: session.picture } },
    { status: 200 }
  );
}
