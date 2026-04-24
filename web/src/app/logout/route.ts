import { NextResponse } from "next/server";
import { clearSessionCookie, deleteSession, getAuth } from "@/lib/auth/session";

export async function POST() {
  const auth = await getAuth();
  if (auth) {
    await deleteSession(auth.session.id);
  }
  await clearSessionCookie();
  return NextResponse.redirect(new URL("/login", process.env.APP_URL ?? "http://localhost:3000"));
}
