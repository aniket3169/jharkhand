import { api, json } from "../../../lib/api.js";
import { getOrganizations } from "../../../services/repository.js";
export const GET = api(async () => json(await getOrganizations()));
