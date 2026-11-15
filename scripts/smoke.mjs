// End-to-end check of Stage 1 against a running app and a real database.
//
//   npm run build && npm start        (in one terminal, against an EMPTY database)
//   npm run smoke                     (in another)
//
// It creates the Owner, staff, branches and products, then tries to break the rules:
// wrong passwords, lockouts, suspended accounts, old sessions, missing permissions.
// Needs DATABASE_URL (to read the audit log at the end) and OWNER_SETUP_SECRET (the same value the app uses).

import { PrismaClient } from "@prisma/client";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const SETUP_KEY = process.env.OWNER_SETUP_SECRET;
if (!SETUP_KEY) throw new Error("OWNER_SETUP_SECRET must be set for the smoke test.");

const prisma = new PrismaClient();
const failures = [];
let passed = 0;

function check(name, ok, detail = "") {
  if (ok) { passed += 1; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${detail ? `  -> ${detail}` : ""}`); }
}
const section = (title) => console.log(`\n${title}`);
const show = (r) => `HTTP ${r.status} ${JSON.stringify(r.data)?.slice(0, 160)}`;

/** A pretend browser: keeps its cookie and reports a chosen client address. */
class Client {
  constructor(ip) { this.ip = ip; this.cookie = ""; }
  async call(method, path, body, { redirect = "follow" } = {}) {
    const response = await fetch(BASE + path, {
      method, redirect,
      headers: { "content-type": "application/json", "x-forwarded-for": this.ip, ...(this.cookie ? { cookie: this.cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = response.headers.getSetCookie?.() ?? [];
    for (const line of set) {
      const pair = line.split(";")[0];
      if (pair.endsWith("=")) this.cookie = ""; else this.cookie = pair;
    }
    const text = await response.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = null; }
    return { status: response.status, data, headers: response.headers, setCookie: set };
  }
  get(path, opts) { return this.call("GET", path, undefined, opts); }
  post(path, body) { return this.call("POST", path, body); }
  patch(path, body) { return this.call("PATCH", path, body); }
  put(path, body) { return this.call("PUT", path, body); }
}

async function login(ip, email, password) {
  const client = new Client(ip);
  const result = await client.post("/api/auth/login", { email, password });
  return { client, result };
}

const OWNER_EMAIL = "owner@shop.test";
let ownerPassword = "Quetta-Boots-2026-A";
const PW_GOOD = "Counter-Sandal-77";

async function main() {
  /* ------------------------------------------------------------------ */
  section("Health and basics");
  const anon = new Client("10.0.0.1");
  const health = await anon.get("/api/health");
  check("health endpoint reports the database is reachable", health.status === 200 && health.data?.ok === true, show(health));
  const page = await anon.get("/login");
  check("pages send anti-clickjacking and no-sniff headers", page.headers.get("x-frame-options") === "DENY" && page.headers.get("x-content-type-options") === "nosniff");
  const home = await anon.get("/", { redirect: "manual" });
  check("before setup, the home page sends visitors to /setup", [307, 308].includes(home.status) && (home.headers.get("location") ?? "").endsWith("/setup"), `HTTP ${home.status} ${home.headers.get("location")}`);
  check("staff API refuses anonymous visitors", (await anon.get("/api/staff")).status === 401);
  check("product API refuses anonymous visitors", (await anon.post("/api/products", {})).status === 401);

  /* ------------------------------------------------------------------ */
  section("Owner setup");
  const setupBody = (over = {}) => ({ setupSecret: SETUP_KEY, name: "Habib Khan", email: OWNER_EMAIL, password: ownerPassword, organizationName: "Italian Shoes", ...over });
  const guess = new Client("10.9.9.9");
  let lastStatus = 0;
  for (let i = 0; i < 5; i++) lastStatus = (await guess.post("/api/setup/owner", setupBody({ setupSecret: `wrong-key-${i}` }))).status;
  check("a wrong setup key is rejected", lastStatus === 403);
  const lockedSetup = await guess.post("/api/setup/owner", setupBody());
  check("after 5 wrong setup keys, even the right key is blocked from that address", lockedSetup.status === 429, show(lockedSetup));

  const setup = new Client("10.1.0.1");
  const badEmail = await setup.post("/api/setup/owner", setupBody({ email: "not-an-email" }));
  check("setup rejects an invalid email on the server", badEmail.status === 400 && /email/i.test(badEmail.data?.error ?? ""), show(badEmail));
  const weak = await setup.post("/api/setup/owner", setupBody({ password: "short" }));
  check("setup rejects a short password", weak.status === 400 && /10/.test(weak.data?.error ?? ""), show(weak));
  const common = await setup.post("/api/setup/owner", setupBody({ password: "Password123" }));
  check("setup rejects a very common password", common.status === 400, show(common));
  const ok = await setup.post("/api/setup/owner", setupBody());
  check("setup with the right key creates the Owner and signs them in", ok.status === 200 && setup.cookie.startsWith("italian_shoes_session="), show(ok));
  const again = await new Client("10.1.0.2").post("/api/setup/owner", setupBody({ email: "second@shop.test" }));
  check("setup cannot be run a second time", again.status === 409, show(again));

  const owner = setup;
  const roleRows = await prisma.role.findMany({ select: { id: true, name: true } });
  const roleId = (name) => roleRows.find((r) => r.name === name)?.id;
  check("setup created Owner, Branch Manager, Cashier and Warehouse roles", ["OWNER", "BRANCH_MANAGER", "CASHIER", "WAREHOUSE"].every((n) => roleId(n)), roleRows.map((r) => r.name).join(","));

  /* ------------------------------------------------------------------ */
  section("Roles and branches");
  const staffList = await owner.get("/api/staff");
  const listedRoles = (staffList.data?.roles ?? []).map((r) => r.name).sort();
  check("owner sees the assignable roles (never OWNER)", JSON.stringify(listedRoles) === JSON.stringify(["BRANCH_MANAGER", "CASHIER", "WAREHOUSE"]), listedRoles.join(","));
  const again2 = await owner.get("/api/staff");
  check("loading roles repeatedly does not duplicate them", (again2.data?.roles ?? []).length === 3);
  const cashierPerms = await prisma.rolePermission.findMany({ where: { roleId: roleId("CASHIER") }, select: { permission: { select: { key: true } } } });
  const cashierKeys = cashierPerms.map((p) => p.permission.key).sort();
  check("Cashier starts with sell + view-stock only", JSON.stringify(cashierKeys) === JSON.stringify(["inventory.view", "sales.create", "sales.view"]), cashierKeys.join(","));

  const branchA = await owner.post("/api/branches", { code: "main", name: "Main Branch", city: "Quetta" });
  const branchB = await owner.post("/api/branches", { code: "city", name: "City Branch", city: "Quetta" });
  check("owner creates two branches", branchA.status === 201 && branchB.status === 201, show(branchA));
  const A = branchA.data?.branch?.id, B = branchB.data?.branch?.id;

  /* ------------------------------------------------------------------ */
  section("Creating staff");
  const mk = (over) => ({ name: "Ali Raza", email: "cashier@shop.test", password: PW_GOOD, roleId: roleId("CASHIER"), branchIds: [A], ...over });
  check("staff with a bad email is rejected", (await owner.post("/api/staff", mk({ email: "nope" }))).status === 400);
  check("staff with a weak password is rejected", (await owner.post("/api/staff", mk({ password: "weakpass" }))).status === 400);
  check("staff with no branch is rejected", (await owner.post("/api/staff", mk({ branchIds: [] }))).status === 400);
  const asOwnerRole = await owner.post("/api/staff", mk({ roleId: roleId("OWNER") }));
  check("a second Owner cannot be created through the staff screen", asOwnerRole.status === 400, show(asOwnerRole));
  const cashierCreate = await owner.post("/api/staff", mk({}));
  check("owner creates a cashier", cashierCreate.status === 201 && !JSON.stringify(cashierCreate.data).includes("passwordHash"), show(cashierCreate));
  const dup = await owner.post("/api/staff", mk({ email: "CASHIER@shop.test" }));
  check("the same email in different capitals is a duplicate", dup.status === 409, show(dup));
  const whCreate = await owner.post("/api/staff", mk({ name: "Bilal Warehouse", email: "warehouse@shop.test", roleId: roleId("WAREHOUSE"), branchIds: [A, B] }));
  check("owner creates a warehouse user", whCreate.status === 201, show(whCreate));
  const cashierId = cashierCreate.data?.staff?.id, whId = whCreate.data?.staff?.id;

  /* ------------------------------------------------------------------ */
  section("What each role is allowed to do");
  const cashier = (await login("10.2.0.1", "cashier@shop.test", PW_GOOD));
  check("cashier signs in", cashier.result.status === 200, show(cashier.result));
  const c = cashier.client;
  check("cashier cannot open staff administration", (await c.get("/api/staff")).status === 403);
  check("cashier cannot create branches", (await c.post("/api/branches", { code: "x", name: "x" })).status === 403);
  check("cashier cannot create products", (await c.post("/api/products", {})).status === 403);
  const cashierBranches = await c.get("/api/branches");
  check("cashier only sees the branch they are assigned to", cashierBranches.status === 200 && cashierBranches.data?.branches?.length === 1 && cashierBranches.data.branches[0].id === A, show(cashierBranches));

  const warehouse = (await login("10.2.0.2", "warehouse@shop.test", PW_GOOD)).client;
  const product = (article, over = {}) => ({
    articleCode: article, name: "Oxford Classic", brand: "Zafar", category: "Formal", department: "MEN", sizeSystem: "EU",
    upperMaterial: "Leather", soleMaterial: "Rubber", closure: "Lace-up",
    variants: [
      { color: "black", size: 41, costPrice: "3200", salePrice: "5500" },
      { color: "Black", size: 42, costPrice: "3200", salePrice: "5500", barcode: "BC-0001" },
      { color: "Brown", size: 7.5, costPrice: "3200.50", salePrice: "5600" },
    ],
    ...over,
  });
  const made = await warehouse.post("/api/products", product("zh-204"));
  check("warehouse (inventory.manage) can create a product with variants", made.status === 201, show(made));
  const variantCount = await prisma.productVariant.count({ where: { productId: made.data?.product?.id } });
  check("all 3 variants were saved, colours normalized", variantCount === 3 && (await prisma.productVariant.count({ where: { productId: made.data?.product?.id, color: "Black" } })) === 2);
  const half = await prisma.productVariant.findFirst({ where: { productId: made.data?.product?.id, color: "Brown" } });
  check("half sizes and decimal prices are stored exactly", half && half.size.toString() === "7.5" && half.costPrice.toString() === "3200.5", half && `${half.size} ${half.costPrice}`);
  const dupArticle = await warehouse.post("/api/products", product("ZH-204"));
  check("a duplicate article code is refused with a clear message", dupArticle.status === 409 && /article code/i.test(dupArticle.data?.error ?? ""), show(dupArticle));
  const dupBarcode = await warehouse.post("/api/products", product("ZH-205"));
  check("a barcode already used by another variant is refused", dupBarcode.status === 409 && /barcode/i.test(dupBarcode.data?.error ?? ""), show(dupBarcode));
  const variantId = (await prisma.productVariant.findFirst({ where: { productId: made.data?.product?.id, color: "Brown" } }))?.id;
  const priced = await warehouse.patch(`/api/variants/${variantId}`, { salePrice: "5900" });
  check("a price change succeeds", priced.status === 200 && priced.data?.variant?.salePrice === "5900", show(priced));
  check("a cashier cannot change prices", (await c.patch(`/api/variants/${variantId}`, { salePrice: "1" })).status === 403);

  /* ------------------------------------------------------------------ */
  section("Sign-in lockout");
  const attacker = "10.3.0.1";
  const wrongFirst = await login(attacker, "cashier@shop.test", "definitely-wrong-1");
  const wrongUnknown = await login(attacker, "nobody@shop.test", "definitely-wrong-1");
  check("wrong password and unknown email give the same answer", wrongFirst.result.status === 401 && wrongUnknown.result.status === 401 && wrongFirst.result.data?.error === wrongUnknown.result.data?.error);
  for (let i = 0; i < 3; i++) await login(attacker, "cashier@shop.test", `definitely-wrong-${i + 2}`);
  const fifth = await login(attacker, "cashier@shop.test", "definitely-wrong-5");
  check("5 wrong passwords are all rejected as wrong", fifth.result.status === 401);
  const blocked = await login(attacker, "cashier@shop.test", PW_GOOD);
  check("then even the correct password is blocked from that address", blocked.result.status === 429 && /15 minutes/.test(blocked.result.data?.error ?? ""), show(blocked.result));
  check("the block carries a Retry-After header", blocked.result.headers?.get("retry-after") === "900");
  const elsewhere = await login("10.3.0.2", "cashier@shop.test", PW_GOOD);
  check("the real person can still sign in from a different address", elsewhere.result.status === 200, show(elsewhere.result));
  const manyAccounts = "10.3.0.3";
  let ipBlocked = 0;
  for (let i = 0; i < 22; i++) { const r = await login(manyAccounts, `user${i}@shop.test`, "whatever-12345"); if (r.result.status === 429) ipBlocked += 1; }
  check("one address trying many accounts is blocked", ipBlocked >= 2, `blocked ${ipBlocked} of 22`);

  /* ------------------------------------------------------------------ */
  section("Suspending and reactivating");
  const liveCookieClient = elsewhere.client; // a signed-in cashier session
  check("the session works before suspension", (await liveCookieClient.get("/api/staff")).status === 403);
  check("owner cannot suspend themselves here", (await owner.patch("/api/staff/" + (await prisma.user.findUnique({ where: { email: OWNER_EMAIL } })).id, { status: "SUSPENDED" })).status === 400);
  const suspend = await owner.patch(`/api/staff/${cashierId}`, { status: "SUSPENDED" });
  check("owner suspends the cashier", suspend.status === 200 && suspend.data?.status === "SUSPENDED", show(suspend));
  check("the cashier's open session stops working at once", (await liveCookieClient.get("/api/staff")).status === 401);
  const susRight = await login("10.4.0.1", "cashier@shop.test", PW_GOOD);
  check("a suspended person with the right password is told the account is not active", susRight.result.status === 403 && /not active/i.test(susRight.result.data?.error ?? ""), show(susRight.result));
  const susWrong = await login("10.4.0.1", "cashier@shop.test", "wrong-password-1");
  check("a wrong password still gets the generic answer", susWrong.result.status === 401);
  const react = await owner.patch(`/api/staff/${cashierId}`, { status: "ACTIVE" });
  check("owner reactivates the cashier", react.status === 200, show(react));
  check("the OLD session does not come back to life", (await liveCookieClient.get("/api/staff")).status === 401);
  const fresh = await login("10.4.0.2", "cashier@shop.test", PW_GOOD);
  check("a fresh sign-in works after reactivation", fresh.result.status === 200, show(fresh.result));

  /* ------------------------------------------------------------------ */
  section("Changing a role");
  check("an unknown role is refused", (await owner.patch(`/api/staff/${cashierId}`, { roleId: "nope" })).status === 400);
  check("the Owner role cannot be assigned", (await owner.patch(`/api/staff/${cashierId}`, { roleId: roleId("OWNER") })).status === 400);
  check("owner promotes the cashier to warehouse", (await owner.patch(`/api/staff/${cashierId}`, { roleId: roleId("WAREHOUSE") })).status === 200);
  const promoted = (await login("10.4.0.3", "cashier@shop.test", PW_GOOD)).client;
  check("the new role's permissions apply immediately", (await promoted.post("/api/products", product("ZH-300", { variants: [{ color: "Tan", size: 40, costPrice: "1000", salePrice: "2000" }] }))).status === 201);
  check("owner moves them back to cashier", (await owner.patch(`/api/staff/${cashierId}`, { roleId: roleId("CASHIER") })).status === 200);
  check("and the extra permission is gone", (await promoted.post("/api/products", {})).status === 403);

  /* ------------------------------------------------------------------ */
  section("Changing what a role may do");
  const ownerOnly = await owner.patch(`/api/roles/${roleId("WAREHOUSE")}/permissions`, { permissionKeys: ["inventory.view", "branch.manage"] });
  check("owner-only permissions cannot be given to a role", ownerOnly.status === 403, show(ownerOnly));
  const reduce = await owner.patch(`/api/roles/${roleId("WAREHOUSE")}/permissions`, { permissionKeys: ["inventory.view"] });
  check("owner removes inventory.manage from Warehouse", reduce.status === 200, show(reduce));
  check("the warehouse user can no longer create products", (await warehouse.post("/api/products", product("ZH-400"))).status === 403);
  await owner.patch(`/api/roles/${roleId("WAREHOUSE")}/permissions`, { permissionKeys: ["dashboard.view", "inventory.view", "inventory.manage"] });
  check("restoring it works again", (await warehouse.post("/api/products", product("ZH-400", { variants: [{ color: "Navy", size: 43, costPrice: "1", salePrice: "2" }] }))).status === 201);

  /* ------------------------------------------------------------------ */
  section("Owner resets a staff password");
  const lockIp = "10.5.0.1";
  for (let i = 0; i < 5; i++) await login(lockIp, "cashier@shop.test", `bad-guess-${i}-xx`);
  check("the account is locked from that address", (await login(lockIp, "cashier@shop.test", PW_GOOD)).result.status === 429);
  const victim = (await login("10.5.0.2", "cashier@shop.test", PW_GOOD)).client;
  check("a weak replacement password is refused", (await owner.post(`/api/staff/${cashierId}/password`, { newPassword: "weak" })).status === 400);
  check("a cashier cannot reset passwords", (await victim.post(`/api/staff/${whId}/password`, { newPassword: "Another-Strong-1" })).status === 403);
  const NEW1 = "Fresh-Leather-88";
  const reset = await owner.post(`/api/staff/${cashierId}/password`, { newPassword: NEW1 });
  check("owner sets a new password", reset.status === 200, show(reset));
  check("the person's open session is ended", (await victim.get("/api/staff")).status === 401);
  check("the old password no longer works", (await login("10.5.0.3", "cashier@shop.test", PW_GOOD)).result.status === 401);
  const afterReset = await login(lockIp, "cashier@shop.test", NEW1);
  check("the new password works, and the lockout was lifted", afterReset.result.status === 200, show(afterReset.result));

  /* ------------------------------------------------------------------ */
  section("A person changes their own password");
  const me = afterReset.client;
  const NEW2 = "Brass-Buckle-2026";
  check("a wrong current password is refused", (await me.post("/api/account/password", { currentPassword: "not-my-password", newPassword: NEW2 })).status === 400);
  check("a weak new password is refused", (await me.post("/api/account/password", { currentPassword: NEW1, newPassword: "weak" })).status === 400);
  check("reusing the same password is refused", (await me.post("/api/account/password", { currentPassword: NEW1, newPassword: NEW1 })).status === 400);
  const otherDevice = (await login("10.6.0.1", "cashier@shop.test", NEW1)).client;
  const change = await me.post("/api/account/password", { currentPassword: NEW1, newPassword: NEW2 });
  check("changing the password works", change.status === 200, show(change));
  check("this device stays signed in", (await me.get("/api/staff")).status === 403);
  check("their other device is signed out", (await otherDevice.get("/api/staff")).status === 401);
  check("only the new password signs in", (await login("10.6.0.2", "cashier@shop.test", NEW1)).result.status === 401 && (await login("10.6.0.2", "cashier@shop.test", NEW2)).result.status === 200);
  const guesser = (await login("10.6.0.3", "cashier@shop.test", NEW2)).client;
  let pwBlocked = 0;
  for (let i = 0; i < 7; i++) { const r = await guesser.post("/api/account/password", { currentPassword: `guess-${i}-abcdef`, newPassword: "Whatever-Long-Pass-9" }); if (r.status === 429) pwBlocked += 1; }
  check("guessing the current password is rate limited too", pwBlocked >= 1, `blocked ${pwBlocked}`);

  /* ------------------------------------------------------------------ */
  section("Owner recovery (forgot password)");
  const recoverGuess = new Client("10.7.0.9");
  for (let i = 0; i < 5; i++) await recoverGuess.post("/api/auth/owner-reset", { setupSecret: `bad-${i}`, newPassword: "Brand-New-Owner-1" });
  check("guessing the setup key is rate limited", (await recoverGuess.post("/api/auth/owner-reset", { setupSecret: SETUP_KEY, newPassword: "Brand-New-Owner-1" })).status === 429);
  const rec = new Client("10.7.0.1");
  check("a wrong setup key is refused", (await rec.post("/api/auth/owner-reset", { setupSecret: "nope", newPassword: "Brand-New-Owner-1" })).status === 403);
  check("a weak new password is refused", (await rec.post("/api/auth/owner-reset", { setupSecret: SETUP_KEY, newPassword: "weak" })).status === 400);
  const ownerPage = await owner.get("/api/staff");
  check("owner is signed in before recovery", ownerPage.status === 200);
  const NEWOWNER = "Brand-New-Owner-1";
  const recovered = await rec.post("/api/auth/owner-reset", { setupSecret: SETUP_KEY, newPassword: NEWOWNER });
  check("the right key sets a new Owner password", recovered.status === 200 && recovered.data?.email === OWNER_EMAIL, show(recovered));
  check("the Owner's old session ends", (await owner.get("/api/staff")).status === 401);
  check("the old Owner password no longer works", (await login("10.7.0.2", OWNER_EMAIL, ownerPassword)).result.status === 401);
  const ownerAgain = await login("10.7.0.3", OWNER_EMAIL, NEWOWNER);
  check("the new Owner password works", ownerAgain.result.status === 200, show(ownerAgain.result));
  ownerPassword = NEWOWNER;

  /* ------------------------------------------------------------------ */
  section("Audit log");
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "asc" } });
  const actions = new Set(logs.map((l) => l.action));
  for (const action of [
    "OWNER_SETUP_COMPLETED", "LOGIN_SUCCESS", "LOGIN_FAILED", "LOGIN_BLOCKED_SUSPENDED", "STAFF_CREATED", "STAFF_SUSPENDED", "STAFF_REACTIVATED",
    "STAFF_ROLE_CHANGED", "STAFF_PASSWORD_RESET", "PASSWORD_CHANGED", "OWNER_PASSWORD_RESET_WITH_SETUP_KEY", "ROLE_PERMISSIONS_UPDATED",
    "PRODUCT_CREATED", "VARIANT_UPDATED",
  ]) check(`audit log recorded ${action}`, actions.has(action));
  const perm = logs.find((l) => l.action === "ROLE_PERMISSIONS_UPDATED");
  check("permission changes record the real 'before' value", Array.isArray(perm?.previousData?.permissionKeys) && perm.previousData.permissionKeys.length > 0, JSON.stringify(perm?.previousData));
  const failed = logs.find((l) => l.action === "LOGIN_FAILED");
  check("failed sign-ins record where they came from", typeof failed?.ipAddress === "string" && failed.ipAddress.startsWith("10."), String(failed?.ipAddress));
  check("no password or hash ever appears in the audit log", !logs.some((l) => /password|\$2[aby]\$/i.test(JSON.stringify([l.newData, l.previousData]))));
}

try {
  await main();
} catch (error) {
  failures.push("script crashed");
  console.error("\nThe smoke test crashed:", error);
} finally {
  await prisma.$disconnect();
}

console.log(`\n${passed} checks passed, ${failures.length} failed.`);
if (failures.length) {
  console.log("Failed:\n - " + failures.join("\n - "));
  process.exit(1);
}
