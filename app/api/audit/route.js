import { api, json } from "../../../lib/api.js";
import { requireUser } from "../../../lib/server-auth.js";
import { getAudit } from "../../../services/repository.js";
export const dynamic = "force-dynamic";
export const GET = api(async () => json({ events: await getAudit(await requireUser()) }));
