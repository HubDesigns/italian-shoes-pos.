import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeOwner, jsonError, readBody } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { clearAllFailuresFor } from "@/lib/login-guard";
import { hashPassword } from "@/lib/passwords";
import { OWNER_ROLE } from "@/lib/roles";
import { resetPasswordSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

/**
 * The Owner sets a new password for a staff member (for example after they forget it).
 * Every session the person had open stops working, and any sign-in lockout on the account is lifted.
 */
export async function POST(request: NextRequest, context: Context) {
  const auth = await authorizeOwner();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await context.params;

  const body = await readBody(request, resetPasswordSchema);
  if ("response" in body) return body.response;

  if (id === user.id) return jsonError("Use My account to change your own password.", 400);
  const member = await prisma.user.findFirst({ where: { id, organizationId: user.organizationId }, select: { id: true, email: true, role: { select: { name: true } } } });
  if (!member || member.role.name === OWNER_ROLE) return jsonError("Staff member not found.", 404);

  const passwordHash = await hashPassword(body.data.newPassword);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { passwordHash, passwordChangedAt: new Date(), sessionVersion: { increment: 1 } } });
    await writeAudit(tx, { organizationId: user.organizationId, actorUserId: user.id, action: "STAFF_PASSWORD_RESET", entityType: "User", entityId: id, request });
  });
  await clearAllFailuresFor(member.email);
  return NextResponse.json({ ok: true });
}
