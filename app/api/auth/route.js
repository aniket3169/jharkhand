import { api, json, bodyJSON } from "../../../lib/api.js";
import { currentUser, requireUser, createDemoSession, createSession, clearSession, isDemoMode, integrations, hashPassword, verifyPassword, rateLimit, checkOrigin } from "../../../lib/server-auth.js";
import { createAccount, accountByEmail, updateAccount } from "../../../services/repository.js";
import { ApiError } from "../../../lib/validation.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const authResponse = (user) => ({ user, demo: isDemoMode(), integrations: integrations() });
export const GET = api(async () => json(authResponse(await currentUser())));
export const POST = api(async (request) => {
  const body = await bodyJSON(request);
  rateLimit("auth:global", 80);
  if (body.action === "register" || body.action === "login") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new ApiError("Enter a valid email address.");
    rateLimit(`auth:${email}`, 10);
    if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 128) throw new ApiError("Password must contain 8–128 characters.");
    let user;
    if (body.action === "register") {
      if (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.trim().length > 80) throw new ApiError("Enter a name between 2 and 80 characters.");
      user = await createAccount({ name: body.name.trim(), email, passwordHash: await hashPassword(body.password) });
    } else {
      const account = await accountByEmail(email);
      const valid = await verifyPassword(body.password, account?.passwordHash || "000000000000000000000000000000000000000000000000:00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000");
      if (!account || !valid) throw new ApiError("Email or password is incorrect.", 401);
      const { passwordHash, ...safeUser } = account;
      user = safeUser;
    }
    return json(authResponse(await createSession(user)), body.action === "register" ? 201 : 200);
  }
  return json(authResponse(await createDemoSession(body)));
});
export const PATCH = api(async (request) => {
  const user = await requireUser();
  const body = await bodyJSON(request);
  if (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.trim().length > 80) throw new ApiError("Enter a name between 2 and 80 characters.");
  const profile = user.demo ? { ...user, name: body.name.trim(), ...(typeof body.district === "string" ? { district: body.district.slice(0, 80) } : {}) } : await updateAccount(user, body);
  return json(authResponse(await createSession(profile)));
});
export const DELETE = api(async (request) => { checkOrigin(request); await clearSession(); return json(authResponse(null)); });
