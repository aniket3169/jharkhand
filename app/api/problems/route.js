import { api, json, bodyJSON } from "../../../lib/api.js";
import { currentUser, requireUser, rateLimit } from "../../../lib/server-auth.js";
import { listProblems, createProblem } from "../../../services/repository.js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = api(async (request) => {
  const user = await currentUser();
  let problems = await listProblems(user);
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.toLowerCase();
  if (query) problems = problems.filter((item) => [item.id, item.title, item.category, item.district, item.assignedTo, item.department, item.status].some((value) => value?.toLowerCase().includes(query)));
  for (const field of ["category", "district", "status", "priority"]) if (params.get(field)) problems = problems.filter((item) => item[field] === params.get(field));
  if (params.get("mine") === "true") problems = user ? problems.filter((item) => item.reporter?.id === user.id) : [];
  return json({ problems });
});
export const POST = api(async (request) => { const user = await requireUser(); rateLimit(`create:${user.id}`, 12); return json({ problem: await createProblem(await bodyJSON(request), user) }, 201); });
