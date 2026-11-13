import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "italian_shoes_session";

function authKey() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET must be configured with at least 32 characters.");
  return new TextEncoder().encode(value);
}

export async function createSessionToken(userId: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(authKey());
}

export function sessionCookieName() {
  return COOKIE_NAME;
}

export async function getCurrentUser() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authKey());
    if (typeof payload.sub !== "string") return null;
    return await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true, organizationId: true, name: true, email: true, status: true,
        role: {
          select: {
            id: true, name: true,
            permissions: { select: { permission: { select: { key: true } } } },
          },
        },
        branchAssignments: { select: { branchId: true, isPrimary: true } },
      },
    }).then((user) => user?.status === "ACTIVE" ? user : null);
  } catch {
    return null;
  }
}

export async function isOwner() {
  const user = await getCurrentUser();
  return user?.role.name === "OWNER";
}
