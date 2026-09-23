import { api, json, bodyJSON } from "../../../lib/api.js";
import { requireUser } from "../../../lib/server-auth.js";
import { getSettings, updateSettings } from "../../../services/repository.js";
export const dynamic = "force-dynamic";
export const GET = api(async () => json({ settings: await getSettings() }));
export const PATCH = api(async (request) => { const user = await requireUser(); return json({ settings: await updateSettings(await bodyJSON(request), user) }); });
