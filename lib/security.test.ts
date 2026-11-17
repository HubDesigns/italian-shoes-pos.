import { describe, expect, it } from "vitest";
import {
  changePasswordSchema, createStaffSchema, firstProblem, loginSchema, ownerResetSchema, passwordProblem,
  resetPasswordSchema, setupSchema, updateStaffSchema,
} from "./validation";
import { isLockedOut, LIMITS, LOCKED_MESSAGE } from "./lockout-rules";
import { OWNER_ROLE, STARTER_ROLES, SYSTEM_PERMISSIONS } from "./roles";
import { clientIp } from "./request";

const goodPassword = "Blue-Sandal-2026";

describe("passwordProblem", () => {
  it("accepts a reasonable password", () => {
    expect(passwordProblem(goodPassword)).toBeNull();
    expect(passwordProblem("correct horse battery staple")).toBeNull();
  });
  it("rejects short passwords", () => {
    expect(passwordProblem("short1")).toMatch(/at least 10/);
    expect(passwordProblem("123456789")).toMatch(/at least 10/);
  });
  it("rejects passwords bcrypt would silently cut short", () => {
    expect(passwordProblem("a1".repeat(40))).toMatch(/too long/);
    // 30 characters but 90 bytes: counted in bytes, not characters
    expect(passwordProblem("پاکستان".repeat(6))).toMatch(/too long/);
  });
  it("rejects common, repeated and sequence passwords", () => {
    expect(passwordProblem("Password123")).toMatch(/too common/);
    expect(passwordProblem("aaaaaaaaaaaa")).toMatch(/repeated/);
    expect(passwordProblem("1234567890")).toBeTruthy();
    expect(passwordProblem("italianshoes")).toMatch(/too common/);
  });
  it("rejects a password containing the email name", () => {
    expect(passwordProblem("habib-logo-2026", { email: "logodesigner636@gmail.com" })).toBeNull();
    expect(passwordProblem("xxlogodesigner636xx", { email: "logodesigner636@gmail.com" })).toMatch(/email name/);
  });
});

describe("setupSchema", () => {
  const base = { setupSecret: "key", name: "Habib Khan", email: "  Owner@Example.COM ", password: goodPassword };
  it("normalizes the email and defaults the business name", () => {
    const parsed = setupSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.email).toBe("owner@example.com");
      expect(parsed.data.organizationName).toBe("Italian Shoes");
    }
  });
  it("rejects bad emails with a clear message", () => {
    for (const email of ["", "not-an-email", "a@b", "two@@example.com", "spaces in@example.com"]) {
      const parsed = setupSchema.safeParse({ ...base, email });
      expect(parsed.success, email).toBe(false);
      if (!parsed.success) expect(firstProblem(parsed.error)).toMatch(/email/i);
    }
  });
  it("rejects weak passwords and missing fields", () => {
    const weak = setupSchema.safeParse({ ...base, password: "short" });
    expect(weak.success).toBe(false);
    if (!weak.success) expect(firstProblem(weak.error)).toMatch(/at least 10/);
    expect(setupSchema.safeParse({ ...base, name: "" }).success).toBe(false);
    expect(setupSchema.safeParse({ ...base, setupSecret: "" }).success).toBe(false);
    expect(setupSchema.safeParse({}).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("trims and lowercases the email but leaves the password untouched", () => {
    const parsed = loginSchema.safeParse({ email: " Staff@Shop.com ", password: " keep spaces " });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual({ email: "staff@shop.com", password: " keep spaces " });
  });
  it("does not apply the new-password rules to existing passwords", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });
  it("rejects empty and oversized values and wrong types", () => {
    expect(loginSchema.safeParse({ email: "", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x".repeat(2000) }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 5, password: {} }).success).toBe(false);
    expect(loginSchema.safeParse(null).success).toBe(false);
  });
});

describe("staff schemas", () => {
  const staff = { name: "Ali Raza", email: "ali@shop.com", password: goodPassword, roleId: "role1", branchIds: ["b1"] };
  it("accepts a valid staff account", () => {
    expect(createStaffSchema.safeParse(staff).success).toBe(true);
  });
  it("requires at least one branch and a strong password", () => {
    expect(createStaffSchema.safeParse({ ...staff, branchIds: [] }).success).toBe(false);
    expect(createStaffSchema.safeParse({ ...staff, password: "weakpass" }).success).toBe(false);
    expect(createStaffSchema.safeParse({ ...staff, email: "ali" }).success).toBe(false);
  });
  it("allows partial updates but not empty ones or unknown statuses", () => {
    expect(updateStaffSchema.safeParse({ status: "SUSPENDED" }).success).toBe(true);
    expect(updateStaffSchema.safeParse({ status: "ACTIVE" }).success).toBe(true);
    expect(updateStaffSchema.safeParse({ roleId: "r2" }).success).toBe(true);
    expect(updateStaffSchema.safeParse({}).success).toBe(false);
    expect(updateStaffSchema.safeParse({ status: "DELETED" }).success).toBe(false);
  });
});

describe("password change schemas", () => {
  it("enforces the rules on reset and recovery", () => {
    expect(resetPasswordSchema.safeParse({ newPassword: goodPassword }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ newPassword: "short" }).success).toBe(false);
    expect(ownerResetSchema.safeParse({ setupSecret: "k", newPassword: goodPassword }).success).toBe(true);
    expect(ownerResetSchema.safeParse({ setupSecret: "", newPassword: goodPassword }).success).toBe(false);
    expect(ownerResetSchema.safeParse({ setupSecret: "k", newPassword: "123" }).success).toBe(false);
  });
  it("requires the current password when changing your own", () => {
    expect(changePasswordSchema.safeParse({ currentPassword: "old", newPassword: goodPassword }).success).toBe(true);
    expect(changePasswordSchema.safeParse({ currentPassword: "", newPassword: goodPassword }).success).toBe(false);
  });
});

describe("lockout rules", () => {
  it("locks one account from one address after 5 failures", () => {
    expect(isLockedOut("LOGIN", { account: 4, ip: 4 })).toBe(false);
    expect(isLockedOut("LOGIN", { account: 5, ip: 5 })).toBe(true);
  });
  it("locks one address that tries many accounts", () => {
    expect(isLockedOut("LOGIN", { account: 1, ip: LIMITS.LOGIN.perIp - 1 })).toBe(false);
    expect(isLockedOut("LOGIN", { account: 1, ip: LIMITS.LOGIN.perIp })).toBe(true);
  });
  it("is stricter for guessing the setup key", () => {
    expect(isLockedOut("SETUP", { account: 5, ip: 5 })).toBe(true);
    expect(isLockedOut("OWNER_RESET", { account: 0, ip: 5 })).toBe(true);
    expect(isLockedOut("OWNER_RESET", { account: 0, ip: 4 })).toBe(false);
  });
  it("tells people how long to wait", () => {
    expect(LOCKED_MESSAGE).toMatch(/15 minutes/);
  });
});

describe("starter roles", () => {
  const known = new Set(SYSTEM_PERMISSIONS.map(([key]) => key as string));
  const ownerOnly = new Set(["branch.manage", "permissions.manage", "settings.manage"]);
  it("only use permissions that exist", () => {
    for (const role of STARTER_ROLES) for (const key of role.permissions) expect(known.has(key), `${role.name}: ${key}`).toBe(true);
  });
  it("never hand out owner-only permissions", () => {
    for (const role of STARTER_ROLES) for (const key of role.permissions) expect(ownerOnly.has(key), `${role.name}: ${key}`).toBe(false);
  });
  it("include manager, cashier and warehouse and never a second owner", () => {
    const names = STARTER_ROLES.map((role) => role.name);
    expect(names).toEqual(expect.arrayContaining(["BRANCH_MANAGER", "CASHIER", "WAREHOUSE"]));
    expect(names).not.toContain(OWNER_ROLE);
    expect(new Set(names).size).toBe(names.length);
  });
  it("lets a cashier sell but not manage stock, and a warehouse role manage stock but not sell", () => {
    const cashier = STARTER_ROLES.find((role) => role.name === "CASHIER")!.permissions;
    const warehouse = STARTER_ROLES.find((role) => role.name === "WAREHOUSE")!.permissions;
    expect(cashier).toContain("sales.create");
    expect(cashier).not.toContain("inventory.manage");
    expect(warehouse).toContain("inventory.manage");
    expect(warehouse).not.toContain("sales.create");
  });
});

describe("clientIp", () => {
  const request = (headers: Record<string, string>) => new Request("http://localhost/x", { headers });
  it("uses the first forwarded address", () => {
    expect(clientIp(request({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });
  it("falls back to x-real-ip and then to unknown", () => {
    expect(clientIp(request({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(clientIp(request({}))).toBe("unknown");
  });
  it("caps the length so junk cannot bloat the table", () => {
    expect(clientIp(request({ "x-forwarded-for": "9".repeat(500) })).length).toBeLessThanOrEqual(64);
  });
});
