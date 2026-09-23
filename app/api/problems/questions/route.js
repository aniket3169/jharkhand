import { api, json, bodyJSON } from "../../../../lib/api.js";
import { requireUser, rateLimit } from "../../../../lib/server-auth.js";
import { analyzeProblem } from "../../../../lib/gemini.js";
export const runtime = "nodejs";
export const maxDuration = 60;
export const POST = api(async (request) => { const user = await requireUser(); rateLimit(`ai:${user.id}`, 12); return json(await analyzeProblem(await bodyJSON(request), user)); });
