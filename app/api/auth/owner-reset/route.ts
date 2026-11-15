import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, readBody } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { checkLockout, clearAllFailuresFor, LOCKED_MESSAGE, recordFailure } from "@/lib/login-guard";
import { hashPassword, safeEqual } from "@/lib/passwords";
import { clientIp } from "@/lib/request";
import { OWNER_ROLE } from "@/lib/roles";
import { ownerResetSchema } from "@/lib/validation";

/**
 * Recovery when the Owner forgets their password and there is no email service.
 * Only someone who can read the server settings (OWNER_SETUP_SECRET) can do this.
 */
export async function POST(request: NextRequest) {
  const body = await readBody(request, ownerResetSchema);
  if ("response" in body) return body.response;
  const { setupSecret, newPassword } = body.data;
  const ip = clientIp(request);

  if (await checkLockout("OWNER_RESET", "owner-reset", ip)) return jsonError(LOCKED_MESSAGE, 429);
  const expected = process.env.OWNER_SETUP_SECRET;
  if (!expected || !safeEqual(setupSecret, expected)) {
    await recordFailure("OWNER_RESET", "owner-reset", ip);
    return jsonError("The setup key is incorrect. Check OWNER_SETUP_SECRET in your server settings.", 403);
  }

  const owner = await prisma.user.findFirst({ where: { role: { name: OWNER_ROLE } }, orderBy: { createdAt: "asc" }, select: { id: true, email: true, organizationId: true } });
  if (!owner) return jsonError("No Owner account exists yet. Complete the initial setup first.", 409);

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: owner.id },
      data: { passwordHash, passwordChangedAt: new Date(), sessionVersion: { increment: 1 }, status: "ACTIVE" },
    });
    await writeAudit(tx, {
      organizationId: owner.organizationId, actorUserId: null, action: "OWNER_PASSWORD_RESET_WITH_SETUP_KEY", entityType: "User", entityId: owner.id, request,
    });
  });
  await clearAllFailuresFor(owner.email);
  return NextResponse.json({ ok: true, email: owner.email });
}
