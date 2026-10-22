// Demo personas mirror the fake users in prisma/seed.ts and the five realm roles
// provisioned in the local TideCloak realm. They are only honoured when demo auth
// is enabled (see isDemoAuthEnabled) and never in production.

export type RealmRole = "doctor" | "guardian" | "admin" | "privacy_officer" | "compliance_approver";

export interface DemoPersona {
  username: string;
  userId: string;
  displayName: string;
  roles: RealmRole[];
  description: string;
}

export const DEMO_PERSONAS: readonly DemoPersona[] = [
  {
    username: "demo-doctor-a",
    userId: "10000000-0000-4000-8000-000000000001",
    displayName: "Dr. An Nguyen",
    roles: ["doctor"],
    description: "Treating physician assigned to the active consultation.",
  },
  {
    username: "demo-doctor-b",
    userId: "10000000-0000-4000-8000-000000000002",
    displayName: "Dr. Binh Tran",
    roles: ["doctor"],
    description: "Second physician in the consultation; confirms emergency break-glass.",
  },
  {
    username: "demo-doctor-unassigned",
    userId: "10000000-0000-4000-8000-000000000003",
    displayName: "Unassigned Doctor",
    roles: ["doctor"],
    description: "Physician not assigned to the consultation; all record requests are denied.",
  },
  {
    username: "demo-guardian-a",
    userId: "20000000-0000-4000-8000-000000000001",
    displayName: "Guardian An",
    roles: ["guardian"],
    description: "First verified legal guardian.",
  },
  {
    username: "demo-guardian-b",
    userId: "20000000-0000-4000-8000-000000000002",
    displayName: "Guardian Binh",
    roles: ["guardian"],
    description: "Second verified legal guardian.",
  },
  {
    username: "demo-privacy",
    userId: "30000000-0000-4000-8000-000000000002",
    displayName: "Privacy Officer",
    roles: ["privacy_officer"],
    description: "Reviews policy proposals and post-event emergency access.",
  },
  {
    username: "demo-compliance",
    userId: "30000000-0000-4000-8000-000000000003",
    displayName: "Compliance Approver",
    roles: ["compliance_approver"],
    description: "Independent second approval for policy change quorum.",
  },
  {
    username: "demo-admin",
    userId: "30000000-0000-4000-8000-000000000001",
    displayName: "Administrator",
    roles: ["admin"],
    description: "Proposes configuration changes; has no patient-record read or self-grant authority.",
  },
];

export function findPersona(username: string): DemoPersona | undefined {
  return DEMO_PERSONAS.find((persona) => persona.username === username);
}

export function isDemoAuthEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.GUARDIANGATE_DEMO_AUTH !== "off";
}
