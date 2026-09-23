import { api, json, problemAction } from "../../../../lib/api.js";
import { currentUser } from "../../../../lib/server-auth.js";
import { getProblem } from "../../../../services/repository.js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = api(async (_request, context) => { const { id } = await context.params; return json({ problem: await getProblem(id, await currentUser()) }); });
export const PATCH = problemAction();
