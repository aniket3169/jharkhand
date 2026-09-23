import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { api } from "../../../../lib/api.js";
import { requireUser } from "../../../../lib/server-auth.js";
import { mediaForDownload } from "../../../../services/repository.js";
import { getDownloadURL, getLocalUploadPath } from "../../../../lib/storage.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const media = await mediaForDownload(id, user);

  if (media.storage === "local" || media.storage === "demo") {
    try {
      const filePath = getLocalUploadPath(media.objectPath);
      const fileBuffer = await readFile(filePath);
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": media.type || "application/octet-stream",
          "Content-Disposition": `inline; filename="${media.name.replace(/[^a-zA-Z0-9._ -]/g, "_")}"`,
          "Cache-Control": "private, max-age=3600",
        },
      });
    } catch {
      // fallback to download URL if local file is missing
    }
  }

  return NextResponse.redirect(await getDownloadURL(media), {
    status: 307,
    headers: { "Cache-Control": "private, no-store" },
  });
});
