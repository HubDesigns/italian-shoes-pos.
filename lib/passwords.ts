import bcrypt from "bcryptjs";
import { createHash, timingSafeEqual } from "node:crypto";

const COST = 12;

export function hashPassword(password: string) {
  return bcrypt.hash(password, COST);
}

let dummyHash: Promise<string> | null = null;

/**
 * Checks a password. When the account does not exist we still run a full comparison,
 * so response time does not reveal which email addresses are registered.
 */
export async function verifyPassword(password: string, hash: string | null | undefined) {
  if (hash) return bcrypt.compare(password, hash);
  dummyHash ??= bcrypt.hash("not-a-real-password", COST);
  await bcrypt.compare(password, await dummyHash);
  return false;
}

/** Constant-time comparison for secrets such as the setup key. */
export function safeEqual(a: string, b: string) {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}
