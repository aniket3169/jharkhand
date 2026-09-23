import { NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { api, json } from "../../../../lib/api.js";
import { requireUser, rateLimit } from "../../../../lib/server-auth.js";
import { getUpload } from "../../../../services/repository.js";
import { ApiError } from "../../../../lib/validation.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PUT = api(async (request) => {
  const user = await requireUser();
  rateLimit(`upload-raw:${user.id}`, 60);

  const url = new URL(request.url);
  const uploadId = url.searchParams.get("id");
  if (!uploadId) throw new ApiError("Missing upload ID.", 400);

  const ticket = await getUpload(uploadId, user);
  if (!ticket) throw new ApiError("Upload ticket not found.", 404);

  const buffer = Buffer.from(await request.arrayBuffer());
  if (buffer.length === 0) throw new ApiError("No data received.", 400);

  const uploadDir = path.join(process.env.DATA_DIRECTORY || path.join(process.cwd(), ".data"), "uploads");
  const fullPath = path.join(uploadDir, ticket.objectPath);

  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, buffer);

  return json({ ok: true, size: buffer.length });
});
