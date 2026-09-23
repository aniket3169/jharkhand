import { api, json, bodyJSON } from "../../../../lib/api.js";
import { requireUser, rateLimit } from "../../../../lib/server-auth.js";
import { finishUpload } from "../../../../lib/storage.js";
export const runtime = "nodejs";
export const POST = api(async (request) => { const user = await requireUser(); rateLimit(`upload-complete:${user.id}`, 30); return json({ media: await finishUpload(await bodyJSON(request), user) }); });
