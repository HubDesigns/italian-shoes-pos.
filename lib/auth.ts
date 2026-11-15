import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "italian_shoes_session";
const SESSION_SECONDS = 60 * 60 * 12;

function authKey() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET must be configured with at least 32 characters.");
  return new TextEncoder().encode(value);
}

/** The token carries the user's session version, so changing a password or suspending an account ends old sessions. */
export async function createSessionToken(userId: string, sessionVersion: number) {
  return new SignJWT({ sub: userId, sv: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(authKey());
}

export function sessionCookieName() {
  return COOKIE_NAME;
}

/** Signs the user in by setting the session cookie on a response. */
export async function startSession(response: NextResponse, user: { id: string; sessionVersion: number }) {
  response.cookies.set(COOKIE_NAME, await createSessionToken(user.id, user.sessionVersion), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_SECONDS,
  });
}

export function endSession(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}

export async function getCurrentUser() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authKey());
    if (typeof payload.sub !== "string" || typeof payload.sv !== "number") return null;
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true, organizationId: true, name: true, email: true, status: true, sessionVersion: true,
        role: {
          select: {
            id: true, name: true,
            permissions: { select: { permission: { select: { key: true } } } },
          },
        },
        branchAssignments: { select: { branchId: true, isPrimary: true } },
      },
    });
    if (!user || user.status !== "ACTIVE") return null;
    return user;
  } catch {
    return null;
  }
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** The Owner always passes; everyone else needs the permission granted to their role. */
export function hasPermission(user: CurrentUser, key: string) {
  return user.role.name === "OWNER" || user.role.permissions.some((item) => item.permission.key === key);
}

export async function isOwner() {
  const user = await getCurrentUser();
  return user?.role.name === "OWNER";
}
