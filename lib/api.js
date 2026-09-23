import "server-only";
import { NextResponse } from "next/server";
import { ApiError } from "./validation.js";
import { checkOrigin, requireUser, rateLimit } from "./server-auth.js";
import { updateProblem } from "../services/repository.js";

export function json(value, status = 200) { return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } }); }
export async function bodyJSON(request) {
  checkOrigin(request);
  if (request.headers.get("content-length") && Number(request.headers.get("content-length")) > 250000) throw new ApiError("Request is too large.", 413);
  const value = await request.text();
  if (Buffer.byteLength(value, "utf8") > 250000) throw new ApiError("Request is too large.", 413);
  if (!value.trim()) return {};
  try { const parsed = JSON.parse(value); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(); return parsed; } catch { throw new ApiError("Provide a valid JSON request."); }
}
export function api(handler) {
  return async (...args) => {
    try { return await handler(...args); }
    catch (error) {
      if (error instanceof ApiError) return json({ error: error.message }, error.status);
      console.error("API operation failed:", error.code || error.name || "unknown error");
      return json({ error: "The request could not be completed. Please try again." }, 500);
    }
  };
}
export function problemAction(action) {
  return api(async (request, context) => {
    const user = await requireUser();
    rateLimit(`mutate:${user.id}`);
    const body = await bodyJSON(request);
    const { id } = await context.params;
    return json({ problem: await updateProblem(id, action || body.action || "edit", body, user) });
  });
}
