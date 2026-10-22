"use client";

import React, { useState, useEffect, useCallback } from "react";

// --- Types ---
interface Persona {
  username: string;
  userId: string;
  displayName: string;
  roles: string[];
  description: string;
}

interface RequestItem {
  id: string;
  kind: "ordinary" | "external_share" | "emergency";
  childId: string;
  requesterSubject: string;
  requesterDisplayName?: string;
  purpose: string;
  recipientName?: string | null;
  emergencyReason?: string | null;
  recordGroups: string[];
  durationMinutes: number;
  status: "pending" | "approved" | "rejected" | "expired" | "revoked";
  expiresAt: string;
  decisions: {
    approverSubject: string;
    approverRole: string;
    decision: string;
    decidedAt: string;
  }[];
  missingApprovals?: string[];
  reviewRequired?: boolean;
}

interface AuditItem {
  id: string;
  sequence: number;
  eventType: string;
  actorSubject: string | null;
  actorDisplayName: string | null;
  actorRoles: string[];
  childId: string | null;
  occurredAt: string;
  detail: Record<string, unknown>;
}

interface PolicyProposalItem {
  id: string;
  changeType: string;
  proposedBySubject: string;
  status: "proposed" | "approved" | "rejected" | "superseded";
  invariantViolations: string[];
  approvals: {
    approverSubject: string;
    approverRole: string;
    decision: string;
    decidedAt: string;
  }[];
  missingApprovals: string[];
  proposedValue: Record<string, unknown>;
}

const PERSONAS: Persona[] = [
  {
    username: "demo-doctor-a",
    userId: "10000000-0000-4000-8000-000000000001",
    displayName: "Dr. An Nguyen",
    roles: ["doctor"],
    description: "Treating physician assigned to Minh Anh's active consultation.",
  },
  {
    username: "demo-doctor-b",
    userId: "10000000-0000-4000-8000-000000000002",
    displayName: "Dr. Binh Tran",
    roles: ["doctor"],
    description: "Independent second physician for emergency confirmation.",
  },
  {
    username: "demo-doctor-unassigned",
    userId: "10000000-0000-4000-8000-000000000003",
    displayName: "Unassigned Doctor",
    roles: ["doctor"],
    description: "Outside the consultation; all record-access attempts are denied.",
  },
  {
    username: "demo-guardian-a",
    userId: "20000000-0000-4000-8000-000000000001",
    displayName: "Guardian A",
    roles: ["guardian"],
    description: "First verified legal guardian.",
  },
  {
    username: "demo-guardian-b",
    userId: "20000000-0000-4000-8000-000000000002",
    displayName: "Guardian B",
    roles: ["guardian"],
    description: "Second verified legal guardian.",
  },
  {
    username: "demo-privacy",
    userId: "30000000-0000-4000-8000-000000000002",
    displayName: "Privacy Officer",
    roles: ["privacy_officer"],
    description: "Reviews policy proposals and emergency-access events.",
  },
  {
    username: "demo-compliance",
    userId: "30000000-0000-4000-8000-000000000003",
    displayName: "Compliance Approver",
    roles: ["compliance_approver"],
    description: "Provides the independent second approval for policy changes.",
  },
  {
    username: "demo-admin",
    userId: "30000000-0000-4000-8000-000000000001",
    displayName: "Administrator",
    roles: ["admin"],
    description: "May propose configuration changes, but has no patient-record master key.",
  },
];

function responseError(json: { message?: string; error?: { message?: string; code?: string } }): string {
  return json.error?.message ?? json.message ?? json.error?.code ?? "The request was denied";
}

const CHILD_ID = "40000000-0000-4000-8000-000000000001";

export default function GuardianGateApp() {
  const [activePersona, setActivePersona] = useState<Persona>(PERSONAS[0]);
  const [activeTab, setActiveTab] = useState<"ordinary" | "external" | "emergency" | "policy" | "audit">("ordinary");

  // Data states
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [proposals, setProposals] = useState<PolicyProposalItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([]);
  const [auditScope, setAuditScope] = useState<string>("");
  const [viewedRecords, setViewedRecords] = useState<Record<string, unknown> | null>(null);
  const [viewRecordError, setViewRecordError] = useState<string | null>(null);

  // Form states
  const [ordinaryGroups, setOrdinaryGroups] = useState<string[]>(["encounter"]);
  const [ordinaryPurpose, setOrdinaryPurpose] = useState("ENT examination and routine tonsil assessment");
  const [ordinaryDuration, setOrdinaryDuration] = useState(60);

  const [externalRecipient, setExternalRecipient] = useState("Wellspring International Primary School");
  const [externalPurpose, setExternalPurpose] = useState("Enrollment vaccination and allergy documentation");
  const [externalGroups, setExternalGroups] = useState<string[]>(["summary", "diagnostic"]);
  const [externalDuration, setExternalDuration] = useState(1440);

  const [emergencyReason, setEmergencyReason] = useState("The child has anaphylactic shock and acute respiratory distress; allergy history is urgently required");

  const [bannerMessage, setBannerMessage] = useState<{ text: string; type: "success" | "error" | "info" | "warning" } | null>(null);
  const [loading, setLoading] = useState(false);

  const showBanner = (text: string, type: "success" | "error" | "info" | "warning" = "info") => {
    setBannerMessage({ text, type });
    setTimeout(() => setBannerMessage(null), 6000);
  };

  // Helper fetch with headers
  const apiCall = useCallback(async (path: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    headers.set("x-demo-persona", activePersona.username);
    if (!headers.has("Content-Type") && options.body) {
      headers.set("Content-Type", "application/json");
    }
    return fetch(path, { ...options, headers });
  }, [activePersona.username]);

  // Load state from backend
  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Load Requests
      const resReq = await apiCall("/api/v1/requests");
      if (resReq.ok) {
        const json = await resReq.json();
        setRequests(Array.isArray(json.data) ? json.data : json.data?.requests || []);
      } else {
        setRequests([]);
      }

      // 2. Load Policy Proposals
      const resPol = await apiCall("/api/v1/policy-proposals");
      if (resPol.ok) {
        const json = await resPol.json();
        setProposals(json.data?.proposals || []);
      } else {
        setProposals([]);
      }

      // 3. Load Audit
      const resAud = await apiCall("/api/v1/audit");
      if (resAud.ok) {
        const json = await resAud.json();
        setAuditLogs(json.data?.events || []);
        setAuditScope(json.data?.scope || "");
      } else {
        setAuditLogs([]);
        setAuditScope("");
      }

      // 4. Try reading child record
      const resRec = await apiCall(`/api/v1/records/${CHILD_ID}`);
      if (resRec.ok) {
        const json = await resRec.json();
        setViewedRecords(json.data?.data || json.data?.records || null);
        setViewRecordError(null);
      } else {
        const errJson = await resRec.json();
        setViewedRecords(null);
        setViewRecordError(responseError(errJson));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  // Handle Switch Persona
  const handleSelectPersona = async (p: Persona) => {
    setActivePersona(p);
    try {
      await fetch("/api/v1/demo/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona: p.username }),
      });
      showBanner(`Session switched to ${p.displayName} (${p.roles.join(", ")})`, "info");
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    refreshData();
  }, [refreshData, activePersona]);

  // Actions
  const handleCreateOrdinaryRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiCall("/api/v1/requests", {
      method: "POST",
      body: JSON.stringify({
        childId: CHILD_ID,
        recordGroups: ordinaryGroups,
        purpose: ordinaryPurpose,
        durationMinutes: ordinaryDuration,
      }),
    });
    const json = await res.json();
    if (res.ok) {
      showBanner("Consultation access request created successfully (Status: PENDING)", "success");
      refreshData();
    } else {
      showBanner(`Denied by policy: ${responseError(json)}`, "error");
    }
  };

  const handleDecideRequest = async (requestId: string, decision: "approved" | "rejected") => {
    const res = await apiCall(`/api/v1/requests/${requestId}/decide`, {
      method: "POST",
      body: JSON.stringify({ decision, note: `Decision recorded by ${activePersona.displayName}` }),
    });
    const json = await res.json();
    if (res.ok) {
      showBanner(`Decision recorded: ${decision.toUpperCase()}`, "success");
      refreshData();
    } else {
      showBanner(`Error: ${responseError(json)}`, "error");
    }
  };

  const handleRevokeRequest = async (requestId: string) => {
    const res = await apiCall(`/api/v1/requests/${requestId}/revoke`, {
      method: "POST",
      body: JSON.stringify({ reason: "Access revoked early on request" }),
    });
    const json = await res.json();
    if (res.ok) {
      showBanner("Access was revoked immediately.", "info");
      refreshData();
    } else {
      showBanner(`Revocation failed: ${responseError(json)}`, "error");
    }
  };

  const handleCreateExternalShare = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiCall("/api/v1/external-share", {
      method: "POST",
      body: JSON.stringify({
        childId: CHILD_ID,
        recipientName: externalRecipient,
        purpose: externalPurpose,
        recordGroups: externalGroups,
        durationMinutes: externalDuration,
      }),
    });
    const json = await res.json();
    if (res.ok) {
      showBanner("External-share request created. Both verified guardians must approve before release.", "success");
      refreshData();
    } else {
      showBanner(`Denied: ${responseError(json)}`, "error");
    }
  };

  const handleCreateEmergency = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiCall("/api/v1/emergency", {
      method: "POST",
      body: JSON.stringify({
        childId: CHILD_ID,
        reason: emergencyReason,
        durationMinutes: 30,
      }),
    });
    const json = await res.json();
    if (res.ok) {
      showBanner("Emergency request created. Waiting for independent confirmation from a second doctor.", "warning");
      refreshData();
    } else {
      showBanner(`Blocked: ${responseError(json)}`, "error");
    }
  };

  const handleConfirmEmergency = async (requestId: string) => {
    const res = await apiCall(`/api/v1/emergency/${requestId}/confirm`, {
      method: "POST",
      body: JSON.stringify({ note: `Independent emergency confirmation by ${activePersona.displayName}` }),
    });
    const json = await res.json();
    if (res.ok) {
      showBanner("Emergency access confirmed. The minimum medical summary is available and flagged for post-event review.", "success");
      refreshData();
    } else {
      showBanner(`Denied: ${responseError(json)}`, "error");
    }
  };

  const handleCreateProposal = async (isBypassAttempt: boolean) => {
    const payload = isBypassAttempt
      ? {
          changeType: "governance_rule",
          proposedValue: { adminOverrideAllRecords: true },
          rationale: "Administrator attempts to obtain master-key access to pediatric records",
        }
      : {
          changeType: "emergency_window",
          proposedValue: { emergencyWindowMinutes: 15 },
          rationale: "Reduce the emergency access window from 30 to 15 minutes",
        };

    const res = await apiCall("/api/v1/policy-proposals", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.ok) {
      showBanner("Policy proposal created. Independent Privacy and Compliance approvals are required.", "info");
      refreshData();
    } else {
      showBanner(`Blocked by policy: ${responseError(json)}`, "error");
    }
  };

  const handleDecideProposal = async (proposalId: string, decision: "approved" | "rejected") => {
    const res = await apiCall(`/api/v1/policy-proposals/${proposalId}/decide`, {
      method: "POST",
      body: JSON.stringify({ decision, note: `Decision recorded by ${activePersona.displayName}` }),
    });
    const json = await res.json();
    if (res.ok) {
      showBanner(`Policy decision recorded: ${decision.toUpperCase()}`, "success");
      refreshData();
    } else {
      showBanner(`Denied: ${responseError(json)}`, "error");
    }
  };

  const handleResetDemo = async () => {
    if (!confirm("Reset all synthetic demo state to its initial values?")) return;
    await apiCall("/api/v1/demo/reset", { method: "POST" });
    showBanner("The demo state has been reset.", "info");
    refreshData();
  };

  const handleAdvanceClock = async () => {
    await apiCall("/api/v1/demo/clock", {
      method: "POST",
      body: JSON.stringify({ advanceMinutes: 65 }),
    });
    showBanner("The demo clock advanced by 65 minutes to test grant expiry.", "warning");
    refreshData();
  };

  const handleAdminBypassTest = async () => {
    const res = await fetch(`/api/v1/records/${CHILD_ID}`, {
      headers: { "x-demo-persona": "demo-admin" },
    });
    const json = await res.json();
    if (!res.ok) {
      showBanner(`Negative test passed: administrator access was fully blocked. (${responseError(json)})`, "error");
    } else {
      showBanner("SECURITY FAILURE: the administrator could access the record.", "error");
    }
  };

  return (
    <div className="app-container">
      {/* Top Banner Notice */}
      {bannerMessage && (
        <div className={`active-actor-banner badge-${bannerMessage.type === "error" ? "rose" : bannerMessage.type === "warning" ? "amber" : "emerald"}`} style={{ marginBottom: 16 }}>
          <span>{bannerMessage.text}</span>
          <button className="btn btn-sm btn-secondary" onClick={() => setBannerMessage(null)}>Close</button>
        </div>
      )}

      {/* Main Header */}
      <header className="app-header">
        <div className="header-top">
          <div className="brand-row">
            <div className="brand-icon">G</div>
            <div>
              <h1 className="brand-title">GuardianGate</h1>
              <p className="brand-subtitle">Zero-Trust policy enforcement for pediatric health records</p>
            </div>
          </div>
          <div className="header-meta">
            <span className="badge badge-emerald">
              <span className="pulse-dot" />
              TideCloak OIDC Protected
            </span>
            <span className="badge badge-gray">
              Store: Authoritative Memory & Postgres Fallback
            </span>
            <button className="btn btn-sm btn-secondary" onClick={handleAdvanceClock} title="Advance 65 minutes to test grant expiry">
              ⏩ Advance 65m
            </button>
            <button className="btn btn-sm btn-secondary" onClick={handleResetDemo} title="Restore the initial demo state">
              🔄 Reset Demo
            </button>
          </div>
        </div>

        {/* Persona Switcher Section */}
        <div className="persona-section">
          <div className="section-label">Demo accounts and roles (select a persona to switch)</div>
          <div className="persona-grid">
            {PERSONAS.map((p) => {
              const isSelected = activePersona.username === p.username;
              return (
                <button
                  key={p.username}
                  className={`persona-card ${isSelected ? "active" : ""}`}
                  onClick={() => handleSelectPersona(p)}
                >
                  <div className="persona-name">
                    <span>{p.displayName}</span>
                    <span className="persona-role-tag">{p.roles[0]}</span>
                  </div>
                  <div className="persona-desc">{p.description}</div>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Active Persona Banner */}
      <div className="active-actor-banner">
        <div className="active-actor-info">
          <span>Signed in as <strong>{activePersona.displayName}</strong> (ID: <code>{activePersona.username}</code>)</span>
          <span className="badge badge-emerald">Role: {activePersona.roles.join(", ")}</span>
        </div>
        <div className="active-actor-actions">
          <a className="btn btn-sm btn-secondary" href="/auth/login" title="Sign in with a real TideCloak account">
            🔐 Sign in with TideCloak
          </a>
          <button className="btn btn-sm btn-secondary" onClick={handleAdminBypassTest} title="Attempt to open a pediatric record as an administrator">
            🛡️ Test Admin Bypass
          </button>
          <button className="btn btn-sm btn-primary" onClick={refreshData} disabled={loading}>
            {loading ? "Loading..." : "Refresh data"}
          </button>
        </div>
      </div>

      {/* Scenario Tabs */}
      <nav className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === "ordinary" ? "active" : ""}`}
          onClick={() => setActiveTab("ordinary")}
        >
          1. Ordinary access (1 guardian)
        </button>
        <button
          className={`tab-btn ${activeTab === "external" ? "active" : ""}`}
          onClick={() => setActiveTab("external")}
        >
          2. External sharing (2 guardians)
        </button>
        <button
          className={`tab-btn ${activeTab === "emergency" ? "active" : ""}`}
          onClick={() => setActiveTab("emergency")}
        >
          3. Emergency break-glass (2 doctors)
        </button>
        <button
          className={`tab-btn ${activeTab === "policy" ? "active" : ""}`}
          onClick={() => setActiveTab("policy")}
        >
          4. Policy quorum (Privacy + Compliance)
        </button>
        <button
          className={`tab-btn ${activeTab === "audit" ? "active" : ""}`}
          onClick={() => setActiveTab("audit")}
        >
          5. Audit trail ({auditScope || "Role-scoped"})
        </button>
      </nav>

      {/* Tab Content */}
      <main>
        {/* ===================== TAB 1: ORDINARY CONSULTATION ===================== */}
        {activeTab === "ordinary" && (
          <div className="scenario-layout">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Create a record-access request</h2>
                  <p className="panel-subtitle">The assigned doctor requests the minimum data group for a limited time.</p>
                </div>
                <span className="badge badge-sky">Patient: Minh Anh (age 10)</span>
              </div>

              <div className="invariant-card">
                <strong>Policy invariant:</strong> The doctor must be assigned to an active consultation and the request requires <strong>one legal guardian's approval</strong>. An unassigned doctor or self-approval is denied; only the approved data group is released.
              </div>

              <form onSubmit={handleCreateOrdinaryRequest}>
                <div className="form-group">
                  <label className="form-label">Select the minimum required data groups:</label>
                  <div className="checkbox-group">
                    {[
                      { key: "summary", label: "Medical summary (allergies and history)" },
                      { key: "encounter", label: "Encounter record (symptoms and prescriptions)" },
                      { key: "diagnostic", label: "Diagnostic and laboratory results" },
                      { key: "sensitive", label: "Sensitive record (behavioral and genetic)" },
                    ].map((g) => (
                      <label key={g.key} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={ordinaryGroups.includes(g.key)}
                          onChange={(e) => {
                            if (e.target.checked) setOrdinaryGroups([...ordinaryGroups, g.key]);
                            else setOrdinaryGroups(ordinaryGroups.filter((x) => x !== g.key));
                          }}
                        />
                        {g.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Explicit clinical purpose:</label>
                  <input
                    type="text"
                    className="form-input"
                    value={ordinaryPurpose}
                    onChange={(e) => setOrdinaryPurpose(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Grant duration (minutes):</label>
                  <select
                    className="form-select"
                    value={ordinaryDuration}
                    onChange={(e) => setOrdinaryDuration(Number(e.target.value))}
                  >
                    <option value={30}>30 minutes</option>
                    <option value={60}>60 minutes (consultation default)</option>
                    <option value={120}>120 minutes</option>
                  </select>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
                  Submit ordinary access request
                </button>
              </form>

              {/* Pending Approvals for Guardian */}
              <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid var(--border-subtle)" }}>
                <div className="section-label">Guardian action (sign in as Guardian A or B)</div>
                {requests.filter((r) => r.kind === "ordinary" && r.status === "pending").length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No requests are awaiting approval.</p>
                ) : (
                  requests.filter((r) => r.kind === "ordinary" && r.status === "pending").map((req) => (
                    <div key={req.id} className="record-box">
                      <div className="record-header">
                        <span className="badge badge-amber">Waiting for one guardian</span>
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Duration: {req.durationMinutes}m</span>
                      </div>
                      <p style={{ margin: "6px 0", fontSize: 13 }}><strong>Requesting doctor:</strong> {req.requesterDisplayName || req.requesterSubject}</p>
                      <p style={{ margin: "6px 0", fontSize: 13 }}><strong>Purpose:</strong> {req.purpose}</p>
                      <p style={{ margin: "6px 0", fontSize: 13 }}><strong>Requested groups:</strong> {req.recordGroups.join(", ")}</p>

                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <button className="btn btn-sm btn-primary" onClick={() => handleDecideRequest(req.id, "approved")}>
                          ✓ Approve request
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDecideRequest(req.id, "rejected")}>
                          ✗ Reject
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right: Policy Evaluation & Data Viewer */}
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Authorized medical record</h2>
                  <p className="panel-subtitle">The server PEP returns data only after every required condition is verified.</p>
                </div>
                <span className="badge badge-emerald">Policy Active</span>
              </div>

              {viewRecordError ? (
                <div className="record-box locked">
                  <div className="record-header">
                    <span className="badge badge-rose">🔒 Record locked</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Deny by Default</span>
                  </div>
                  <p className="record-content">
                    <strong>Server denial reason:</strong> {viewRecordError}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 8 }}>
                    To unlock data, switch to <strong>Dr. An Nguyen</strong>, create a request, then sign in as <strong>Guardian A</strong> to approve it.
                  </p>
                </div>
              ) : viewedRecords ? (
                <div>
                  <div className="record-box" style={{ background: "var(--emerald-bg)", borderColor: "var(--emerald-border)" }}>
                    <div className="record-header">
                      <span className="badge badge-emerald">🟢 Data released within the approved scope</span>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => {
                          const activeReq = requests.find((r) => r.status === "approved" && r.kind === "ordinary");
                          if (activeReq) handleRevokeRequest(activeReq.id);
                          else showBanner("No active grant was found", "error");
                        }}
                      >
                        Revoke grant now
                      </button>
                    </div>
                    <p style={{ margin: "4px 0", fontSize: 13, color: "var(--emerald-text)" }}>
                      Only guardian-approved data groups are returned. Every other group remains protected.
                    </p>
                  </div>

                  {/* Render unlocked groups */}
                  <div style={{ marginTop: 14 }}>
                    {Object.entries(viewedRecords).map(([key, value]) => (
                      <div key={key} className="record-box" style={{ marginBottom: 10 }}>
                        <div className="record-title" style={{ textTransform: "uppercase", fontSize: 12, color: "var(--emerald-accent)" }}>
                          Data group: {key}
                        </div>
                        <pre className="record-mono" style={{ margin: "6px 0 0" }}>
                          {JSON.stringify(value, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="record-box">
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>No grant is active.</p>
                </div>
              )}

              {/* Status List */}
              <div style={{ marginTop: 24 }}>
                <div className="section-label">Recent consultation requests</div>
                {requests.filter((r) => r.kind === "ordinary").slice(0, 3).map((r) => (
                  <div key={r.id} className="quorum-step" style={{ marginBottom: 8 }}>
                    <div>
                      <div><strong>{r.purpose}</strong> (Groups: {r.recordGroups.join(", ")})</div>
                      <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Expires: {new Date(r.expiresAt).toLocaleTimeString()}</div>
                    </div>
                    <span className={`badge ${r.status === "approved" ? "badge-emerald" : r.status === "pending" ? "badge-amber" : "badge-rose"}`}>
                      {r.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 2: EXTERNAL SHARING ===================== */}
        {activeTab === "external" && (
          <div className="scenario-layout">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Share records with a third party</h2>
                  <p className="panel-subtitle">Release a limited data package to a school or external specialist.</p>
                </div>
                <span className="badge badge-amber">2/2 guardian quorum</span>
              </div>

              <div className="invariant-card">
                <strong>Policy invariant:</strong> This child has two verified guardians. <strong>Both must approve independently</strong>. Missing either approval prevents any data release.
              </div>

              <form onSubmit={handleCreateExternalShare}>
                <div className="form-group">
                  <label className="form-label">External organization or recipient:</label>
                  <input
                    type="text"
                    className="form-input"
                    value={externalRecipient}
                    onChange={(e) => setExternalRecipient(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Sharing purpose:</label>
                  <input
                    type="text"
                    className="form-input"
                    value={externalPurpose}
                    onChange={(e) => setExternalPurpose(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Limited data groups to share:</label>
                  <div className="checkbox-group">
                    {[
                      { key: "summary", label: "Medical summary (vaccinations and allergies)" },
                      { key: "diagnostic", label: "Relevant diagnostic results" },
                      { key: "encounter", label: "Encounter history" },
                      { key: "sensitive", label: "Sensitive record (not recommended)" },
                    ].map((g) => (
                      <label key={g.key} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={externalGroups.includes(g.key)}
                          onChange={(e) => {
                            if (e.target.checked) setExternalGroups([...externalGroups, g.key]);
                            else setExternalGroups(externalGroups.filter((x) => x !== g.key));
                          }}
                        />
                        {g.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Sharing duration:</label>
                  <select
                    className="form-select"
                    value={externalDuration}
                    onChange={(e) => setExternalDuration(Number(e.target.value))}
                  >
                    <option value={1440}>1 day (24 hours)</option>
                    <option value={10080}>7 days (1 week)</option>
                    <option value={43200}>30 days</option>
                  </select>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
                  Request external sharing (both guardians required)
                </button>
              </form>
            </div>

            {/* Quorum Progress for External Sharing */}
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Dual-guardian approval progress</h2>
                  <p className="panel-subtitle">Track each legal guardian's independent decision.</p>
                </div>
                <span className="badge badge-sky">Dual-Consent</span>
              </div>

              {requests.filter((r) => r.kind === "external_share").length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No external-share requests exist.</p>
              ) : (
                requests.filter((r) => r.kind === "external_share").map((req) => {
                  const hasApprovedA = req.decisions.some((d) => d.approverSubject === "demo-guardian-a" && d.decision === "approved");
                  const hasApprovedB = req.decisions.some((d) => d.approverSubject === "demo-guardian-b" && d.decision === "approved");
                  const isFullyApproved = req.status === "approved";

                  return (
                    <div key={req.id} className="record-box" style={{ marginBottom: 16 }}>
                      <div className="record-header">
                        <span className="badge badge-sky">{req.recipientName}</span>
                        <span className={`badge ${isFullyApproved ? "badge-emerald" : "badge-amber"}`}>
                          {isFullyApproved ? "2/2 APPROVALS — RELEASED" : "QUORUM INCOMPLETE — LOCKED"}
                        </span>
                      </div>
                      <p style={{ margin: "6px 0", fontSize: 13 }}><strong>Purpose:</strong> {req.purpose}</p>
                      <p style={{ margin: "6px 0", fontSize: 13 }}><strong>Data scope:</strong> {req.recordGroups.join(", ")}</p>

                      {/* Quorum Visual Steps */}
                      <div className="quorum-flow">
                        <div className={`quorum-step ${hasApprovedA ? "done" : "pending"}`}>
                          <span>1. First legal guardian (Guardian A)</span>
                          <span className="badge">{hasApprovedA ? "Approved ✓" : "Awaiting approval..."}</span>
                        </div>
                        <div className={`quorum-step ${hasApprovedB ? "done" : "pending"}`}>
                          <span>2. Second legal guardian (Guardian B)</span>
                          <span className="badge">{hasApprovedB ? "Approved ✓" : "Awaiting approval..."}</span>
                        </div>
                      </div>

                      {/* Guardian Approval Action Button if current persona hasn't decided */}
                      {req.status === "pending" && (
                        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleDecideRequest(req.id, "approved")}
                          >
                            Approve as {activePersona.displayName}
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDecideRequest(req.id, "rejected")}
                          >
                            Reject request
                          </button>
                        </div>
                      )}

                      {/* Negative verification state */}
                      {!isFullyApproved && (
                        <div className="record-box locked" style={{ marginTop: 12 }}>
                          <p style={{ margin: 0, fontSize: 12, color: "var(--rose-text)" }}>
                            🛑 <strong>Release blocked:</strong> The recipient receives no data with only {hasApprovedA || hasApprovedB ? "1/2" : "0/2"} approvals.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB 3: EMERGENCY ACCESS ===================== */}
        {activeTab === "emergency" && (
          <div className="scenario-layout">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Activate emergency break-glass access</h2>
                  <p className="panel-subtitle">For emergencies where a guardian cannot be reached; two independent doctors are required.</p>
                </div>
                <span className="badge badge-rose">🚨 Emergency Protocol</span>
              </div>

              <div className="invariant-card">
                <strong>Policy invariant:</strong> The requester and confirmer must be <strong>two distinct doctors</strong>. A requester cannot self-confirm. The system releases <strong>only the minimum emergency summary</strong> for a short period and automatically creates an <code>emergency_review_required</code> event for the Privacy Officer.
              </div>

              <form onSubmit={handleCreateEmergency}>
                <div className="form-group">
                  <label className="form-label">Emergency clinical justification:</label>
                  <textarea
                    rows={3}
                    className="form-textarea"
                    value={emergencyReason}
                    onChange={(e) => setEmergencyReason(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Permitted emergency scope:</label>
                  <div className="badge badge-gray" style={{ width: "100%", justifyContent: "flex-start", padding: 10 }}>
                    Emergency summary only: allergies, blood type, and contraindications. Every other group remains locked.
                  </div>
                </div>

                <button type="submit" className="btn btn-danger" style={{ width: "100%" }}>
                  Request break-glass access
                </button>
              </form>
            </div>

            {/* Emergency Quorum Tracker */}
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Independent confirmation and minimum summary</h2>
                  <p className="panel-subtitle">A second doctor must independently confirm before emergency data is released.</p>
                </div>
                <span className="badge badge-rose">2 Clinicians Required</span>
              </div>

              {requests.filter((r) => r.kind === "emergency").length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No emergency requests are active.</p>
              ) : (
                requests.filter((r) => r.kind === "emergency").map((req) => {
                  const isConfirmed = req.status === "approved";
                  const requester = req.requesterDisplayName || req.requesterSubject;

                  return (
                    <div key={req.id} className="record-box" style={{ borderColor: "var(--rose-border)" }}>
                      <div className="record-header">
                        <span className="badge badge-rose">🚨 Emergency request</span>
                        <span className={`badge ${isConfirmed ? "badge-emerald" : "badge-amber"}`}>
                          {isConfirmed ? "CONFIRMED — EMERGENCY OPEN" : "AWAITING SECOND DOCTOR — LOCKED"}
                        </span>
                      </div>
                      <p style={{ margin: "6px 0", fontSize: 13 }}><strong>Requesting doctor:</strong> {requester}</p>
                      <p style={{ margin: "6px 0", fontSize: 13 }}><strong>Reason:</strong> {req.emergencyReason}</p>

                      {/* Quorum steps */}
                      <div className="quorum-flow">
                        <div className="quorum-step done">
                          <span>1. Requesting doctor ({requester})</span>
                          <span className="badge">Request submitted ✓</span>
                        </div>
                        <div className={`quorum-step ${isConfirmed ? "done" : "pending"}`}>
                          <span>2. Independent second doctor</span>
                          <span className="badge">{isConfirmed ? "Confirmed ✓" : "Awaiting confirmation..."}</span>
                        </div>
                      </div>

                      {/* Confirm button */}
                      {req.status === "pending" && (
                        <div style={{ marginTop: 12 }}>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleConfirmEmergency(req.id)}
                          >
                            Confirm independently as {activePersona.displayName}
                          </button>
                        </div>
                      )}

                      {/* Emergency Data Unlocked View */}
                      {isConfirmed && (
                        <div className="record-box" style={{ background: "#ffffff", border: "1px solid var(--emerald-border)", marginTop: 14 }}>
                          <div className="record-title" style={{ color: "var(--emerald-text)" }}>
                            Minimum emergency medical summary released:
                          </div>
                          <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6 }}>
                            <div>🩸 <strong>Blood type:</strong> O+ (synthetic data)</div>
                            <div>⚠️ <strong>Allergies:</strong> Severe penicillin allergy (synthetic data)</div>
                            <div>ℹ️ <strong>Emergency note:</strong> Beta-lactams contraindicated; contact a guardian immediately.</div>
                          </div>
                          <div className="badge badge-rose" style={{ marginTop: 12 }}>
                            🚨 Post-event review required: added to the Privacy Officer's mandatory review queue
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB 4: POLICY PROPOSALS & QUORUM ===================== */}
        {activeTab === "policy" && (
          <div className="scenario-layout">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Propose a policy change</h2>
                  <p className="panel-subtitle">An administrator may propose configuration changes but cannot activate or self-grant them.</p>
                </div>
                <span className="badge badge-sky">Governance Quorum</span>
              </div>

              <div className="invariant-card">
                <strong>Policy invariant:</strong> The administrator's proposal is not an approval. Both the <strong>Privacy Officer and Compliance Approver must approve independently</strong> before a valid proposal becomes effective. Any proposal granting patient-record access to an administrator is rejected unconditionally.
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => handleCreateProposal(false)}
                >
                  ➕ Create valid proposal (reduce emergency window to 15m)
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleCreateProposal(true)}
                >
                  🛑 Test invariant violation (administrator self-grant)
                </button>
              </div>
            </div>

            {/* Quorum Progress for Proposals */}
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Policy quorum progress</h2>
                  <p className="panel-subtitle">A proposal becomes effective only after both independent governance approvals.</p>
                </div>
                <span className="badge badge-emerald">2 Officers Quorum</span>
              </div>

              {proposals.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No policy-change proposals exist.</p>
              ) : (
                proposals.map((prop) => {
                  const hasPrivacy = prop.approvals.some((a) => a.approverRole === "privacy_officer" && a.decision === "approved");
                  const hasCompliance = prop.approvals.some((a) => a.approverRole === "compliance_approver" && a.decision === "approved");
                  const isEffective = prop.status === "approved";

                  return (
                    <div key={prop.id} className="record-box" style={{ marginBottom: 16 }}>
                      <div className="record-header">
                        <span className="badge badge-sky">{prop.changeType}</span>
                        <span className={`badge ${isEffective ? "badge-emerald" : prop.status === "rejected" ? "badge-rose" : "badge-amber"}`}>
                          {isEffective ? "ACTIVATED" : prop.status === "rejected" ? "REJECTED" : "PROPOSED — NOT EFFECTIVE"}
                        </span>
                      </div>
                      <p style={{ margin: "6px 0", fontSize: 13 }}><strong>Proposed change:</strong> <code>{JSON.stringify(prop.proposedValue)}</code></p>

                      {/* Quorum Visual */}
                      <div className="quorum-flow">
                        <div className={`quorum-step ${hasPrivacy ? "done" : "pending"}`}>
                          <span>1. Independent Privacy Officer approval</span>
                          <span className="badge">{hasPrivacy ? "Approved ✓" : "Awaiting approval..."}</span>
                        </div>
                        <div className={`quorum-step ${hasCompliance ? "done" : "pending"}`}>
                          <span>2. Independent Compliance approval</span>
                          <span className="badge">{hasCompliance ? "Approved ✓" : "Awaiting approval..."}</span>
                        </div>
                      </div>

                      {/* Action buttons for Officers */}
                      {prop.status === "proposed" && (
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleDecideProposal(prop.id, "approved")}
                          >
                            Approve as {activePersona.displayName}
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDecideProposal(prop.id, "rejected")}
                          >
                            Reject proposal
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB 5: AUDIT TRAIL ===================== */}
        {activeTab === "audit" && (
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Append-only audit trail</h2>
                <p className="panel-subtitle">Records requests, decisions, emergencies, denials, and policy activation. Events cannot be edited or deleted.</p>
              </div>
              <span className="badge badge-sky">Visible scope: {auditScope}</span>
            </div>

            <div className="invariant-card">
              <strong>Role-scoped visibility:</strong> Users see only the events required for their duties. Doctors see their own requests, guardians see events for linked children, Privacy sees the full review trail, and administrators see technical logs with <strong>protected health information redacted</strong>.
            </div>

            <div className="audit-table-wrap">
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Time</th>
                    <th>Actor</th>
                    <th>Role</th>
                    <th>Event type</th>
                    <th>Details / reason</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>
                        No audit events have been recorded.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td><code>#{log.sequence}</code></td>
                        <td>{new Date(log.occurredAt).toLocaleTimeString()}</td>
                        <td><strong>{log.actorDisplayName || log.actorSubject || "System"}</strong></td>
                        <td><span className="badge badge-gray">{log.actorRoles.join(", ") || "system"}</span></td>
                        <td>
                          <span className={`badge ${
                            log.eventType.includes("denied") || log.eventType.includes("rejected")
                              ? "badge-rose"
                              : log.eventType.includes("granted") || log.eventType.includes("approved") || log.eventType.includes("activated")
                              ? "badge-emerald"
                              : log.eventType.includes("emergency")
                              ? "badge-rose"
                              : "badge-sky"
                          }`}>
                            {log.eventType}
                          </span>
                        </td>
                        <td>
                          <code style={{ fontSize: 11 }}>{JSON.stringify(log.detail)}</code>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
