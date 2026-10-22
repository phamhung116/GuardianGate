// Policy enforcement point for every GuardianGate flow. Each function takes the server-derived
// TideActor and returns a PolicyResult; nothing here trusts client-supplied roles or approvers.
// Denials never include record content and always append an audit event.

import type { TideActor } from "@/server/auth/tide";
import { appendAudit, auditEvents } from "@/server/policy/audit";
import {
  RECORD_GROUPS,
  getState,
  now,
  userBySubject,
  type AccessRequest,
  type ActivePolicy,
  type AuditEvent,
  type ChildRecords,
  type Decision,
  type PolicyChangeType,
  type PolicyProposal,
  type RecordGroup,
} from "@/server/policy/store";

export type DenyReason =
  | "unauthenticated"
  | "role_not_permitted"
  | "admin_no_override"
  | "not_found"
  | "invalid_input"
  | "not_assigned"
  | "consultation_inactive"
  | "not_guardian"
  | "guardian_unverified"
  | "self_approval"
  | "already_decided"
  | "not_pending"
  | "approval_pending"
  | "rejected"
  | "expired"
  | "revoked"
  | "no_grant"
  | "group_not_granted"
  | "same_doctor"
  | "proposer_cannot_approve"
  | "duplicate_role_approver"
  | "duration_exceeds_policy";

export type PolicyResult<T> =
  | { ok: true; data: T; status?: number }
  | { ok: false; status: number; reason: DenyReason; message: string; details?: Record<string, unknown> };

const ROLE = {
  doctor: "doctor",
  guardian: "guardian",
  admin: "admin",
  privacy: "privacy_officer",
  compliance: "compliance_approver",
} as const;

const hasRole = (actor: TideActor, role: string) => actor.roles.includes(role);

function deny<T>(
  actor: TideActor | null,
  status: number,
  reason: DenyReason,
  message: string,
  context: {
    childId?: string | null;
    accessRequestId?: string | null;
    policyProposalId?: string | null;
    recordGroups?: RecordGroup[];
    action: string;
    details?: Record<string, unknown>;
  },
): PolicyResult<T> {
  appendAudit({
    eventType: context.policyProposalId && !context.accessRequestId ? "policy_rejected" : "access_denied",
    actor,
    childId: context.childId,
    accessRequestId: context.accessRequestId,
    policyProposalId: context.policyProposalId,
    recordGroups: context.recordGroups,
    detail: { action: context.action, reason, ...(context.details ?? {}) },
  });
  return { ok: false, status, reason, message, ...(context.details ? { details: context.details } : {}) };
}

function primaryRole(actor: TideActor): string {
  return Object.values(ROLE).find((role) => hasRole(actor, role)) ?? "none";
}

function parseGroups(value: unknown): RecordGroup[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const groups = [...new Set(value)];
  return groups.every((group) => RECORD_GROUPS.includes(group as RecordGroup)) ? (groups as RecordGroup[]) : null;
}

function parseDuration(value: unknown): number | null {
  const minutes = Number(value);
  return Number.isFinite(minutes) && minutes >= 1 ? Math.floor(minutes) : null;
}

const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

function verifiedGuardians(childId: string): string[] {
  return getState()
    .guardianLinks.filter((link) => link.childId === childId && link.verified)
    .map((link) => link.guardianSubject);
}

function isVerifiedGuardian(actor: TideActor, childId: string): boolean {
  return hasRole(actor, ROLE.guardian) && verifiedGuardians(childId).includes(actor.subject);
}

function activeConsultationFor(subject: string, childId: string) {
  return getState().consultations.find(
    (c) => c.childId === childId && c.status === "active" && c.clinicianSubjects.includes(subject),
  );
}

/** Applies expiry lazily so expiration is observable at the next protected access. */
function refreshExpiry(request: AccessRequest): void {
  if (request.status !== "approved" && request.status !== "pending") return;

  const consultationEnded =
    request.kind === "ordinary" &&
    request.status === "approved" &&
    !getState().consultations.some((c) => c.id === request.consultationId && c.status === "active");

  if (now().getTime() >= Date.parse(request.expiresAt) || consultationEnded) {
    request.status = "expired";
    appendAudit({
      eventType: "request_expired",
      actor: null,
      childId: request.childId,
      accessRequestId: request.id,
      recordGroups: request.recordGroups,
      detail: {
        kind: request.kind,
        expiredAt: request.expiresAt,
        cause: consultationEnded ? "consultation_ended" : "time_limit",
      },
    });
  }
}

function refreshAll(): void {
  getState().requests.forEach(refreshExpiry);
}

/** Explains what is still missing before a request can release data. */
export function missingApprovals(request: AccessRequest): string[] {
  if (request.status !== "pending") return [];
  const approvers = request.decisions.filter((d) => d.decision === "approved").map((d) => d.approverSubject);
  switch (request.kind) {
    case "ordinary":
      return ["guardian_approval"];
    case "external_share":
      return verifiedGuardians(request.childId)
        .filter((guardian) => !approvers.includes(guardian))
        .map((guardian) => `guardian_approval:${guardian}`);
    case "emergency":
      return ["independent_doctor_confirmation"];
  }
}

export interface RequestView extends AccessRequest {
  childDisplayName: string;
  requesterDisplayName: string;
  missingApprovals: string[];
  active: boolean;
}

function view(request: AccessRequest): RequestView {
  return {
    ...request,
    decisions: [...request.decisions],
    recordGroups: [...request.recordGroups],
    childDisplayName: getState().children.find((c) => c.id === request.childId)?.displayName ?? "unknown",
    requesterDisplayName: userBySubject(request.requesterSubject)?.displayName ?? request.requesterSubject,
    missingApprovals: missingApprovals(request),
    active: request.status === "approved" && now().getTime() < Date.parse(request.expiresAt),
  };
}

function newRequest(
  fields: Omit<AccessRequest, "id" | "status" | "approvedAt" | "revokedAt" | "createdAt" | "decisions" | "reviewRequired" | "expiresAt">,
): AccessRequest {
  const created = now();
  const request: AccessRequest = {
    ...fields,
    id: crypto.randomUUID(),
    status: "pending",
    expiresAt: new Date(created.getTime() + fields.durationMinutes * 60_000).toISOString(),
    approvedAt: null,
    revokedAt: null,
    createdAt: created.toISOString(),
    decisions: [],
    reviewRequired: false,
  };
  getState().requests.push(request);
  return request;
}

// ---------------------------------------------------------------------------------------------
// Children visible to the actor

export function listChildren(actor: TideActor) {
  const state = getState();
  const visible = state.children.filter(
    (child) => isVerifiedGuardian(actor, child.id) || (hasRole(actor, ROLE.doctor) && activeConsultationFor(actor.subject, child.id)),
  );
  return visible.map((child) => ({
    ...child,
    guardianVerified: isVerifiedGuardian(actor, child.id),
    activeConsultationId: activeConsultationFor(actor.subject, child.id)?.id ?? null,
  }));
}

// ---------------------------------------------------------------------------------------------
// Flow 1: ordinary consultation access

export interface OrdinaryRequestInput {
  childId?: unknown;
  consultationId?: unknown;
  recordGroups?: unknown;
  purpose?: unknown;
  durationMinutes?: unknown;
}

export function createOrdinaryRequest(actor: TideActor, input: OrdinaryRequestInput): PolicyResult<RequestView> {
  const action = "create_ordinary_request";
  const childId = typeof input.childId === "string" ? input.childId : null;

  if (hasRole(actor, ROLE.admin) && !hasRole(actor, ROLE.doctor)) {
    return deny(actor, 403, "admin_no_override", "Administrators cannot request patient records.", { childId, action });
  }
  if (!hasRole(actor, ROLE.doctor)) {
    return deny(actor, 403, "role_not_permitted", "Only doctors can request consultation access.", { childId, action });
  }

  const groups = parseGroups(input.recordGroups);
  const duration = parseDuration(input.durationMinutes);
  if (!childId || !groups || !nonEmpty(input.purpose) || !duration) {
    return deny(actor, 422, "invalid_input", "childId, recordGroups, purpose and durationMinutes are required.", {
      childId,
      action,
      details: { allowedGroups: RECORD_GROUPS },
    });
  }

  const policy = getState().policy;
  if (duration > policy.ordinaryMaxMinutes) {
    return deny(actor, 422, "duration_exceeds_policy", "Requested duration exceeds the active policy.", {
      childId,
      recordGroups: groups,
      action,
      details: { maxMinutes: policy.ordinaryMaxMinutes, policyVersion: policy.version },
    });
  }

  const consultation = getState().consultations.find(
    (c) => c.childId === childId && (input.consultationId ? c.id === input.consultationId : true) && c.clinicianSubjects.includes(actor.subject),
  );
  if (!consultation) {
    return deny(actor, 403, "not_assigned", "Doctor is not assigned to a consultation for this child.", {
      childId,
      recordGroups: groups,
      action,
    });
  }
  if (consultation.status !== "active") {
    return deny(actor, 403, "consultation_inactive", "The consultation is not active.", {
      childId,
      recordGroups: groups,
      action,
    });
  }

  const request = newRequest({
    kind: "ordinary",
    childId,
    requesterSubject: actor.subject,
    consultationId: consultation.id,
    purpose: input.purpose.trim(),
    recipientName: null,
    emergencyReason: null,
    recordGroups: groups,
    durationMinutes: duration,
  });
  appendAudit({
    eventType: "request_created",
    actor,
    childId,
    accessRequestId: request.id,
    recordGroups: groups,
    detail: { kind: "ordinary", purpose: request.purpose, durationMinutes: duration, consultationId: consultation.id },
  });
  return { ok: true, status: 201, data: view(request) };
}

// ---------------------------------------------------------------------------------------------
// Flow 2: external share (all verified guardians must approve)

export interface ExternalShareInput {
  childId?: unknown;
  recipientName?: unknown;
  recordGroups?: unknown;
  purpose?: unknown;
  durationMinutes?: unknown;
}

export function createExternalShare(actor: TideActor, input: ExternalShareInput): PolicyResult<RequestView> {
  const action = "create_external_share";
  const childId = typeof input.childId === "string" ? input.childId : null;

  if (!hasRole(actor, ROLE.guardian)) {
    return deny(actor, 403, hasRole(actor, ROLE.admin) ? "admin_no_override" : "role_not_permitted", "Only a verified guardian can start an external share.", { childId, action });
  }
  const groups = parseGroups(input.recordGroups);
  const duration = parseDuration(input.durationMinutes);
  if (!childId || !groups || !nonEmpty(input.purpose) || !nonEmpty(input.recipientName) || !duration) {
    return deny(actor, 422, "invalid_input", "childId, recipientName, recordGroups, purpose and durationMinutes are required.", { childId, action });
  }
  if (!isVerifiedGuardian(actor, childId)) {
    return deny(actor, 403, "not_guardian", "Actor is not a verified guardian of this child.", { childId, recordGroups: groups, action });
  }

  const request = newRequest({
    kind: "external_share",
    childId,
    requesterSubject: actor.subject,
    consultationId: null,
    purpose: input.purpose.trim(),
    recipientName: input.recipientName.trim(),
    emergencyReason: null,
    recordGroups: groups,
    durationMinutes: duration,
  });
  appendAudit({
    eventType: "request_created",
    actor,
    childId,
    accessRequestId: request.id,
    recordGroups: groups,
    detail: {
      kind: "external_share",
      recipientName: request.recipientName,
      purpose: request.purpose,
      durationMinutes: duration,
      requiredApprovers: verifiedGuardians(childId),
    },
  });
  return { ok: true, status: 201, data: view(request) };
}

/** Released package for an approved, unexpired external share; visible to the child's guardians. */
export function getExternalShare(actor: TideActor, requestId: string): PolicyResult<{ request: RequestView; released: Partial<ChildRecords> | null }> {
  const action = "read_external_share";
  const request = getState().requests.find((r) => r.id === requestId && r.kind === "external_share");
  if (!request) return deny(actor, 404, "not_found", "External share not found.", { accessRequestId: requestId, action });
  if (!isVerifiedGuardian(actor, request.childId) && !hasRole(actor, ROLE.privacy)) {
    return deny(actor, 403, "not_guardian", "Only the child's verified guardians can view this share.", { childId: request.childId, accessRequestId: request.id, action });
  }
  refreshExpiry(request);
  const releasable = request.status === "approved" && isVerifiedGuardian(actor, request.childId);
  return {
    ok: true,
    data: { request: view(request), released: releasable ? pickGroups(request.childId, request.recordGroups) : null },
  };
}

// ---------------------------------------------------------------------------------------------
// Flow 3: emergency (two distinct doctors, summary only, short window, post-event review)

export interface EmergencyInput {
  childId?: unknown;
  reason?: unknown;
}

export function createEmergencyRequest(actor: TideActor, input: EmergencyInput): PolicyResult<RequestView> {
  const action = "create_emergency_request";
  const childId = typeof input.childId === "string" ? input.childId : null;
  if (!hasRole(actor, ROLE.doctor)) {
    return deny(actor, 403, hasRole(actor, ROLE.admin) ? "admin_no_override" : "role_not_permitted", "Only doctors can request emergency access.", { childId, action });
  }
  if (!childId || !nonEmpty(input.reason)) {
    return deny(actor, 422, "invalid_input", "childId and reason are required.", { childId, action });
  }
  if (!getState().children.some((c) => c.id === childId)) {
    return deny(actor, 404, "not_found", "Child not found.", { action });
  }

  const request = newRequest({
    kind: "emergency",
    childId,
    requesterSubject: actor.subject,
    consultationId: null,
    purpose: "emergency_care",
    recipientName: null,
    emergencyReason: input.reason.trim(),
    recordGroups: ["summary"],
    durationMinutes: getState().policy.emergencyWindowMinutes,
  });
  appendAudit({
    eventType: "request_created",
    actor,
    childId,
    accessRequestId: request.id,
    recordGroups: ["summary"],
    detail: { kind: "emergency", reason: request.emergencyReason, windowMinutes: request.durationMinutes },
  });
  return { ok: true, status: 201, data: view(request) };
}

// ---------------------------------------------------------------------------------------------
// Decisions on access requests (all three kinds)

export interface DecisionInput {
  decision?: unknown;
  note?: unknown;
}

export function decideRequest(actor: TideActor, requestId: string, input: DecisionInput): PolicyResult<RequestView> {
  const action = "decide_request";
  const request = getState().requests.find((r) => r.id === requestId);
  if (!request) return deny(actor, 404, "not_found", "Request not found.", { accessRequestId: requestId, action });

  const ctx = { childId: request.childId, accessRequestId: request.id, recordGroups: request.recordGroups, action };
  const decision = input.decision;
  if (decision !== "approved" && decision !== "rejected") {
    return deny(actor, 422, "invalid_input", "decision must be 'approved' or 'rejected'.", ctx);
  }
  if (hasRole(actor, ROLE.admin) && !hasRole(actor, ROLE.guardian) && !hasRole(actor, ROLE.doctor)) {
    return deny(actor, 403, "admin_no_override", "Administrators cannot approve record access.", ctx);
  }

  refreshExpiry(request);
  if (request.status !== "pending") {
    return deny(actor, 409, "not_pending", `Request is ${request.status}.`, { ...ctx, details: { status: request.status } });
  }
  // Requester/approver separation applies to doctor-initiated requests. A guardian who starts an
  // external share still has to record their own approval explicitly, alongside the other guardian.
  if (request.kind !== "external_share" && request.requesterSubject === actor.subject) {
    return deny(actor, 403, request.kind === "emergency" ? "same_doctor" : "self_approval", "The requester cannot approve their own request.", ctx);
  }
  if (request.decisions.some((d) => d.approverSubject === actor.subject)) {
    return deny(actor, 409, "already_decided", "This approver has already decided.", ctx);
  }

  if (request.kind === "emergency") {
    if (!hasRole(actor, ROLE.doctor)) {
      return deny(actor, 403, "role_not_permitted", "Emergency access needs a second, distinct doctor.", ctx);
    }
  } else if (!hasRole(actor, ROLE.guardian) || !getState().guardianLinks.some((l) => l.childId === request.childId && l.guardianSubject === actor.subject)) {
    return deny(actor, 403, "not_guardian", "Only a legal guardian of this child can decide.", ctx);
  } else if (!isVerifiedGuardian(actor, request.childId)) {
    return deny(actor, 403, "guardian_unverified", "Guardian is not verified.", ctx);
  }

  const note = nonEmpty(input.note) ? input.note.trim() : null;
  const decidedAt = now();
  request.decisions.push({ approverSubject: actor.subject, approverRole: primaryRole(actor), decision: decision as Decision, decidedAt: decidedAt.toISOString(), note });
  appendAudit({
    eventType: "approval_recorded",
    actor,
    childId: request.childId,
    accessRequestId: request.id,
    recordGroups: request.recordGroups,
    detail: { kind: request.kind, decision, note, requesterSubject: request.requesterSubject },
  });

  if (decision === "rejected") {
    request.status = "rejected";
    return { ok: true, data: view(request) };
  }

  const grant = (expiresAt: Date) => {
    request.status = "approved";
    request.approvedAt = decidedAt.toISOString();
    request.expiresAt = expiresAt.toISOString();
  };

  switch (request.kind) {
    case "ordinary": {
      grant(new Date(decidedAt.getTime() + request.durationMinutes * 60_000));
      appendAudit({
        eventType: "access_granted",
        actor,
        childId: request.childId,
        accessRequestId: request.id,
        recordGroups: request.recordGroups,
        detail: { kind: "ordinary", grantee: request.requesterSubject, purpose: request.purpose, expiresAt: request.expiresAt },
      });
      break;
    }
    case "external_share": {
      if (missingApprovals(request).length > 0) break;
      grant(new Date(decidedAt.getTime() + request.durationMinutes * 60_000));
      appendAudit({
        eventType: "external_share_released",
        actor,
        childId: request.childId,
        accessRequestId: request.id,
        recordGroups: request.recordGroups,
        detail: {
          recipientName: request.recipientName,
          purpose: request.purpose,
          expiresAt: request.expiresAt,
          approvers: request.decisions.map((d) => d.approverSubject),
        },
      });
      break;
    }
    case "emergency": {
      grant(new Date(decidedAt.getTime() + getState().policy.emergencyWindowMinutes * 60_000));
      request.reviewRequired = true;
      const doctors = [request.requesterSubject, actor.subject];
      appendAudit({
        eventType: "emergency_activated",
        actor,
        childId: request.childId,
        accessRequestId: request.id,
        recordGroups: ["summary"],
        detail: { reason: request.emergencyReason, doctors, expiresAt: request.expiresAt },
      });
      appendAudit({
        eventType: "emergency_review_required",
        actor: null,
        childId: request.childId,
        accessRequestId: request.id,
        recordGroups: ["summary"],
        detail: { reason: request.emergencyReason, doctors, expiresAt: request.expiresAt, guardiansToNotify: verifiedGuardians(request.childId) },
      });
      break;
    }
  }
  return { ok: true, data: view(request) };
}

export function revokeRequest(actor: TideActor, requestId: string, input: { note?: unknown } = {}): PolicyResult<RequestView> {
  const action = "revoke_request";
  const request = getState().requests.find((r) => r.id === requestId);
  if (!request) return deny(actor, 404, "not_found", "Request not found.", { accessRequestId: requestId, action });
  const ctx = { childId: request.childId, accessRequestId: request.id, recordGroups: request.recordGroups, action };

  const canRevoke = isVerifiedGuardian(actor, request.childId) || request.requesterSubject === actor.subject || hasRole(actor, ROLE.privacy);
  if (!canRevoke) return deny(actor, 403, hasRole(actor, ROLE.admin) ? "admin_no_override" : "role_not_permitted", "Actor cannot revoke this request.", ctx);

  refreshExpiry(request);
  if (request.status !== "approved" && request.status !== "pending") {
    return deny(actor, 409, "not_pending", `Request is ${request.status}.`, { ...ctx, details: { status: request.status } });
  }
  request.status = "revoked";
  request.revokedAt = now().toISOString();
  appendAudit({
    eventType: "request_revoked",
    actor,
    childId: request.childId,
    accessRequestId: request.id,
    recordGroups: request.recordGroups,
    detail: { kind: request.kind, note: nonEmpty(input.note) ? input.note.trim() : null },
  });
  return { ok: true, data: view(request) };
}

export function listRequests(actor: TideActor, filter: { kind?: string; childId?: string } = {}): PolicyResult<RequestView[]> {
  refreshAll();
  let visible: AccessRequest[];
  if (hasRole(actor, ROLE.privacy) || hasRole(actor, ROLE.compliance)) {
    visible = getState().requests;
  } else if (hasRole(actor, ROLE.guardian) || hasRole(actor, ROLE.doctor)) {
    visible = getState().requests.filter(
      (r) =>
        r.requesterSubject === actor.subject ||
        r.decisions.some((d) => d.approverSubject === actor.subject) ||
        (r.kind !== "emergency" && isVerifiedGuardian(actor, r.childId)) ||
        // Pending emergencies are shown to other doctors so they can confirm independently.
        (r.kind === "emergency" && hasRole(actor, ROLE.doctor) && r.status === "pending"),
    );
  } else {
    return deny(actor, 403, hasRole(actor, ROLE.admin) ? "admin_no_override" : "role_not_permitted", "Actor cannot list access requests.", { action: "list_requests" });
  }
  const filtered = visible.filter((r) => (!filter.kind || r.kind === filter.kind) && (!filter.childId || r.childId === filter.childId));
  return { ok: true, data: filtered.map(view).reverse() };
}

export function getRequest(actor: TideActor, requestId: string): PolicyResult<RequestView> {
  const result = listRequests(actor);
  if (!result.ok) return result;
  const found = result.data.find((r) => r.id === requestId);
  return found ? { ok: true, data: found } : deny(actor, 404, "not_found", "Request not found.", { accessRequestId: requestId, action: "get_request" });
}

// ---------------------------------------------------------------------------------------------
// Protected record read (least privilege)

function pickGroups(childId: string, groups: RecordGroup[], emergency = false): Partial<ChildRecords> {
  const records = getState().records[childId];
  const out: Partial<ChildRecords> = {};
  for (const group of groups) {
    if (group === "summary" && emergency) {
      const { allergies, currentMedications, emergencyNotes, updatedAt } = records.summary;
      out.summary = { allergies, currentMedications, emergencyNotes, updatedAt };
    } else {
      (out as Record<string, unknown>)[group] = structuredClone(records[group]);
    }
  }
  return out;
}

export interface RecordAccessView {
  childId: string;
  childDisplayName: string;
  grantedGroups: RecordGroup[];
  grants: { requestId: string; kind: "ordinary" | "emergency"; recordGroups: RecordGroup[]; purpose: string; expiresAt: string }[];
  data: Partial<ChildRecords>;
}

export function readChildRecord(actor: TideActor, childId: string, options: { groups?: unknown } = {}): PolicyResult<RecordAccessView> {
  const action = "read_record";
  const state = getState();

  if (hasRole(actor, ROLE.admin) && !hasRole(actor, ROLE.doctor)) {
    return deny(actor, 403, "admin_no_override", "Administrators have no patient-record access.", { childId, action });
  }
  if (!hasRole(actor, ROLE.doctor)) {
    return deny(actor, 403, "role_not_permitted", "Record content is released only to doctors with an active grant.", { childId, action });
  }
  const child = state.children.find((c) => c.id === childId);
  if (!child) return deny(actor, 404, "not_found", "Record not found or not permitted.", { action });

  const requestedGroups = options.groups === undefined ? null : parseGroups(options.groups);
  if (options.groups !== undefined && !requestedGroups) {
    return deny(actor, 422, "invalid_input", "groups must be a subset of the record groups.", { childId, action });
  }

  const mine = state.requests.filter((r) => r.childId === childId && r.requesterSubject === actor.subject && r.kind !== "external_share");
  mine.forEach(refreshExpiry);

  const assigned = activeConsultationFor(actor.subject, childId);
  const grants = mine.filter((r) => {
    if (r.status !== "approved" || now().getTime() >= Date.parse(r.expiresAt)) return false;
    // Ordinary grants also require the doctor to still be assigned to that active consultation.
    return r.kind === "emergency" || (assigned && r.consultationId === assigned.id);
  });

  if (grants.length === 0) {
    const latest = [...mine].reverse()[0];
    const reason: DenyReason = !assigned && !mine.some((r) => r.kind === "emergency")
      ? "not_assigned"
      : latest?.status === "pending"
        ? "approval_pending"
        : latest?.status === "rejected"
          ? "rejected"
          : latest?.status === "expired"
            ? "expired"
            : latest?.status === "revoked"
              ? "revoked"
              : "no_grant";
    return deny(actor, 403, reason, "No active grant for this child; record remains locked.", {
      childId,
      accessRequestId: latest?.id ?? null,
      recordGroups: requestedGroups ?? [],
      action,
      details: { latestRequestId: latest?.id ?? null, latestStatus: latest?.status ?? null, missingApprovals: latest ? missingApprovals(latest) : [] },
    });
  }

  const ordinaryGroups = new Set(grants.filter((g) => g.kind === "ordinary").flatMap((g) => g.recordGroups));
  const emergencyOnly = grants.every((g) => g.kind === "emergency");
  const grantedGroups = RECORD_GROUPS.filter((g) => ordinaryGroups.has(g) || (g === "summary" && grants.some((x) => x.kind === "emergency")));

  if (requestedGroups) {
    const notGranted = requestedGroups.filter((g) => !grantedGroups.includes(g));
    if (notGranted.length > 0) {
      return deny(actor, 403, "group_not_granted", "Requested groups exceed the active grant.", {
        childId,
        recordGroups: requestedGroups,
        action,
        details: { notGranted, grantedGroups },
      });
    }
  }
  const released = requestedGroups ?? grantedGroups;

  appendAudit({
    eventType: "record_accessed",
    actor,
    childId,
    accessRequestId: grants[0].id,
    recordGroups: released,
    detail: { grantIds: grants.map((g) => g.id), kinds: [...new Set(grants.map((g) => g.kind))] },
  });

  return {
    ok: true,
    data: {
      childId,
      childDisplayName: child.displayName,
      grantedGroups,
      grants: grants.map((g) => ({ requestId: g.id, kind: g.kind as "ordinary" | "emergency", recordGroups: [...g.recordGroups], purpose: g.purpose, expiresAt: g.expiresAt })),
      data: pickGroups(childId, released, emergencyOnly),
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Flow 4: policy proposals with Privacy + Compliance quorum

const POLICY_CHANGE_TYPES: readonly PolicyChangeType[] = ["access_duration", "emergency_window", "data_scope", "governance_rule"];

/** Product invariants that no proposal, even with quorum, may change. */
const FORBIDDEN_KEYS: Record<string, string> = {
  adminRecordAccess: "admin_no_override",
  adminOverrideAllRecords: "admin_no_override",
  grantAdminAccess: "admin_no_override",
  globalAccess: "no_global_grant",
  disableGuardianApproval: "guardian_approval_required",
  guardianApprovalRequired: "guardian_approval_required",
  externalShareApprovals: "two_guardians_for_external_share",
  emergencyDoctors: "two_doctors_for_emergency",
  deleteAudit: "audit_append_only",
  auditRetention: "audit_append_only",
  quorumRoles: "privacy_and_compliance_quorum",
};

function invariantViolations(changeType: PolicyChangeType, value: Record<string, unknown>, proposer: string): string[] {
  const violations = new Set<string>();
  for (const [key, rule] of Object.entries(FORBIDDEN_KEYS)) {
    if (key in value) violations.add(rule);
  }
  if (Object.values(value).some((v) => v === proposer)) violations.add("no_self_grant");
  if (changeType === "access_duration" && !(Number(value.ordinaryMaxMinutes) >= 1 && Number(value.ordinaryMaxMinutes) <= 24 * 60)) {
    violations.add("invalid_ordinary_max_minutes");
  }
  if (changeType === "emergency_window" && !(Number(value.emergencyWindowMinutes) >= 1 && Number(value.emergencyWindowMinutes) <= 120)) {
    violations.add("invalid_emergency_window_minutes");
  }
  return [...violations];
}

export interface ProposalView extends PolicyProposal {
  missingApprovals: string[];
}

function proposalView(p: PolicyProposal): ProposalView {
  const approvedRoles = p.approvals.filter((a) => a.decision === "approved").map((a) => a.approverRole);
  const missing = p.status === "proposed" ? [ROLE.privacy, ROLE.compliance].filter((r) => !approvedRoles.includes(r)) : [];
  return { ...p, approvals: [...p.approvals], missingApprovals: missing };
}

export function listPolicy(actor: TideActor): PolicyResult<{ activePolicy: ActivePolicy; history: ActivePolicy[]; proposals: ProposalView[] }> {
  if (![ROLE.admin, ROLE.privacy, ROLE.compliance].some((r) => hasRole(actor, r))) {
    return deny(actor, 403, "role_not_permitted", "Only governance roles can view policy proposals.", { action: "list_policy" });
  }
  const state = getState();
  return { ok: true, data: { activePolicy: { ...state.policy }, history: [...state.policyHistory], proposals: state.proposals.map(proposalView).reverse() } };
}

export interface ProposalInput {
  changeType?: unknown;
  proposedValue?: unknown;
  rationale?: unknown;
}

export function createPolicyProposal(actor: TideActor, input: ProposalInput): PolicyResult<ProposalView> {
  const action = "create_policy_proposal";
  if (!hasRole(actor, ROLE.admin)) {
    return deny(actor, 403, "role_not_permitted", "Only administrators can propose policy changes.", { action });
  }
  const changeType = input.changeType as PolicyChangeType;
  const value = input.proposedValue;
  if (!POLICY_CHANGE_TYPES.includes(changeType) || typeof value !== "object" || value === null || Array.isArray(value)) {
    return deny(actor, 422, "invalid_input", "changeType and an object proposedValue are required.", { action, details: { changeTypes: POLICY_CHANGE_TYPES } });
  }

  const proposal: PolicyProposal = {
    id: crypto.randomUUID(),
    proposedBySubject: actor.subject,
    changeType,
    proposedValue: structuredClone(value as Record<string, unknown>),
    rationale: nonEmpty(input.rationale) ? input.rationale.trim() : null,
    status: "proposed",
    invariantViolations: invariantViolations(changeType, value as Record<string, unknown>, actor.subject),
    createdAt: now().toISOString(),
    effectiveAt: null,
    approvals: [],
  };
  getState().proposals.push(proposal);
  appendAudit({
    eventType: "policy_proposed",
    actor,
    policyProposalId: proposal.id,
    detail: { changeType, proposedValue: proposal.proposedValue, invariantViolations: proposal.invariantViolations, activePolicyVersion: getState().policy.version },
  });
  return { ok: true, status: 201, data: proposalView(proposal) };
}

export function decidePolicyProposal(actor: TideActor, proposalId: string, input: DecisionInput): PolicyResult<ProposalView> {
  const action = "decide_policy_proposal";
  const state = getState();
  const proposal = state.proposals.find((p) => p.id === proposalId);
  if (!proposal) return deny(actor, 404, "not_found", "Proposal not found.", { policyProposalId: proposalId, action });
  const ctx = { policyProposalId: proposal.id, action };

  const role = hasRole(actor, ROLE.privacy) ? ROLE.privacy : hasRole(actor, ROLE.compliance) ? ROLE.compliance : null;
  if (proposal.proposedBySubject === actor.subject) {
    return deny(actor, 403, "proposer_cannot_approve", "A proposer cannot approve their own proposal.", ctx);
  }
  if (!role) {
    return deny(actor, 403, hasRole(actor, ROLE.admin) ? "admin_no_override" : "role_not_permitted", "Only Privacy Officer or Compliance Approver can decide.", ctx);
  }
  if (input.decision !== "approved" && input.decision !== "rejected") {
    return deny(actor, 422, "invalid_input", "decision must be 'approved' or 'rejected'.", ctx);
  }
  if (proposal.status !== "proposed") {
    return deny(actor, 409, "not_pending", `Proposal is ${proposal.status}.`, ctx);
  }
  if (proposal.approvals.some((a) => a.approverSubject === actor.subject)) {
    return deny(actor, 409, "already_decided", "This approver has already decided.", ctx);
  }
  if (proposal.approvals.some((a) => a.approverRole === role)) {
    return deny(actor, 409, "duplicate_role_approver", `A ${role} decision is already recorded; quorum needs the other role.`, ctx);
  }

  const decidedAt = now().toISOString();
  proposal.approvals.push({ approverSubject: actor.subject, approverRole: role, decision: input.decision, decidedAt, note: nonEmpty(input.note) ? input.note.trim() : null });
  appendAudit({ eventType: "approval_recorded", actor, policyProposalId: proposal.id, detail: { decision: input.decision, role } });

  if (input.decision === "rejected") {
    proposal.status = "rejected";
    appendAudit({ eventType: "policy_rejected", actor, policyProposalId: proposal.id, detail: { by: role } });
    return { ok: true, data: proposalView(proposal) };
  }
  if (proposalView(proposal).missingApprovals.length > 0) {
    return { ok: true, data: proposalView(proposal) };
  }

  // Quorum reached. Invariant-violating proposals never take effect, even with both approvals.
  if (proposal.invariantViolations.length > 0) {
    proposal.status = "rejected";
    appendAudit({ eventType: "policy_rejected", actor: null, policyProposalId: proposal.id, detail: { reason: "invariant_violation", invariantViolations: proposal.invariantViolations } });
    return { ok: true, data: proposalView(proposal) };
  }

  proposal.status = "approved";
  proposal.effectiveAt = decidedAt;
  appendAudit({ eventType: "policy_approved", actor, policyProposalId: proposal.id, detail: { approvers: proposal.approvals.map((a) => ({ subject: a.approverSubject, role: a.approverRole })) } });

  state.policyHistory.push({ ...state.policy });
  const next = { ...state.policy, version: state.policy.version + 1, activatedAt: decidedAt, sourceProposalId: proposal.id };
  const value = proposal.proposedValue;
  if (proposal.changeType === "access_duration") next.ordinaryMaxMinutes = Number(value.ordinaryMaxMinutes);
  if (proposal.changeType === "emergency_window") next.emergencyWindowMinutes = Number(value.emergencyWindowMinutes);
  if (proposal.changeType === "data_scope") next.dataScope = { ...next.dataScope, ...value };
  if (proposal.changeType === "governance_rule") next.governanceRules = { ...next.governanceRules, ...value };
  state.policy = next;
  state.proposals.filter((p) => p.id !== proposal.id && p.status === "approved" && p.changeType === proposal.changeType).forEach((p) => (p.status = "superseded"));

  appendAudit({ eventType: "policy_activated", actor: null, policyProposalId: proposal.id, detail: { version: next.version, previousVersion: next.version - 1 } });
  return { ok: true, data: proposalView(proposal) };
}

// ---------------------------------------------------------------------------------------------
// Flow 5: role-scoped, append-only audit

const POLICY_EVENTS = new Set(["policy_proposed", "policy_approved", "policy_rejected", "policy_activated"]);

export type AuditView = Omit<AuditEvent, "detail"> & { actorDisplayName: string | null; detail: Record<string, unknown> };

export function listAudit(actor: TideActor, filter: { childId?: string; requestId?: string; type?: string } = {}): PolicyResult<{ scope: string; events: AuditView[] }> {
  refreshAll();
  const events = auditEvents();
  const myRequestIds = new Set(getState().requests.filter((r) => r.requesterSubject === actor.subject).map((r) => r.id));

  let scope: string;
  let visible: readonly Readonly<AuditEvent>[];
  let redact = false;

  if (hasRole(actor, ROLE.privacy)) {
    scope = "privacy_full";
    visible = events;
  } else if (hasRole(actor, ROLE.compliance)) {
    scope = "compliance_governance";
    visible = events.filter((e) => POLICY_EVENTS.has(e.eventType) || e.policyProposalId || e.eventType === "emergency_review_required");
  } else if (hasRole(actor, ROLE.admin)) {
    scope = "admin_technical";
    visible = events;
    redact = true;
  } else if (hasRole(actor, ROLE.guardian)) {
    scope = "guardian_children";
    const children = new Set(getState().guardianLinks.filter((l) => l.guardianSubject === actor.subject && l.verified).map((l) => l.childId));
    visible = events.filter((e) => e.childId && children.has(e.childId));
  } else if (hasRole(actor, ROLE.doctor)) {
    scope = "doctor_own";
    visible = events.filter((e) => e.actorSubject === actor.subject || (e.accessRequestId && myRequestIds.has(e.accessRequestId)));
  } else {
    return deny(actor, 403, "role_not_permitted", "Actor cannot view audit.", { action: "list_audit" });
  }

  const filtered = visible.filter(
    (e) => (!filter.childId || e.childId === filter.childId) && (!filter.requestId || e.accessRequestId === filter.requestId) && (!filter.type || e.eventType === filter.type),
  );

  return {
    ok: true,
    data: {
      scope,
      events: filtered
        .map((e) => ({
          ...e,
          actorDisplayName: e.actorSubject ? userBySubject(e.actorSubject)?.displayName ?? e.actorSubject : null,
          // Admin sees a technical log: who/what/when/outcome, without child identity or clinical purpose.
          ...(redact
            ? { childId: null, detail: { action: e.detail.action ?? null, reason: e.detail.reason ?? null, kind: e.detail.kind ?? null, decision: e.detail.decision ?? null } }
            : { detail: { ...e.detail } }),
        }))
        .reverse(),
    },
  };
}

export function emergencyReviewQueue(actor: TideActor): PolicyResult<RequestView[]> {
  if (!hasRole(actor, ROLE.privacy)) {
    return deny(actor, 403, "role_not_permitted", "Only the Privacy Officer reviews emergency access.", { action: "emergency_review" });
  }
  refreshAll();
  return { ok: true, data: getState().requests.filter((r) => r.kind === "emergency" && r.reviewRequired).map(view).reverse() };
}
