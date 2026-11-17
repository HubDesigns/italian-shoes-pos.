import { NextResponse } from "next/server";
import { endSession } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  endSession(response);
  return response;
}
