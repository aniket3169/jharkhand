export const roles = ["citizen", "authority", "university", "industry", "ngo", "admin"];
export const isAuthority = (user) => ["authority", "admin"].includes(user?.role);
export const isOwner = (user, problem) => Boolean(user && problem?.reporter?.id === user.id);
export const isAssigned = (user, problem) => user?.role === "university" && Boolean(problem?.assignedUniversityId && user.organizationId === problem.assignedUniversityId);
export const canManageProject = (user, problem) => isAuthority(user) || isAssigned(user, problem);
export const canAccessExactLocation = (user, problem) => isAuthority(user) || isOwner(user, problem) || isAssigned(user, problem);

const transitions = {
  Submitted: ["Under review", "Validated", "Needs information", "Rejected"],
  "Under review": ["Validated", "Needs information", "Rejected"],
  "Needs information": ["Submitted", "Under review", "Validated", "Rejected"],
  Validated: ["Assigned", "Rejected"],
  Assigned: ["Solution proposed", "In progress", "Validated"],
  "Solution proposed": ["In progress", "Assigned"],
  "In progress": ["Pilot testing", "Implementation", "Awaiting verification"],
  "Pilot testing": ["In progress", "Implementation", "Awaiting verification"],
  Implementation: ["Awaiting verification", "In progress"],
  "Awaiting verification": ["Resolved", "In progress"],
  Resolved: ["Closed"],
  Closed: [], Rejected: [],
};

export function canTransition(from, to) { return transitions[from]?.includes(to) || false; }

export function canPerform(user, problem, action) {
  if (!user) return false;
  if (["review", "validate", "reject", "clarification", "assign", "resolve", "reassign", "close", "approve-proposal"].includes(action)) return isAuthority(user);
  if (["accept", "decline", "proposal", "team", "milestone", "documents", "progress", "pilot", "resolution", "after-evidence", "verify-location"].includes(action)) return canManageProject(user, problem);
  if (action === "edit") return isAuthority(user) || (isOwner(user, problem) && ["Submitted", "Needs information"].includes(problem.status));
  if (action === "comment") return true;
  if (action === "interest") return ["industry", "ngo", "university", "admin"].includes(user.role) && !["Submitted", "Under review", "Needs information", "Rejected", "Closed"].includes(problem.status);
  return false;
}

export function redactProblem(problem, user, precision = 2) {
  const copy = structuredClone(problem);
  if (canAccessExactLocation(user, problem)) return copy;
  const approximate = (location) => location ? { latitude: Number(location.latitude.toFixed(precision)), longitude: Number(location.longitude.toFixed(precision)), address: `${problem.district}, Jharkhand`, source: "approximate", approximate: true } : null;
  copy.location = approximate(problem.location);
  const redactMedia = (media) => ({ id: media.id, name: media.sample ? media.name : "Private evidence", type: media.type, size: media.size, uploadedAt: media.uploadedAt, sample: Boolean(media.sample), ...(media.sample ? { url: media.url, caption: media.caption } : { private: true }), location: approximate(media.location) });
  copy.evidence = (copy.evidence || []).map(redactMedia);
  copy.afterEvidence = (copy.afterEvidence || []).map(redactMedia);
  copy.documents = (copy.documents || []).map(redactMedia);
  copy.reporter = { name: "Community member" };
  if (copy.verification) {
    delete copy.verification.beforeLocation;
    delete copy.verification.afterLocation;
  }
  return copy;
}
