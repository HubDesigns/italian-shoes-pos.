import { prisma } from "@/lib/prisma";
import { isLockedOut, WINDOW_MINUTES, type GuardScope } from "@/lib/lockout-rules";

/* -------------------------------------------------------------------------
 * Lockout for guessing attacks.
 *
 * Failures are counted per (account, IP address), so someone guessing from one
 * place cannot lock the real owner out from another place. A second, higher
 * limit per IP address alone stops one machine trying many different accounts.
 * ----------------------------------------------------------------------- */

export { LOCKED_MESSAGE, WINDOW_MINUTES, LIMITS, isLockedOut, type GuardScope } from "@/lib/lockout-rules";

function since() {
  return new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
}

export async function checkLockout(scope: GuardScope, identifier: string, ipAddress: string) {
  const windowStart = since();
  const [account, ip] = await Promise.all([
    prisma.loginAttempt.count({ where: { scope, identifier, ipAddress, createdAt: { gt: windowStart } } }),
    prisma.loginAttempt.count({ where: { scope, ipAddress, createdAt: { gt: windowStart } } }),
  ]);
  return isLockedOut(scope, { account, ip });
}

export async function recordFailure(scope: GuardScope, identifier: string, ipAddress: string) {
  await prisma.loginAttempt.create({ data: { scope, identifier, ipAddress } });
}

/** After a success, the failures for that account from that address no longer count. Also prunes old rows. */
export async function clearFailures(scope: GuardScope, identifier: string, ipAddress: string) {
  await prisma.loginAttempt.deleteMany({ where: { scope, identifier, ipAddress } });
  if (Math.random() < 0.05) {
    await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } });
  }
}

/** The Owner resetting someone's password also lifts any lockout on that account, from every address. */
export async function clearAllFailuresFor(identifier: string) {
  await prisma.loginAttempt.deleteMany({ where: { identifier } });
}
