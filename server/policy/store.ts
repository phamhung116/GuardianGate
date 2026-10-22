// Authoritative demo state. Seeded with the same fake data and UUIDs as prisma/seed.ts so a
// Prisma-backed implementation can replace it without changing route or service contracts.
// Kept on globalThis so Next.js dev HMR does not wipe state between requests.

export type RecordGroup = "summary" | "encounter" | "diagnostic" | "sensitive";
export const RECORD_GROUPS: readonly RecordGroup[] = ["summary", "encounter", "diagnostic", "sensitive"];

export type AccessRequestKind = "ordinary" | "external_share" | "emergency";
export type AccessRequestStatus = "pending" | "approved" | "rejected" | "expired" | "revoked";
export type Decision = "approved" | "rejected";

export type PolicyChangeType = "access_duration" | "emergency_window" | "data_scope" | "governance_rule";
export type PolicyProposalStatus = "proposed" | "approved" | "rejected" | "superseded";

export type AuditEventType =
  | "request_created"
  | "approval_recorded"
  | "access_granted"
  | "access_denied"
  | "record_accessed"
  | "request_expired"
  | "request_revoked"
  | "external_share_released"
  | "emergency_activated"
  | "emergency_review_required"
  | "policy_proposed"
  | "policy_approved"
  | "policy_rejected"
  | "policy_activated";

export interface AppUser {
  id: string;
  tideSubject: string;
  displayName: string;
}

export interface Child {
  id: string;
  demoIdentifier: string;
  displayName: string;
  dateOfBirth: string;
}

export interface GuardianLink {
  childId: string;
  guardianSubject: string;
  verified: boolean;
}

export interface Consultation {
  id: string;
  childId: string;
  status: "active" | "completed" | "cancelled";
  startsAt: string;
  endsAt: string | null;
  clinicianSubjects: string[];
}

export interface ChildRecords {
  summary: { allergies: string; currentMedications: string; emergencyNotes: string; updatedAt: string };
  encounter: { id: string; diagnosis: string; clinicianNote: string; recordedAt: string }[];
  diagnostic: { id: string; resultType: string; resultSummary: string; recordedAt: string }[];
  sensitive: { id: string; classification: string; content: string; recordedAt: string }[];
}

export interface ApprovalDecision {
  approverSubject: string;
  approverRole: string;
  decision: Decision;
  decidedAt: string;
  note: string | null;
}

export interface AccessRequest {
  id: string;
  kind: AccessRequestKind;
  childId: string;
  requesterSubject: string;
  consultationId: string | null;
  purpose: string;
  recipientName: string | null;
  emergencyReason: string | null;
  recordGroups: RecordGroup[];
  durationMinutes: number;
  status: AccessRequestStatus;
  /** Requested expiry while pending; actual grant expiry once approved. */
  expiresAt: string;
  approvedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  decisions: ApprovalDecision[];
  reviewRequired: boolean;
}

export interface ActivePolicy {
  version: number;
  ordinaryMaxMinutes: number;
  emergencyWindowMinutes: number;
  dataScope: Record<string, unknown>;
  governanceRules: Record<string, unknown>;
  activatedAt: string;
  sourceProposalId: string | null;
}

export interface PolicyProposal {
  id: string;
  proposedBySubject: string;
  changeType: PolicyChangeType;
  proposedValue: Record<string, unknown>;
  rationale: string | null;
  status: PolicyProposalStatus;
  invariantViolations: string[];
  createdAt: string;
  effectiveAt: string | null;
  approvals: ApprovalDecision[];
}

export interface AuditEvent {
  id: string;
  sequence: number;
  eventType: AuditEventType;
  actorSubject: string | null;
  actorRoles: string[];
  childId: string | null;
  accessRequestId: string | null;
  policyProposalId: string | null;
  recordGroups: RecordGroup[];
  occurredAt: string;
  detail: Record<string, unknown>;
}

export interface DemoState {
  users: AppUser[];
  children: Child[];
  guardianLinks: GuardianLink[];
  consultations: Consultation[];
  records: Record<string, ChildRecords>;
  requests: AccessRequest[];
  proposals: PolicyProposal[];
  policy: ActivePolicy;
  policyHistory: ActivePolicy[];
  audit: AuditEvent[];
  /** Demo-only clock offset; it can only move time forward, which only ever expires grants. */
  clockOffsetMs: number;
}

export const DEMO_IDS = {
  child: "40000000-0000-4000-8000-000000000001",
  consultation: "50000000-0000-4000-8000-000000000001",
  ordinaryRequest: "60000000-0000-4000-8000-000000000001",
} as const;

export const INITIAL_POLICY = {
  ordinaryMaxMinutes: 240,
  emergencyWindowMinutes: 30,
} as const;

function seedState(): DemoState {
  const now = new Date();
  const iso = now.toISOString();
  return {
    users: [
      { id: "10000000-0000-4000-8000-000000000001", tideSubject: "demo-doctor-a", displayName: "Dr. An Nguyen" },
      { id: "10000000-0000-4000-8000-000000000002", tideSubject: "demo-doctor-b", displayName: "Dr. Binh Tran" },
      { id: "10000000-0000-4000-8000-000000000003", tideSubject: "demo-doctor-unassigned", displayName: "Unassigned Doctor" },
      { id: "20000000-0000-4000-8000-000000000001", tideSubject: "demo-guardian-a", displayName: "Guardian An" },
      { id: "20000000-0000-4000-8000-000000000002", tideSubject: "demo-guardian-b", displayName: "Guardian Binh" },
      { id: "30000000-0000-4000-8000-000000000001", tideSubject: "demo-admin", displayName: "Administrator" },
      { id: "30000000-0000-4000-8000-000000000002", tideSubject: "demo-privacy", displayName: "Privacy Officer" },
      { id: "30000000-0000-4000-8000-000000000003", tideSubject: "demo-compliance", displayName: "Compliance Approver" },
    ],
    children: [
      {
        id: DEMO_IDS.child,
        demoIdentifier: "GG-CHILD-001",
        displayName: "Minh Anh (synthetic)",
        dateOfBirth: "2016-04-12",
      },
    ],
    guardianLinks: [
      { childId: DEMO_IDS.child, guardianSubject: "demo-guardian-a", verified: true },
      { childId: DEMO_IDS.child, guardianSubject: "demo-guardian-b", verified: true },
    ],
    consultations: [
      {
        id: DEMO_IDS.consultation,
        childId: DEMO_IDS.child,
        status: "active",
        startsAt: "2026-10-22T01:00:00.000Z",
        endsAt: null,
        clinicianSubjects: ["demo-doctor-a", "demo-doctor-b"],
      },
    ],
    records: {
      [DEMO_IDS.child]: {
        summary: {
          allergies: "Penicillin allergy (synthetic)",
          currentMedications: "No regular medications (synthetic)",
          emergencyNotes: "Contact guardian; blood type O+ (synthetic)",
          updatedAt: "2026-10-22T02:00:00.000Z",
        },
        encounter: [
          {
            id: "70000000-0000-4000-8000-000000000001",
            diagnosis: "Mild pharyngitis (synthetic)",
            clinicianNote: "Monitor and re-evaluate if fever persists (synthetic)",
            recordedAt: "2026-10-22T02:00:00.000Z",
          },
        ],
        diagnostic: [
          {
            id: "71000000-0000-4000-8000-000000000001",
            resultType: "Simulated blood panel",
            resultSummary: "Parameters within demo normal range",
            recordedAt: "2026-10-22T02:30:00.000Z",
          },
        ],
        sensitive: [
          {
            id: "72000000-0000-4000-8000-000000000001",
            classification: "behavioral-health-demo",
            content: "Synthetic sensitive health notes",
            recordedAt: "2026-10-22T02:45:00.000Z",
          },
        ],
      },
    },
    requests: [
      {
        id: DEMO_IDS.ordinaryRequest,
        kind: "ordinary",
        childId: DEMO_IDS.child,
        requesterSubject: "demo-doctor-a",
        consultationId: DEMO_IDS.consultation,
        purpose: "Treatment in active consultation",
        recipientName: null,
        emergencyReason: null,
        recordGroups: ["summary"],
        durationMinutes: 60,
        status: "pending",
        expiresAt: new Date(now.getTime() + 60 * 60_000).toISOString(),
        approvedAt: null,
        revokedAt: null,
        createdAt: iso,
        decisions: [],
        reviewRequired: false,
      },
    ],
    proposals: [],
    policy: {
      version: 1,
      ...INITIAL_POLICY,
      dataScope: {},
      governanceRules: {},
      activatedAt: iso,
      sourceProposalId: null,
    },
    policyHistory: [],
    audit: [],
    clockOffsetMs: 0,
  };
}

const globalStore = globalThis as typeof globalThis & { __guardianGateState?: DemoState };

export function getState(): DemoState {
  globalStore.__guardianGateState ??= seedState();
  return globalStore.__guardianGateState;
}

export function resetState(): DemoState {
  globalStore.__guardianGateState = seedState();
  return globalStore.__guardianGateState;
}

export function now(): Date {
  return new Date(Date.now() + getState().clockOffsetMs);
}

export function advanceClock(minutes: number): void {
  if (!(minutes > 0)) return;
  getState().clockOffsetMs += minutes * 60_000;
}

export function userBySubject(subject: string): AppUser | undefined {
  return getState().users.find((user) => user.tideSubject === subject);
}
