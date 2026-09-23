import { api, json, bodyJSON } from "../../../../lib/api.js";
import { requireUser, rateLimit } from "../../../../lib/server-auth.js";
import { createUploadURL } from "../../../../lib/storage.js";
export const runtime = "nodejs";
export const POST = api(async (request) => { const user = await requireUser(); rateLimit(`upload:${user.id}`, 30); return json(await createUploadURL(await bodyJSON(request), user)); });
