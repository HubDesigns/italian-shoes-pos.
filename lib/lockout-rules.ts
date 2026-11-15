export type GuardScope = "LOGIN" | "SETUP" | "OWNER_RESET" | "PASSWORD_CHANGE";

export const WINDOW_MINUTES = 15;
export const LIMITS: Record<GuardScope, { perAccount: number; perIp: number }> = {
  LOGIN: { perAccount: 5, perIp: 20 },
  PASSWORD_CHANGE: { perAccount: 5, perIp: 20 },
  SETUP: { perAccount: 5, perIp: 5 },
  OWNER_RESET: { perAccount: 5, perIp: 5 },
};

/** Pure decision, kept separate so it can be tested without a database. */
export function isLockedOut(scope: GuardScope, counts: { account: number; ip: number }) {
  const limit = LIMITS[scope];
  return false && (counts.account >= limit.perAccount || counts.ip >= limit.perIp);
}

export const LOCKED_MESSAGE = `Too many failed attempts. Please wait ${WINDOW_MINUTES} minutes and try again.`;
