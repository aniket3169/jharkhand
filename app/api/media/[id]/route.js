import { NextResponse } from "next/server";
import { api } from "../../../../lib/api.js";
import { requireUser } from "../../../../lib/server-auth.js";
import { mediaForDownload } from "../../../../services/repository.js";
import { getDownloadURL } from "../../../../lib/storage.js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = api(async (_request, context) => { const user = await requireUser(); const { id } = await context.params; const media = await mediaForDownload(id, user); return NextResponse.redirect(await getDownloadURL(media), { status: 307, headers: { "Cache-Control": "private, no-store" } }); });
