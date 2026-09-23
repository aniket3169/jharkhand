import "server-only";
import { randomUUID } from "node:crypto";
import { Storage } from "@google-cloud/storage";
import { isDemoMode } from "./server-auth.js";
import { canManageProject } from "./permissions.js";
import { ApiError, parse, uploadSchema, locationSchema } from "./validation.js";
import { registerUpload, getUpload, completeUpload, getPrivateProblem } from "../services/repository.js";

let client;
export function cloudEnabled() { return process.env.STORAGE_MODE === "gcs"; }
function bucket() {
  if (!cloudEnabled()) throw new ApiError("Cloud storage is not configured.", 503);
  client ||= new Storage({ projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || "project-7a0d93e5-ed23-42d1-974" });
  return client.bucket(process.env.GOOGLE_CLOUD_STORAGE_BUCKET || "darknight31");
}
const extensionByType = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "application/pdf": "pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx", "text/plain": "txt" };

export async function createUploadURL(body, user) {
  const input = parse(uploadSchema, body);
  if (input.phase === "after") {
    if (!input.problemId) throw new ApiError("A challenge is required for after evidence.");
    const problem = await getPrivateProblem(input.problemId);
    if (!canManageProject(user, problem)) throw new ApiError("Only an authority or the assigned university can add after evidence.", 403);
  } else if (!["citizen", "admin", "authority", "university"].includes(user.role)) throw new ApiError("Your role cannot upload challenge evidence.", 403);
  if (!cloudEnabled() && !isDemoMode()) throw new ApiError("Configure Google Cloud Storage before uploading evidence.", 503);
  const uploadId = randomUUID();
  const draftId = input.problemId || `draft-${randomUUID()}`;
  const kind = input.contentType.startsWith("image/") ? "images" : input.contentType.startsWith("video/") ? "videos" : "documents";
  const objectPath = `uploads/${user.id}/${draftId}/${input.phase}/${kind}/${uploadId}.${extensionByType[input.contentType]}`;
  const expiresAt = Date.now() + 10 * 60 * 1000;
  const ticket = { id: uploadId, userId: user.id, ...input, objectPath, expiresAt, completed: false, mode: cloudEnabled() ? "cloud" : "demo" };
  let uploadUrl;
  const headers = { "Content-Type": input.contentType };
  if (cloudEnabled()) {
    headers["x-goog-if-generation-match"] = "0";
    [uploadUrl] = await bucket().file(objectPath).getSignedUrl({ version: "v4", action: "write", expires: expiresAt, contentType: input.contentType, extensionHeaders: { "x-goog-if-generation-match": "0" } });
  }
  await registerUpload(ticket);
  return { mode: ticket.mode, id: uploadId, objectPath, uploadUrl, headers, expiresAt, ...(ticket.mode === "demo" ? { message: "Demo evidence is stored only in this browser. Configure Cloud Storage for shared evidence." } : {}) };
}

function matchesSignature(bytes, type) {
  const hex = bytes.subarray(0, 16).toString("hex");
  if (type === "image/jpeg") return hex.startsWith("ffd8ff");
  if (type === "image/png") return hex.startsWith("89504e470d0a1a0a");
  if (type === "image/gif") return bytes.subarray(0, 6).toString().match(/^GIF8[79]a$/);
  if (type === "image/webp") return bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
  if (type === "application/pdf") return bytes.subarray(0, 5).toString() === "%PDF-";
  if (type.includes("wordprocessingml")) return hex.startsWith("504b0304");
  if (type === "video/webm") return hex.startsWith("1a45dfa3");
  if (type === "video/mp4" || type === "video/quicktime") return ["ftyp", "moov", "mdat", "wide", "free"].includes(bytes.subarray(4, 8).toString());
  if (type === "text/plain") return !bytes.includes(0);
  return false;
}

export async function finishUpload(body, user) {
  if (typeof body.id !== "string") throw new ApiError("An upload ID is required.");
  const ticket = await getUpload(body.id, user);
  if (ticket.completed) return ticket.media;
  if (Date.now() > ticket.expiresAt + 5 * 60 * 1000) throw new ApiError("This upload expired. Please retry.", 410);
  const location = body.location ? parse(locationSchema, body.location) : null;
  let generation;
  if (ticket.mode === "cloud") {
    const file = bucket().file(ticket.objectPath);
    const [metadata] = await file.getMetadata();
    if (Number(metadata.size) !== ticket.size || metadata.contentType !== ticket.contentType) { await file.delete({ ignoreNotFound: true }); throw new ApiError("Uploaded file size or type does not match the approved upload."); }
    const [head] = await file.download({ start: 0, end: Math.min(ticket.size - 1, 511) });
    if (!matchesSignature(head, ticket.contentType)) { await file.delete({ ignoreNotFound: true }); throw new ApiError("The file contents do not match its declared type."); }
    generation = metadata.generation;
  }
  const media = { id: ticket.id, name: ticket.fileName, type: ticket.contentType, size: ticket.size, location, uploadedAt: new Date().toISOString(), storage: ticket.mode === "cloud" ? "gcs" : "demo", ...(ticket.mode === "cloud" ? { objectPath: ticket.objectPath, generation, url: `/api/media/${ticket.id}` } : { localId: ticket.id, demo: true }) };
  return completeUpload(ticket.id, media, user);
}

export async function getDownloadURL(media) {
  if (media.storage !== "gcs" || !media.objectPath?.startsWith("uploads/")) throw new ApiError("This evidence is available only in the browser where it was uploaded.", 404);
  const [url] = await bucket().file(media.objectPath, media.generation ? { generation: media.generation } : {}).getSignedUrl({ version: "v4", action: "read", expires: Date.now() + 5 * 60 * 1000, responseDisposition: `inline; filename="${media.name.replace(/[^a-zA-Z0-9._ -]/g, "_")}"` });
  return url;
}

export async function readMediaForAI(media) {
  if (media.storage !== "gcs" || !media.objectPath?.startsWith("uploads/")) return null;
  if (media.size > 12 * 1024 * 1024 || !/^(image\/|video\/|application\/pdf$|text\/plain$)/.test(media.type)) return null;
  const [bytes] = await bucket().file(media.objectPath, media.generation ? { generation: media.generation } : {}).download();
  if (bytes.length > 12 * 1024 * 1024) return null;
  return { inlineData: { mimeType: media.type, data: bytes.toString("base64") } };
}
