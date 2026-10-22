import {
  AccessRequestKind,
  AccessRequestStatus,
  ApprovalDecisionValue,
  AuditEventType,
  PolicyChangeType,
  PolicyProposalStatus,
  Prisma,
  RecordGroup,
} from "@prisma/client";

import { registerAuditSink } from "@/server/policy/audit";
import {
  INITIAL_POLICY,
  getState,
  userBySubject,
  type ActivePolicy,
  type AuditEvent,
  type DemoState,
} from "@/server/policy/store";
import { prisma } from "@/server/repositories/prisma";

export type PersistenceMode = "postgres" | "memory";

export interface PersistenceStatus {
  requested: PersistenceMode;
  active: PersistenceMode;
  hydrated: boolean;
  reason: string | null;
}

let status: PersistenceStatus = {
  requested: process.env.GUARDIANGATE_STORE === "memory" ? "memory" : "postgres",
  active: "memory",
  hydrated: false,
  reason: null,
};
let initialization: Promise<PersistenceStatus> | undefined;
let sinkRegistered = false;
let writeQueue: Promise<void> = Promise.resolve();

function applyProposal(policy: ActivePolicy, proposal: DemoState["proposals"][number]): ActivePolicy {
  const next: ActivePolicy = {
    ...policy,
    version: policy.version + 1,
    activatedAt: proposal.effectiveAt ?? policy.activatedAt,
    sourceProposalId: proposal.id,
    dataScope: { ...policy.dataScope },
    governanceRules: { ...policy.governanceRules },
  };
  if (proposal.changeType === "access_duration") {
    next.ordinaryMaxMinutes = Number(proposal.proposedValue.ordinaryMaxMinutes);
  } else if (proposal.changeType === "emergency_window") {
    next.emergencyWindowMinutes = Number(proposal.proposedValue.emergencyWindowMinutes);
  } else if (proposal.changeType === "data_scope") {
    next.dataScope = { ...next.dataScope, ...proposal.proposedValue };
  } else if (proposal.changeType === "governance_rule") {
    next.governanceRules = { ...next.governanceRules, ...proposal.proposedValue };
  }
  return next;
}

function proposalInvariantViolations(
  changeType: DemoState["proposals"][number]["changeType"],
  value: Record<string, unknown>,
  proposer: string,
): string[] {
  const forbidden: Record<string, string> = {
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
  const violations = new Set<string>();
  for (const [key, invariant] of Object.entries(forbidden)) {
    if (key in value) violations.add(invariant);
  }
  if (Object.values(value).some((candidate) => candidate === proposer)) {
    violations.add("no_self_grant");
  }
  if (
    changeType === "access_duration" &&
    !(Number(value.ordinaryMaxMinutes) >= 1 && Number(value.ordinaryMaxMinutes) <= 24 * 60)
  ) {
    violations.add("invalid_ordinary_max_minutes");
  }
  if (
    changeType === "emergency_window" &&
    !(Number(value.emergencyWindowMinutes) >= 1 && Number(value.emergencyWindowMinutes) <= 120)
  ) {
    violations.add("invalid_emergency_window_minutes");
  }
  return [...violations];
}

async function hydrateFromPostgres(): Promise<void> {
  const [users, children, guardianLinks, consultations, requests, proposals, audit] =
    await prisma.$transaction([
      prisma.appUser.findMany(),
      prisma.child.findMany({
        include: {
          clinicalSummary: true,
          encounterRecords: true,
          diagnosticResults: true,
          sensitiveRecords: true,
        },
      }),
      prisma.guardianLink.findMany({ include: { guardian: true } }),
      prisma.consultation.findMany({ include: { clinicians: { include: { clinician: true } } } }),
      prisma.accessRequest.findMany({
        include: {
          requester: true,
          scopes: true,
          decisions: { include: { approver: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.policyProposal.findMany({
        include: {
          proposer: true,
          approvals: { include: { approver: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.auditEvent.findMany({ include: { actor: true }, orderBy: { occurredAt: "asc" } }),
    ]);

  if (children.length === 0 || users.length === 0) {
    throw new Error("PostgreSQL is reachable but has not been seeded");
  }

  const state = getState();
  state.users = users.map((user) => ({
    id: user.id,
    tideSubject: user.tideSubject,
    displayName: user.displayName,
  }));
  state.children = children.map((child) => ({
    id: child.id,
    demoIdentifier: child.demoIdentifier,
    displayName: child.displayName,
    dateOfBirth: child.dateOfBirth.toISOString().slice(0, 10),
  }));
  state.guardianLinks = guardianLinks.map((link) => ({
    childId: link.childId,
    guardianSubject: link.guardian.tideSubject,
    verified: link.verified,
  }));
  state.consultations = consultations.map((consultation) => ({
    id: consultation.id,
    childId: consultation.childId,
    status: consultation.status,
    startsAt: consultation.startsAt.toISOString(),
    endsAt: consultation.endsAt?.toISOString() ?? null,
    clinicianSubjects: consultation.clinicians.map((assignment) => assignment.clinician.tideSubject),
  }));
  state.records = Object.fromEntries(
    children.map((child) => [
      child.id,
      {
        summary: {
          allergies: child.clinicalSummary?.allergies ?? "",
          currentMedications: child.clinicalSummary?.currentMedications ?? "",
          emergencyNotes: child.clinicalSummary?.emergencyNotes ?? "",
          updatedAt: child.clinicalSummary?.updatedAt.toISOString() ?? new Date(0).toISOString(),
        },
        encounter: child.encounterRecords.map((record) => ({
          id: record.id,
          diagnosis: record.diagnosis,
          clinicianNote: record.clinicianNote,
          recordedAt: record.recordedAt.toISOString(),
        })),
        diagnostic: child.diagnosticResults.map((record) => ({
          id: record.id,
          resultType: record.resultType,
          resultSummary: record.resultSummary,
          recordedAt: record.recordedAt.toISOString(),
        })),
        sensitive: child.sensitiveRecords.map((record) => ({
          id: record.id,
          classification: record.classification,
          content: record.content,
          recordedAt: record.recordedAt.toISOString(),
        })),
      },
    ]),
  );
  state.requests = requests.map((request) => ({
    id: request.id,
    kind: request.requestKind,
    childId: request.childId,
    requesterSubject: request.requester.tideSubject,
    consultationId: request.consultationId,
    purpose: request.purpose,
    recipientName: request.recipientName,
    emergencyReason: request.emergencyReason,
    recordGroups: request.scopes.map((scope) => scope.recordGroup),
    durationMinutes: Math.max(
      1,
      Math.round((request.requestedExpiresAt.getTime() - request.createdAt.getTime()) / 60_000),
    ),
    status: request.status,
    expiresAt: request.requestedExpiresAt.toISOString(),
    approvedAt: request.approvedAt?.toISOString() ?? null,
    revokedAt: request.revokedAt?.toISOString() ?? null,
    createdAt: request.createdAt.toISOString(),
    decisions: request.decisions.map((decision) => ({
      approverSubject: decision.approver.tideSubject,
      approverRole:
        decision.approver.tideSubject === "demo-privacy"
          ? "privacy_officer"
          : decision.approver.tideSubject === "demo-compliance"
            ? "compliance_approver"
            : decision.approver.tideSubject.startsWith("demo-doctor")
              ? "doctor"
              : "guardian",
      decision: decision.decision,
      decidedAt: decision.decidedAt.toISOString(),
      note: decision.note,
    })),
    reviewRequired:
      request.requestKind === "emergency" &&
      audit.some(
        (event) =>
          event.accessRequestId === request.id && event.eventType === "emergency_review_required",
      ),
  }));
  state.proposals = proposals.map((proposal) => ({
    id: proposal.id,
    proposedBySubject: proposal.proposer.tideSubject,
    changeType: proposal.changeType,
    proposedValue: proposal.proposedValue as Record<string, unknown>,
    rationale: null,
    status: proposal.status,
    invariantViolations: proposalInvariantViolations(
      proposal.changeType,
      proposal.proposedValue as Record<string, unknown>,
      proposal.proposer.tideSubject,
    ),
    createdAt: proposal.createdAt.toISOString(),
    effectiveAt: proposal.effectiveAt?.toISOString() ?? null,
    approvals: proposal.approvals.map((approval) => ({
      approverSubject: approval.approver.tideSubject,
      approverRole:
        approval.approver.tideSubject === "demo-privacy"
          ? "privacy_officer"
          : "compliance_approver",
      decision: approval.decision,
      decidedAt: approval.decidedAt.toISOString(),
      note: null,
    })),
  }));
  state.audit = audit.map((event, index) => ({
    id: event.id,
    sequence: index + 1,
    eventType: event.eventType,
    actorSubject: event.actor?.tideSubject ?? null,
    actorRoles: [],
    childId: event.childId,
    accessRequestId: event.accessRequestId,
    policyProposalId: event.policyProposalId,
    recordGroups: event.recordGroups,
    occurredAt: event.occurredAt.toISOString(),
    detail: event.detail as Record<string, unknown>,
  }));

  const baseline: ActivePolicy = {
    version: 1,
    ...INITIAL_POLICY,
    dataScope: {},
    governanceRules: {},
    activatedAt: state.policy.activatedAt,
    sourceProposalId: null,
  };
  state.policyHistory = [];
  state.policy = state.proposals
    .filter((proposal) => proposal.effectiveAt)
    .sort((left, right) => Date.parse(left.effectiveAt ?? "") - Date.parse(right.effectiveAt ?? ""))
    .reduce((policy, proposal) => {
      state.policyHistory.push({ ...policy });
      return applyProposal(policy, proposal);
    }, baseline);
}

async function persistRequest(requestId: string): Promise<void> {
  const request = getState().requests.find((candidate) => candidate.id === requestId);
  if (!request) return;
  const requester = userBySubject(request.requesterSubject);
  if (!requester) return;

  await prisma.$transaction(async (tx) => {
    await tx.accessRequest.upsert({
      where: { id: request.id },
      update: {
        requestKind: request.kind as AccessRequestKind,
        purpose: request.purpose,
        recipientName: request.recipientName,
        emergencyReason: request.emergencyReason,
        status: request.status as AccessRequestStatus,
        requestedExpiresAt: new Date(request.expiresAt),
        approvedAt: request.approvedAt ? new Date(request.approvedAt) : null,
        revokedAt: request.revokedAt ? new Date(request.revokedAt) : null,
      },
      create: {
        id: request.id,
        requestKind: request.kind as AccessRequestKind,
        childId: request.childId,
        requesterUserId: requester.id,
        consultationId: request.consultationId,
        purpose: request.purpose,
        recipientName: request.recipientName,
        emergencyReason: request.emergencyReason,
        status: request.status as AccessRequestStatus,
        requestedExpiresAt: new Date(request.expiresAt),
        approvedAt: request.approvedAt ? new Date(request.approvedAt) : null,
        revokedAt: request.revokedAt ? new Date(request.revokedAt) : null,
        createdAt: new Date(request.createdAt),
      },
    });
    await tx.accessRequestScope.deleteMany({ where: { accessRequestId: request.id } });
    await tx.accessRequestScope.createMany({
      data: request.recordGroups.map((recordGroup) => ({
        accessRequestId: request.id,
        recordGroup: recordGroup as RecordGroup,
      })),
    });
    for (const decision of request.decisions) {
      const approver = userBySubject(decision.approverSubject);
      if (!approver) continue;
      await tx.approvalDecision.upsert({
        where: {
          accessRequestId_approverUserId: {
            accessRequestId: request.id,
            approverUserId: approver.id,
          },
        },
        update: {
          decision: decision.decision as ApprovalDecisionValue,
          decidedAt: new Date(decision.decidedAt),
          note: decision.note,
        },
        create: {
          accessRequestId: request.id,
          approverUserId: approver.id,
          decision: decision.decision as ApprovalDecisionValue,
          decidedAt: new Date(decision.decidedAt),
          note: decision.note,
        },
      });
    }
  });
}

async function persistProposal(proposalId: string): Promise<void> {
  const proposal = getState().proposals.find((candidate) => candidate.id === proposalId);
  if (!proposal) return;
  const proposer = userBySubject(proposal.proposedBySubject);
  if (!proposer) return;

  await prisma.$transaction(async (tx) => {
    await tx.policyProposal.upsert({
      where: { id: proposal.id },
      update: {
        changeType: proposal.changeType as PolicyChangeType,
        proposedValue: proposal.proposedValue as Prisma.InputJsonValue,
        status: proposal.status as PolicyProposalStatus,
        effectiveAt: proposal.effectiveAt ? new Date(proposal.effectiveAt) : null,
      },
      create: {
        id: proposal.id,
        proposedByUserId: proposer.id,
        changeType: proposal.changeType as PolicyChangeType,
        proposedValue: proposal.proposedValue as Prisma.InputJsonValue,
        status: proposal.status as PolicyProposalStatus,
        createdAt: new Date(proposal.createdAt),
        effectiveAt: proposal.effectiveAt ? new Date(proposal.effectiveAt) : null,
      },
    });
    for (const approval of proposal.approvals) {
      const approver = userBySubject(approval.approverSubject);
      if (!approver) continue;
      await tx.policyProposalApproval.upsert({
        where: {
          policyProposalId_approverUserId: {
            policyProposalId: proposal.id,
            approverUserId: approver.id,
          },
        },
        update: {
          decision: approval.decision as ApprovalDecisionValue,
          decidedAt: new Date(approval.decidedAt),
        },
        create: {
          policyProposalId: proposal.id,
          approverUserId: approver.id,
          decision: approval.decision as ApprovalDecisionValue,
          decidedAt: new Date(approval.decidedAt),
        },
      });
    }
  });
}

async function persistAudit(event: Readonly<AuditEvent>): Promise<void> {
  const actor = event.actorSubject ? userBySubject(event.actorSubject) : undefined;
  await prisma.auditEvent.upsert({
    where: { id: event.id },
    update: {},
    create: {
      id: event.id,
      eventType: event.eventType as AuditEventType,
      actorUserId: actor?.id ?? null,
      childId: event.childId,
      accessRequestId: event.accessRequestId,
      policyProposalId: event.policyProposalId,
      recordGroups: event.recordGroups as RecordGroup[],
      occurredAt: new Date(event.occurredAt),
      detail: event.detail as Prisma.InputJsonValue,
    },
  });
}

function enqueuePersistence(event: Readonly<AuditEvent>): Promise<void> {
  writeQueue = writeQueue
    .then(async () => {
      if (event.accessRequestId) await persistRequest(event.accessRequestId);
      if (event.policyProposalId) await persistProposal(event.policyProposalId);
      await persistAudit(event);
    })
    .catch((error: unknown) => {
      status = {
        ...status,
        active: "memory",
        reason: error instanceof Error ? error.message : "PostgreSQL persistence failed",
      };
      console.error("GuardianGate persistence fell back to memory:", error);
    });
  return writeQueue;
}

/**
 * Connects and hydrates once. Any database/setup failure fails over to the seeded in-memory
 * state so the local demo remains available; protected policy decisions remain fail-closed.
 */
export function ensurePersistenceReady(): Promise<PersistenceStatus> {
  initialization ??= (async () => {
    status = {
      requested: process.env.GUARDIANGATE_STORE === "memory" ? "memory" : "postgres",
      active: "memory",
      hydrated: false,
      reason: null,
    };
    if (status.requested === "memory") {
      status = { ...status, hydrated: true, reason: "explicit memory demo mode" };
      return status;
    }

    try {
      await prisma.$connect();
      await hydrateFromPostgres();
      if (!sinkRegistered) {
        registerAuditSink(enqueuePersistence);
        sinkRegistered = true;
      }
      status = { ...status, active: "postgres", hydrated: true, reason: null };
    } catch (error) {
      status = {
        ...status,
        active: "memory",
        hydrated: true,
        reason: error instanceof Error ? error.message : "PostgreSQL unavailable",
      };
    }
    return status;
  })();
  return initialization;
}

export function persistenceStatus(): Readonly<PersistenceStatus> {
  return status;
}

/** Test/controlled-shutdown hook: wait until all queued mirror writes have completed. */
export async function flushPersistence(): Promise<void> {
  await writeQueue;
}
