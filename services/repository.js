import "server-only";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { seedProblems, initialNotifications, defaultSettings, universities, partners, priorities } from "../data/seed.js";
import { isDemoMode } from "../lib/server-auth.js";
import { canPerform, canTransition, isAuthority, canAccessExactLocation, redactProblem } from "../lib/permissions.js";
import { ApiError, parse, problemSchema, locationSchema } from "../lib/validation.js";
import { getLocationVerificationStatus } from "../lib/location.js";

const runtime = globalThis.__jhRepository ||= { queue: Promise.resolve() };
const DATA_FILE = path.join(process.env.DATA_DIRECTORY || (process.env.NODE_ENV === "production" ? "/tmp" : path.join(process.cwd(), ".data")), "portal.json");
const now = () => new Date().toISOString();
const id = () => randomUUID();
const clone = (value) => structuredClone(value);

async function readStore() {
  try { return JSON.parse(await readFile(DATA_FILE, "utf8")); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { version: 1, problems: isDemoMode() ? clone(seedProblems) : [], notifications: isDemoMode() ? clone(initialNotifications) : [], settings: clone(defaultSettings), audit: [], uploads: {}, users: [], nextNumber: 1285 };
  }
}

function mutate(operation) {
  const task = runtime.queue.then(async () => {
    const store = await readStore();
    const result = await operation(store);
    await mkdir(path.dirname(DATA_FILE), { recursive: true });
    const temporary = `${DATA_FILE}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(store, null, 2), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, DATA_FILE);
    return clone(result);
  });
  runtime.queue = task.catch(() => undefined);
  return task;
}

async function read() { await runtime.queue; return readStore(); }
function findProblem(store, problemId) { const problem = store.problems.find((item) => item.id === problemId); if (!problem) throw new ApiError("Challenge not found.", 404); return problem; }
function audit(store, user, action, problemId, previous, value) { store.audit.unshift({ id: id(), actor: user.name, actorId: user.id, role: user.role, action, problemId, previous, value, date: now() }); store.audit = store.audit.slice(0, 5000); }
function timeline(problem, user, title, description = "") { problem.timeline.push({ id: id(), title, description, date: now(), actor: user.name }); }
function notify(store, problem, title, message) { store.notifications.unshift({ id: id(), userId: problem.reporter.id, title, message, date: now(), read: false, href: `/challenges/${problem.id}`, type: "progress" }); }
function text(value, label, minimum = 1, maximum = 3000) { if (typeof value !== "string" || value.trim().length < minimum || value.trim().length > maximum) throw new ApiError(`${label} must contain ${minimum}–${maximum} characters.`); return value.trim(); }
function transition(problem, status) { if (!canTransition(problem.status, status)) throw new ApiError(`Cannot move a ${problem.status.toLowerCase()} challenge to ${status.toLowerCase()}.`, 409); problem.status = status; }
function requireActive(problem) { if (["Resolved", "Closed", "Rejected"].includes(problem.status)) throw new ApiError("This challenge is no longer active.", 409); }

function ownedEvidence(store, references, user, phase, problemId) {
  if (!Array.isArray(references) || references.length > 12) throw new ApiError("Provide up to 12 evidence files.");
  return references.map((reference) => {
    const upload = store.uploads[reference.id];
    if (!upload?.completed || upload.userId !== user.id) throw new ApiError("An evidence file is unavailable or does not belong to you.", 403);
    if (upload.boundProblemId && upload.boundProblemId !== problemId) throw new ApiError("Evidence is already attached to a different challenge.", 409);
    if (phase && upload.phase !== phase) throw new ApiError(`Use ${phase} evidence for this action.`);
    upload.boundProblemId = problemId;
    if (reference.location) upload.media.location = parse(locationSchema, reference.location);
    return clone(upload.media);
  });
}

export async function listProblems(user) { const store = await read(); return store.problems.map((problem) => redactProblem(problem, user, store.settings.publicLocationPrecision)); }
export async function getProblem(problemId, user) { const store = await read(); return redactProblem(findProblem(store, problemId), user, store.settings.publicLocationPrecision); }
export async function getPrivateProblem(problemId) { return clone(findProblem(await read(), problemId)); }

export async function createProblem(body, user) {
  if (!["citizen", "admin"].includes(user.role)) throw new ApiError("Sign in as a citizen to report a challenge.", 403);
  const values = parse(problemSchema, body);
  return mutate((store) => {
    const problemId = `JH-${new Date().getFullYear()}-${String(store.nextNumber++).padStart(6, "0")}`;
    const evidence = ownedEvidence(store, values.evidence, user, "before", problemId);
    const problem = { ...values, id: problemId, summary: values.summary || values.description, reporter: { id: user.id, name: user.name }, status: "Submitted", createdAt: now(), updatedAt: now(), evidence, afterEvidence: [], assignedTo: null, assignedUniversityId: null, department: null, progress: 0, team: [], milestones: [], comments: [], proposals: [], collaborators: [], timeline: [], verification: null, resolution: null, sample: false, aiAnalysis: values.aiAnalysis ? { ...values.aiAnalysis, label: values.aiAnalysis.source === "gemini" ? "AI-generated · requires authority validation" : "Demo guidance · requires authority validation" } : null };
    timeline(problem, user, "Challenge reported", "Citizen confirmed the report and location.");
    store.problems.unshift(problem);
    audit(store, user, "problem.created", problemId, null, { title: problem.title, status: problem.status });
    notify(store, problem, "Your challenge has been submitted", `${problemId} is ready for authority review.`);
    return problem;
  });
}

export async function updateProblem(problemId, action, body, user) {
  return mutate((store) => {
    const problem = findProblem(store, problemId);
    if (!canPerform(user, problem, action)) throw new ApiError("Your role cannot perform this action on this challenge.", 403);
    const previous = { status: problem.status, assignedTo: problem.assignedTo, progress: problem.progress };
    if (!["comment", "close", "edit"].includes(action)) requireActive(problem);
    let title = "Challenge updated";
    let description = "";
    switch (action) {
      case "review": transition(problem, "Under review"); title = "Authority review started"; break;
      case "validate":
        transition(problem, "Validated");
        if (body.priority) { if (!priorities.includes(body.priority)) throw new ApiError("Choose a valid priority."); problem.priority = body.priority; }
        title = "Challenge validated"; description = typeof body.note === "string" ? body.note.slice(0, 2000) : "Ready for institutional collaboration."; break;
      case "reject": description = text(body.reason, "Rejection reason", 5); transition(problem, "Rejected"); title = "Challenge rejected"; problem.rejectionReason = description; break;
      case "clarification": description = text(body.reason || body.text, "Clarification request", 5); transition(problem, "Needs information"); title = "More information requested"; problem.clarification = description; break;
      case "assign": {
        const university = universities.find((item) => item.id === (body.universityId || body.assignedUniversityId) || item.shortName === body.assignedTo || item.name === body.assignedTo);
        if (!university) throw new ApiError("Choose an available university.");
        transition(problem, "Assigned"); problem.assignedUniversityId = university.id; problem.assignedTo = university.shortName; problem.department = text(body.department || university.departments[0], "Department", 2, 150); title = `Assigned to ${university.shortName}`; description = problem.department;
        if (!problem.milestones.length) problem.milestones = ["Community assessment", "Research & design", "Prototype", "Field testing", "Pilot implementation", "Community handover"].map((name) => ({ id: id(), title: name, completed: false, dueDate: "", owner: university.shortName }));
        break;
      }
      case "accept": transition(problem, "In progress"); title = "University accepted the challenge"; break;
      case "decline": description = text(body.reason, "Reason", 5); transition(problem, "Validated"); problem.assignedTo = null; problem.assignedUniversityId = null; title = "Assignment returned for review"; break;
      case "proposal": {
        const proposal = { id: id(), title: text(body.title, "Proposal title", 5, 180), description: text(body.description, "Proposal description", 20, 10000), author: user.name, organizationId: user.organizationId, date: now(), status: "Under review" };
        problem.proposals.push(proposal); if (problem.status === "Assigned") transition(problem, "Solution proposed"); title = "Solution proposal submitted"; description = proposal.title; break;
      }
      case "approve-proposal": {
        const proposal = problem.proposals.find((item) => item.id === body.id);
        if (!proposal) throw new ApiError("Proposal not found.", 404);
        proposal.status = "Approved"; if (problem.status === "Solution proposed") transition(problem, "In progress"); title = "Solution proposal approved"; description = proposal.title; break;
      }
      case "team": problem.team.push({ id: id(), name: text(body.name, "Name", 2, 100), role: text(body.role || "Team member", "Team role", 2, 100), organization: text(body.organization || user.organization || problem.assignedTo || "Community", "Organization", 2, 180) }); title = "Project team updated"; description = `${body.name} joined the team.`; break;
      case "documents": {
        const documents = ownedEvidence(store, body.documents, user, "supporting", problemId);
        if (!documents.length) throw new ApiError("Upload at least one project document.");
        problem.documents ||= [];
        problem.documents.push(...documents.filter((document) => !problem.documents.some((item) => item.id === document.id)));
        title = "Project documents added"; description = `${documents.length} supporting file(s) shared with the project team.`; break;
      }
      case "milestone": {
        if (body.id) {
          const milestone = problem.milestones.find((item) => item.id === body.id);
          if (!milestone) throw new ApiError("Milestone not found.", 404);
          if (typeof body.completed !== "boolean") throw new ApiError("Specify whether the milestone is complete.");
          milestone.completed = body.completed; if (body.title) milestone.title = text(body.title, "Milestone title", 3, 180);
          title = milestone.completed ? "Milestone completed" : "Milestone reopened"; description = milestone.title;
        } else {
          const milestone = { id: id(), title: text(body.title, "Milestone title", 3, 180), completed: false, dueDate: body.dueDate ? text(body.dueDate, "Due date", 10, 10) : "", owner: user.organization || user.name, description: typeof body.description === "string" ? body.description.slice(0, 2000) : "" };
          if (milestone.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(milestone.dueDate)) throw new ApiError("Use a valid due date.");
          problem.milestones.push(milestone); title = "Project milestone added"; description = milestone.title;
        }
        problem.progress = Math.round(problem.milestones.filter((item) => item.completed).length / problem.milestones.length * 100); break;
      }
      case "progress": {
        const progress = Number(body.progress);
        if (!Number.isFinite(progress) || progress < 0 || progress > 100) throw new ApiError("Progress must be between 0 and 100.");
        problem.progress = Math.round(progress);
        if (body.status && body.status !== problem.status) {
          if (!["In progress", "Pilot testing", "Implementation", "Awaiting verification"].includes(body.status)) throw new ApiError("Use the dedicated review or resolution action for this status.");
          transition(problem, body.status);
        }
        title = "Project progress updated"; description = `${problem.progress}% complete`; break;
      }
      case "pilot": transition(problem, "Pilot testing"); title = "Pilot testing started"; break;
      case "resolution": {
        const resolution = { summary: text(body.summary || body.description, "Resolution summary", 20, 5000), impact: text(body.impact, "Impact description", 10, 3000), date: body.date || now().slice(0, 10), peopleImpacted: Number(body.peopleImpacted ?? problem.affectedPopulation), submittedBy: user.id, submittedAt: now() };
        if (!/^\d{4}-\d{2}-\d{2}$/.test(resolution.date) || Number.isNaN(Date.parse(resolution.date))) throw new ApiError("Provide a valid resolution date.");
        if (!Number.isFinite(resolution.peopleImpacted) || resolution.peopleImpacted < 0 || resolution.peopleImpacted > 100000000) throw new ApiError("Provide a valid impact population.");
        if (problem.status !== "Awaiting verification") transition(problem, "Awaiting verification");
        problem.resolution = { ...resolution, description: resolution.summary }; title = "Resolution submitted for review"; description = resolution.summary; break;
      }
      case "after-evidence": {
        if (!["In progress", "Pilot testing", "Implementation", "Awaiting verification"].includes(problem.status)) throw new ApiError("After evidence can be added during implementation or verification.", 409);
        const evidence = ownedEvidence(store, body.evidence, user, "after", problemId);
        if (!evidence.length) throw new ApiError("Upload at least one after-evidence file.");
        const location = body.location ? parse(locationSchema, body.location) : null;
        for (const media of evidence) { if (location) media.location = location; if (!media.location?.confirmed) throw new ApiError("Confirm the location of every after-evidence file."); }
        problem.afterEvidence.push(...evidence.filter((media) => !problem.afterEvidence.some((item) => item.id === media.id))); problem.verification = null; title = "After evidence uploaded"; description = `${evidence.length} file(s) submitted for location review.`; break;
      }
      case "verify-location": {
        if (!problem.afterEvidence.length) throw new ApiError("Upload after evidence before checking the location.");
        const checks = problem.afterEvidence.filter((media) => media.type?.startsWith("image/") || media.type?.startsWith("video/")).map((media) => ({ ...getLocationVerificationStatus(problem.location, media.location, store.settings.locationThresholdMeters), mediaId: media.id }));
        if (!checks.length) throw new ApiError("At least one after image or video is required.");
        const worst = checks.find((check) => !check.verified) || checks.reduce((a, b) => a.distanceMeters > b.distanceMeters ? a : b);
        problem.verification = { ...worst, checks, verifiedAt: now(), verifiedBy: user.id, evidenceIds: problem.afterEvidence.map((media) => media.id) }; title = problem.verification.verified ? "Location comparison passed" : "Location review required"; description = problem.verification.note; break;
      }
      case "resolve": {
        if (!problem.resolution?.summary || !problem.resolution?.impact || !problem.afterEvidence.length) throw new ApiError("Resolution details, impact, and after evidence are required.", 409);
        if (!problem.verification?.verified) {
          if (user.role !== "admin") throw new ApiError("Location verification must pass before resolution.", 409);
          const reason = text(body.overrideReason, "Admin override reason", 20, 2000);
          problem.verification = { ...(problem.verification || {}), verified: false, status: "overridden", overriddenBy: user.id, overrideReason: reason, overriddenAt: now() };
          audit(store, user, "location.override", problemId, null, reason);
        }
        transition(problem, "Resolved"); problem.progress = 100; problem.resolution.resolvedAt = now(); problem.resolution.approvedBy = user.id; title = "Challenge resolved"; description = problem.resolution.impact; break;
      }
      case "close": transition(problem, "Closed"); title = "Challenge closed"; break;
      case "comment": problem.comments.push({ id: id(), author: user.name, authorId: user.id, role: user.role, text: text(body.text, "Comment", 2, 3000), date: now() }); title = "Discussion updated"; break;
      case "interest": {
        if (problem.collaborators.some((item) => item.userId === user.id || (user.organizationId && item.id === user.organizationId))) throw new ApiError("Your interest is already registered.", 409);
        problem.collaborators.push({ id: user.organizationId || id(), userId: user.id, name: user.organization || user.name, type: user.role, support: text(body.support || "Technical assistance", "Support", 2, 200), message: typeof body.message === "string" ? body.message.slice(0, 2000) : "", date: now(), status: "Interested" }); title = "New collaboration interest"; description = `${user.organization || user.name} offered ${body.support || "technical assistance"}.`; break;
      }
      case "edit": {
        const allowed = {};
        if (body.title !== undefined) allowed.title = text(body.title, "Title", 8, 180);
        if (body.description !== undefined) allowed.description = text(body.description, "Description", 20, 10000);
        if (body.summary !== undefined) allowed.summary = text(body.summary, "Summary", 10, 2000);
        Object.assign(problem, allowed); title = "Report details updated"; if (problem.status === "Needs information") transition(problem, "Submitted"); break;
      }
      default: throw new ApiError("Unknown challenge action.");
    }
    problem.updatedAt = now();
    if (action !== "comment") timeline(problem, user, title, description);
    audit(store, user, `problem.${action}`, problemId, previous, { status: problem.status, assignedTo: problem.assignedTo, progress: problem.progress, description });
    if (!["comment", "team", "interest"].includes(action)) notify(store, problem, title, description || `${problem.id} has been updated.`);
    return redactProblem(problem, user, store.settings.publicLocationPrecision);
  });
}

export async function registerUpload(ticket) { return mutate((store) => { store.uploads[ticket.id] = ticket; return ticket; }); }
export async function getUpload(uploadId, user) { const upload = (await read()).uploads[uploadId]; if (!upload || upload.userId !== user.id) throw new ApiError("Upload not found.", 404); return clone(upload); }
export async function completeUpload(uploadId, media, user) { return mutate((store) => { const upload = store.uploads[uploadId]; if (!upload || upload.userId !== user.id) throw new ApiError("Upload not found.", 404); if (upload.completed) return upload.media; upload.completed = true; upload.media = media; audit(store, user, "evidence.uploaded", upload.problemId || "draft", null, { id: media.id, name: media.name, storage: media.storage }); return media; }); }
export async function ownedMedia(references, user) { const store = await read(); return references.map((reference) => { const upload = store.uploads[reference.id]; if (!upload?.completed || upload.userId !== user.id) throw new ApiError("Evidence is unavailable or belongs to another user.", 403); return clone(upload.media); }); }
export async function mediaForDownload(uploadId, user) { const store = await read(); const upload = store.uploads[uploadId]; if (!upload?.completed) throw new ApiError("Evidence not found.", 404); if (upload.userId !== user.id && (!upload.boundProblemId || !canAccessExactLocation(user, findProblem(store, upload.boundProblemId)))) throw new ApiError("You cannot access this evidence.", 403); return clone(upload.media); }
export async function getSettings() { return clone((await read()).settings); }
export async function updateSettings(body, user) {
  if (user.role !== "admin") throw new ApiError("Administrator access required.", 403);
  return mutate((store) => {
    const previous = clone(store.settings);
    if (body.locationThresholdMeters !== undefined) { if (![25, 50, 100, 250].includes(Number(body.locationThresholdMeters))) throw new ApiError("Choose a location threshold of 25, 50, 100, or 250 metres."); store.settings.locationThresholdMeters = Number(body.locationThresholdMeters); }
    if (body.publicLocationPrecision !== undefined) { if (![1, 2].includes(Number(body.publicLocationPrecision))) throw new ApiError("Public precision must be 1 or 2 decimal places."); store.settings.publicLocationPrecision = Number(body.publicLocationPrecision); }
    if (body.platformName) store.settings.platformName = text(body.platformName, "Platform name", 3, 100);
    if (body.notificationPreferences) store.settings.notificationPreferences = { email: Boolean(body.notificationPreferences.email), inApp: Boolean(body.notificationPreferences.inApp) };
    audit(store, user, "settings.updated", null, previous, store.settings); return store.settings;
  });
}
export async function getNotifications(user) { return (await read()).notifications.filter((item) => item.userId === user.id); }
export async function readNotifications(body, user) { return mutate((store) => { for (const item of store.notifications) if (item.userId === user.id && (body.all || body.id === item.id || body.ids?.includes(item.id))) item.read = true; return store.notifications.filter((item) => item.userId === user.id); }); }
export async function getAudit(user) { if (user.role !== "admin") throw new ApiError("Administrator access required.", 403); return (await read()).audit; }
export async function getOrganizations() { return { universities, partners }; }

export async function createAccount({ name, email, passwordHash, role = "citizen", organization = "Community member" }) {
  return mutate((store) => {
    store.users ||= [];
    if (store.users.some((user) => user.email === email)) throw new ApiError("An account with this email already exists.", 409);
    const account = { id: `${role}-${id()}`, name, email, passwordHash, role, organization, organizationId: null, createdAt: now(), demo: false };
    store.users.push(account);
    const { passwordHash: omitted, ...user } = account;
    store.notifications.unshift({ id: id(), userId: user.id, title: "Welcome to Jharkhand Innovation Connect", message: "Your account is ready. Report a local challenge or explore community projects.", date: now(), read: false, href: "/report", type: "info" });
    return user;
  });
}
export async function accountByEmail(email) { return (await read()).users?.find((user) => user.email === email) || null; }
export async function accountById(userId) { const account = (await read()).users?.find((user) => user.id === userId); if (!account) return null; const { passwordHash, ...user } = account; return user; }
export async function updateAccount(user, body) { return mutate((store) => { const account = store.users?.find((item) => item.id === user.id); if (!account) throw new ApiError("Account not found.", 404); account.name = text(body.name || account.name, "Name", 2, 80); if (body.district) account.district = text(body.district, "District", 2, 80); const { passwordHash, ...profile } = account; return profile; }); }
