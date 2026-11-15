import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, startSession } from "@/lib/auth";
import { jsonError, readBody } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { checkLockout, clearFailures, LOCKED_MESSAGE, recordFailure } from "@/lib/login-guard";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { clientIp } from "@/lib/request";
import { changePasswordSchema, passwordProblem } from "@/lib/validation";

/** Any signed-in person changes their own password. Their other sessions end; this one stays signed in. */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Please sign in.", 401);

  const body = await readBody(request, changePasswordSchema);
  if ("response" in body) return body.response;
  const { currentPassword, newPassword } = body.data;
  const ip = clientIp(request);

  if (await checkLockout("PASSWORD_CHANGE", user.email, ip)) return jsonError(LOCKED_MESSAGE, 429);

  const record = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(currentPassword, record?.passwordHash))) {
    await recordFailure("PASSWORD_CHANGE", user.email, ip);
    return jsonError("Your current password is incorrect.", 400);
  }

  const problem = passwordProblem(newPassword, { email: user.email, name: user.name });
  if (problem) return jsonError(problem, 400);
  if (newPassword === currentPassword) return jsonError("Choose a new password that is different from the current one.", 400);

  const passwordHash = await hashPassword(newPassword);
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordChangedAt: new Date(), sessionVersion: { increment: 1 } },
      select: { id: true, sessionVersion: true },
    });
    await writeAudit(tx, { organizationId: user.organizationId, actorUserId: user.id, action: "PASSWORD_CHANGED", entityType: "User", entityId: user.id, request });
    return result;
  });
  await clearFailures("PASSWORD_CHANGE", user.email, ip);

  const response = NextResponse.json({ ok: true });
  await startSession(response, updated);
  return response;
}
