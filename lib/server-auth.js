import "server-only";
import { createHmac, randomBytes, timingSafeEqual, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { roles } from "./permissions.js";
import { ApiError } from "./validation.js";

const COOKIE_NAME = "jharkhand-session";
const SESSION_SECONDS = 60 * 60 * 12;
const runtime = globalThis.__jhAuth ||= { secret: randomBytes(48).toString("hex"), rates: new Map() };
export function isDemoMode() { return process.env.DEMO_MODE === "true" || (process.env.DEMO_MODE !== "false" && process.env.NODE_ENV !== "production"); }
export function integrations() { return { gemini: Boolean(process.env.GEMINI_API_KEY), storage: process.env.STORAGE_MODE === "gcs" }; }
function secret() { return process.env.SESSION_SECRET || runtime.secret; }
function sign(value) { return createHmac("sha256", secret()).update(value).digest("base64url"); }

export async function currentUser() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) return null;
    const expected = Buffer.from(sign(payload));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
    const { user, expiresAt } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (expiresAt <= Date.now() || !roles.includes(user.role) || (user.demo && !isDemoMode())) return null;
    if (!user.demo) {
      const { accountById } = await import("../services/repository.js");
      return accountById(user.id);
    }
    return user;
  } catch { return null; }
}

export async function requireUser() { const user = await currentUser(); if (!user) throw new ApiError("Please sign in to continue.", 401); return user; }

export async function createDemoSession({ role = "citizen", name, organizationId } = {}) {
  if (!isDemoMode()) throw new ApiError("Demo sign-in is disabled. Configure your production identity provider before enabling account access.", 503);
  if (!roles.includes(role)) throw new ApiError("Choose a valid role.");
  const names = { citizen: "Ananya Singh", authority: "Vikram Prasad", university: "Dr. Priya Sharma", industry: "Rahul Mehta", ngo: "Sunita Devi", admin: "Platform Administrator" };
  const organizations = { citizen: "Community member", authority: "District Administration, Ranchi", university: "BIT Mesra", industry: "Jharkhand Innovation Lab", ngo: "PRADAN", admin: "Innovation Mission, Jharkhand" };
  const ids = { university: "bit-mesra", industry: "jhar-innovation", ngo: "pradan" };
  const user = { id: `demo-${role}`, role, name: typeof name === "string" && name.trim() ? name.trim().slice(0, 80) : names[role], organization: organizations[role], organizationId: ids[role] || null, demo: true };
  if (role === "university" && organizationId) {
    const { universities } = await import("../data/seed.js");
    const university = universities.find((item) => item.id === organizationId);
    if (!university) throw new ApiError("Choose an available institution.");
    user.organizationId = university.id;
    user.organization = university.shortName;
    user.id = `demo-university-${university.id}`;
  }
  return createSession(user);
}

export async function createSession(user) {
  const payload = Buffer.from(JSON.stringify({ user, expiresAt: Date.now() + SESSION_SECONDS * 1000 })).toString("base64url");
  (await cookies()).set(COOKIE_NAME, `${payload}.${sign(payload)}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_SECONDS });
  return user;
}

export async function clearSession() { (await cookies()).delete(COOKIE_NAME); }

const deriveKey = promisify(scrypt);
export async function hashPassword(password) { const salt = randomBytes(24).toString("hex"); const key = await deriveKey(password, salt, 64); return `${salt}:${key.toString("hex")}`; }
export async function verifyPassword(password, hash) { try { const [salt, stored] = hash.split(":"); const key = await deriveKey(password, salt, 64); const expected = Buffer.from(stored, "hex"); return expected.length === key.length && timingSafeEqual(expected, key); } catch { return false; } }

export function checkOrigin(request) {
  const origin = request.headers.get("origin");
  if (origin) {
    const originHost = new URL(origin).hostname;
    const reqHost = new URL(request.url).hostname;
    const isLocal = (h) => ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(h);
    if (origin !== new URL(request.url).origin && !(isLocal(originHost) && isLocal(reqHost))) {
      throw new ApiError("This request must come from the application.", 403);
    }
  }
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new ApiError("Cross-site requests are not allowed.", 403);
}

export function rateLimit(key, limit = 60, period = 60000) {
  const now = Date.now();
  if (runtime.rates.size > 5000) for (const [id, entry] of runtime.rates) if (entry.reset <= now) runtime.rates.delete(id);
  const entry = runtime.rates.get(key);
  if (!entry || entry.reset <= now) { runtime.rates.set(key, { count: 1, reset: now + period }); return; }
  entry.count += 1;
  if (entry.count > limit) throw new ApiError("Too many requests. Please try again in a minute.", 429);
}
