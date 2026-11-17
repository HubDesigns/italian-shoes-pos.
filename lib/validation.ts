import { z } from "zod";

/* -------------------------------------------------------------------------
 * Input rules for accounts and sign-in. Used on the server for every request;
 * the forms show the same messages.
 * ----------------------------------------------------------------------- */

export const PASSWORD_MIN_LENGTH = 10;
/** bcrypt only reads the first 72 bytes, so longer passwords would silently be cut short. */
export const PASSWORD_MAX_BYTES = 72;

/** A short blocklist of passwords people pick even when they are long enough. */
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password12", "password123", "password1234", "passw0rd123",
  "1234567890", "12345678910", "123456789012", "0123456789", "qwertyuiop", "qwerty12345", "qwerty123456",
  "1q2w3e4r5t", "abcdefghij", "iloveyou123", "welcome123", "welcome1234", "admin12345", "admin123456",
  "letmein1234", "pakistan123", "pakistan1234", "karachi123", "italianshoes", "italianshoes1", "italianshoes123",
]);

/** Returns a plain-words problem with the password, or null when it is acceptable. */
export function passwordProblem(password: string, context: { email?: string; name?: string } = {}): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return `Password is too long (maximum ${PASSWORD_MAX_BYTES} bytes).`;
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return "That password is too common. Choose something harder to guess.";
  if (/^(.)\1+$/.test(password)) return "Password cannot be one character repeated.";
  if (/^(0123456789|1234567890|abcdefghij)/.test(lower) && new Set(lower).size <= 10) return "Password cannot be a simple sequence.";
  const local = context.email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) return "Password cannot contain your email name.";
  return null;
}

const emailField = z.string("Enter an email address.").trim().toLowerCase()
  .pipe(z.string().max(254, "Email address is too long.").pipe(z.email("Enter a valid email address.")));

const nameField = z.string("Enter a name.").trim().min(2, "Name must be at least 2 characters.").max(80, "Name must be 80 characters or fewer.");

const passwordField = z.string("Enter a password.");

export const setupSchema = z.object({
  setupSecret: z.string("Enter the setup key.").min(1, "Enter the setup key."),
  name: nameField,
  email: emailField,
  password: passwordField,
  organizationName: z.string().trim().min(2, "Enter the business name.").max(80, "Business name must be 80 characters or fewer.").optional().default("Italian Shoes"),
}).superRefine((data, ctx) => {
  const problem = passwordProblem(data.password, { email: data.email, name: data.name });
  if (problem) ctx.addIssue({ code: "custom", path: ["password"], message: problem });
});

export const loginSchema = z.object({
  email: z.string("Enter your email and password.").trim().toLowerCase().min(1, "Enter your email and password.").max(254, "Email or password is incorrect."),
  password: z.string("Enter your email and password.").min(1, "Enter your email and password.").max(1024, "Email or password is incorrect."),
});

export const createStaffSchema = z.object({
  name: nameField,
  email: emailField,
  password: passwordField,
  roleId: z.string("Choose a role.").min(1, "Choose a role."),
  branchIds: z.array(z.string()).min(1, "Choose at least one branch.").max(100),
}).superRefine((data, ctx) => {
  const problem = passwordProblem(data.password, { email: data.email, name: data.name });
  if (problem) ctx.addIssue({ code: "custom", path: ["password"], message: problem });
});

export const updateStaffSchema = z.object({
  name: nameField.optional(),
  roleId: z.string().min(1).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"], "Status must be ACTIVE or SUSPENDED.").optional(),
}).refine((value) => Object.values(value).some((item) => item !== undefined), "Nothing to update.");

export const resetPasswordSchema = z.object({
  newPassword: passwordField,
}).superRefine((data, ctx) => {
  const problem = passwordProblem(data.newPassword);
  if (problem) ctx.addIssue({ code: "custom", path: ["newPassword"], message: problem });
});

export const changePasswordSchema = z.object({
  currentPassword: z.string("Enter your current password.").min(1, "Enter your current password.").max(1024),
  newPassword: passwordField,
});

export const ownerResetSchema = z.object({
  setupSecret: z.string("Enter the setup key.").min(1, "Enter the setup key."),
  newPassword: passwordField,
}).superRefine((data, ctx) => {
  const problem = passwordProblem(data.newPassword);
  if (problem) ctx.addIssue({ code: "custom", path: ["newPassword"], message: problem });
});

/** First problem in plain words. Schema messages are already written for people. */
export function firstProblem(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the details and try again.";
}
