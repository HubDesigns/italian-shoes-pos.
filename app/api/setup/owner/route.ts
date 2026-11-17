import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startSession } from "@/lib/auth";
import { isUniqueViolation, jsonError, readBody } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { checkLockout, LOCKED_MESSAGE, recordFailure } from "@/lib/login-guard";
import { hashPassword, safeEqual } from "@/lib/passwords";
import { clientIp } from "@/lib/request";
import { ensureSystemRoles, OWNER_ROLE } from "@/lib/roles";
import { setupSchema } from "@/lib/validation";

/** One-time creation of the business and its Owner. Needs the setup key from the server settings. */
export async function POST(request: NextRequest) {
  const body = await readBody(request, setupSchema);
  if ("response" in body) return body.response;
  const { setupSecret, name, email, password, organizationName } = body.data;
  const ip = clientIp(request);

  if (await checkLockout("SETUP", "setup", ip)) return jsonError(LOCKED_MESSAGE, 429);
  const expected = process.env.OWNER_SETUP_SECRET;
  if (!expected || !safeEqual(setupSecret, expected)) {
    await recordFailure("SETUP", "setup", ip);
    return jsonError("The setup key is incorrect. Check OWNER_SETUP_SECRET in your server settings.", 403);
  }

  try {
    const passwordHash = await hashPassword(password);
    const owner = await prisma.$transaction(async (tx) => {
      if (await tx.user.count() > 0) throw new Error("SETUP_ALREADY_COMPLETED");
      const organization = await tx.organization.create({ data: { name: organizationName } });
      await ensureSystemRoles(tx, organization.id);
      const ownerRole = await tx.role.findFirstOrThrow({ where: { organizationId: organization.id, name: OWNER_ROLE }, select: { id: true } });
      const created = await tx.user.create({
        data: { organizationId: organization.id, roleId: ownerRole.id, name, email, passwordHash, status: "ACTIVE", passwordChangedAt: new Date() },
        select: { id: true, sessionVersion: true },
      });
      await writeAudit(tx, {
        organizationId: organization.id, actorUserId: created.id, action: "OWNER_SETUP_COMPLETED", entityType: "User", entityId: created.id,
        newData: { organizationName, email }, request,
      });
      return created;
    }, { maxWait: 10000, timeout: 30000 });

    const response = NextResponse.json({ ok: true });
    await startSession(response, owner);
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "SETUP_ALREADY_COMPLETED") {
      return jsonError("Initial setup has already been completed. Please sign in.", 409);
    }
    if (isUniqueViolation(error)) return jsonError("Setup is already in progress or completed. Please sign in.", 409);
    throw error;
  }
}
