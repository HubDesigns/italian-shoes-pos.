import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startSession } from "@/lib/auth";
import { jsonError, readBody } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { checkLockout, clearFailures, LOCKED_MESSAGE, recordFailure } from "@/lib/login-guard";
import { verifyPassword } from "@/lib/passwords";
import { clientIp } from "@/lib/request";
import { loginSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const body = await readBody(request, loginSchema);
  if ("response" in body) return body.response;
  const { email, password } = body.data;
  const ip = clientIp(request);

  if (await checkLockout("LOGIN", email, ip)) {
    const response = jsonError(LOCKED_MESSAGE, 429);
    response.headers.set("Retry-After", "900");
    return response;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, organizationId: true, passwordHash: true, status: true, sessionVersion: true },
  });
  const passwordOk = await verifyPassword(password, user?.passwordHash);

  if (!user || !passwordOk) {
    await recordFailure("LOGIN", email, ip);
    if (user) {
      await prisma.$transaction((tx) => writeAudit(tx, {
        organizationId: user.organizationId, actorUserId: null, action: "LOGIN_FAILED", entityType: "User", entityId: user.id, request,
      }));
    }
    return jsonError("Email or password is incorrect.", 401);
  }

  // The password was right, so telling the person their account is suspended reveals nothing to a guesser.
  if (user.status !== "ACTIVE") {
    await prisma.$transaction((tx) => writeAudit(tx, {
      organizationId: user.organizationId, actorUserId: null, action: "LOGIN_BLOCKED_SUSPENDED", entityType: "User", entityId: user.id, request,
    }));
    return jsonError("This account is not active. Please contact the Owner.", 403);
  }

  await clearFailures("LOGIN", email, ip);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await writeAudit(tx, { organizationId: user.organizationId, actorUserId: user.id, action: "LOGIN_SUCCESS", entityType: "User", entityId: user.id, request });
  });
  const response = NextResponse.json({ ok: true });
  await startSession(response, user);
  return response;
}
