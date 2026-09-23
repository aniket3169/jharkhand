import { api, json, bodyJSON } from "../../../lib/api.js";
import { requireUser } from "../../../lib/server-auth.js";
import { getNotifications, readNotifications } from "../../../services/repository.js";
export const dynamic = "force-dynamic";
export const GET = api(async () => json({ notifications: await getNotifications(await requireUser()) }));
export const PATCH = api(async (request) => { const user = await requireUser(); return json({ notifications: await readNotifications(await bodyJSON(request), user) }); });
