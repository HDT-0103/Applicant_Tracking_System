"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "../../components/AppHeader";
import { api } from "../../services/httpClient";
import { useAuth } from "../../contexts/AuthContext";
import { D } from "../../lib/shared";
import type { LucideIcon } from "lucide-react";
import {
  ShieldAlert,
  Users,
  Activity,
  Cpu,
  RefreshCw,
  Search,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  Ban,
  TrendingUp,
  Database,
  Loader2,
  HardDrive,
  ScrollText,
  Save,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

type ActiveTab = "users" | "abac" | "ai" | "infra" | "audit";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: "recruiter" | "interviewer" | "admin";
  is_approved: boolean;
  created_at: string | null;
}

interface Policy {
  id: string;
  role: string;
  resource: string;
  field_name: string;
  is_masked: boolean;
  masking_pattern: string;
}

interface Session {
  id: string;
  jti: string;
  user_name: string;
  user_email: string;
  user_role: string;
  ip_address: string;
  user_agent: string;
  is_revoked: boolean;
  created_at: string;
  expires_at: string;
}

interface AuditLog {
  id: string;
  user_name: string;
  user_email: string | null;
  action: string;
  candidate_uuid: string | null;
  ip_address: string;
  user_agent: string;
  details: unknown;
  created_at: string;
}

interface LLMMetrics {
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  total_estimated_cost: number;
  by_model: { model_name: string; total_tokens: number; cost: number; calls: number }[];
}

interface InfraMetrics {
  azure_service_bus: {
    queue_name: string;
    status: string;
    active_message_count: number;
    deadletter_message_count: number;
    failed_ingestions: number;
    retry_status: string;
  };
  api_rate_limits: {
    provider: string;
    rate_limit_total: number;
    rate_limit_remaining: number;
    rate_limit_reset: string;
  }[];
}

interface CostPoint {
  name: string;
  cost: number;
  tokens: number;
}

/* --- shared light-theme style helpers -------------------------------------- */
const card: React.CSSProperties = { background: D.canvas, border: `1px solid ${D.line}`, borderRadius: 8 };
const tableWrap: React.CSSProperties = { ...card, overflow: "hidden" };
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" };
const thStyle: React.CSSProperties = { padding: "12px 16px", color: D.muted, fontWeight: 600, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.03em", background: D.surface, borderBottom: `1px solid ${D.line}` };
const tdStyle: React.CSSProperties = { padding: "13px 16px", color: D.sub, fontSize: 13, borderBottom: `1px solid ${D.lineSoft}` };
const h1Style: React.CSSProperties = { fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em", color: D.ink, margin: "0 0 6px" };
const subStyle: React.CSSProperties = { color: D.muted, fontSize: 13, margin: "0 0 20px" };

const roleColor = (r: string) => (r === "admin" ? D.amber : r === "recruiter" ? D.blue : D.mint);

const RoleBadge: React.FC<{ role: string }> = ({ role }) => (
  <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 4, textTransform: "uppercase", color: roleColor(role), background: `${roleColor(role)}14`, border: `1px solid ${roleColor(role)}30` }}>
    {role}
  </span>
);

const NAV: { key: ActiveTab; label: string; icon: LucideIcon }[] = [
  { key: "users", label: "Users & Access", icon: Users },
  { key: "abac", label: "ABAC & Security", icon: ShieldAlert },
  { key: "ai", label: "AI & Vector", icon: Cpu },
  { key: "infra", label: "Infrastructure", icon: Activity },
  { key: "audit", label: "Audit Trail", icon: ScrollText },
];

const SAMPLE_COST: CostPoint[] = [
  { name: "Mon", cost: 0.24, tokens: 12000 },
  { name: "Tue", cost: 0.45, tokens: 22500 },
  { name: "Wed", cost: 0.38, tokens: 19000 },
  { name: "Thu", cost: 0.72, tokens: 36000 },
  { name: "Fri", cost: 0.95, tokens: 47500 },
  { name: "Sat", cost: 0.52, tokens: 26000 },
  { name: "Sun", cost: 0.65, tokens: 32500 },
];

export default function AdminDashboard() {
  const router = useRouter();
  const { user, hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>("users");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const [policies, setPolicies] = useState<Policy[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditSearch, setAuditSearch] = useState("");
  const [aiMetrics, setAiMetrics] = useState<LLMMetrics | null>(null);
  const [costSeries, setCostSeries] = useState<CostPoint[]>([]);
  const [infraMetrics, setInfraMetrics] = useState<InfraMetrics | null>(null);

  const [reindexing, setReindexing] = useState(false);
  const [reindexMsg, setReindexMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user && !hasRole("admin")) router.replace("/");
  }, [user, hasRole, router]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    loadTabData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user]);

  const loadTabData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "users") {
        setUsers(await api.get<UserRow[]>("/api/admin/users"));
        setDirty({});
      } else if (activeTab === "abac") {
        setPolicies(await api.get<Policy[]>("/api/admin/abac/policies"));
        setSessions(await api.get<Session[]>("/api/admin/sessions"));
      } else if (activeTab === "ai") {
        setAiMetrics(await api.get<LLMMetrics>("/api/admin/analytics/ai"));
        setCostSeries(await api.get<CostPoint[]>("/api/admin/analytics/ai/timeseries"));
      } else if (activeTab === "infra") {
        setInfraMetrics(await api.get<InfraMetrics>("/api/admin/infrastructure/metrics"));
      } else if (activeTab === "audit") {
        setAuditLogs(await api.get<AuditLog[]>(`/api/admin/audit-logs${auditSearch ? `?query=${auditSearch}` : ""}`));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard metrics");
    } finally {
      setLoading(false);
    }
  };

  const editUser = (id: string, patch: Partial<UserRow>) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
    setDirty((prev) => ({ ...prev, [id]: true }));
  };

  const handleSaveUser = async (row: UserRow) => {
    setSavingId(row.id);
    try {
      const updated = await api.patch<UserRow>(`/api/admin/users/${row.id}`, {
        role: row.role,
        is_approved: row.is_approved,
      });
      setUsers((prev) => prev.map((u) => (u.id === row.id ? updated : u)));
      setDirty((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
    } catch (err) {
      alert("Failed to update user: " + (err instanceof Error ? err.message : "Error"));
    } finally {
      setSavingId(null);
    }
  };

  const handleTogglePolicy = async (policy: Policy) => {
    try {
      const updated = await api.put<Policy>(`/api/admin/abac/policies/${policy.id}`, { is_masked: !policy.is_masked });
      setPolicies((prev) => prev.map((p) => (p.id === policy.id ? updated : p)));
    } catch (err) {
      alert("Failed to toggle policy: " + (err instanceof Error ? err.message : "Error"));
    }
  };

  const handleRevokeSession = async (jti: string) => {
    if (!window.confirm("Revoke this session? The user will be logged out immediately.")) return;
    try {
      await api.post(`/api/admin/sessions/${jti}/revoke`);
      setSessions((prev) => prev.map((s) => (s.jti === jti ? { ...s, is_revoked: true } : s)));
    } catch (err) {
      alert("Failed to revoke session: " + (err instanceof Error ? err.message : "Error"));
    }
  };

  const handleTriggerReindex = async () => {
    setReindexing(true);
    setReindexMsg(null);
    try {
      const res = await api.post<{ message: string }>("/api/admin/vector/reindex");
      setReindexMsg(res.message);
    } catch (err) {
      setReindexMsg("Failed to re-index vectors: " + (err instanceof Error ? err.message : "Error"));
    } finally {
      setReindexing(false);
    }
  };

  const chartData = costSeries.length > 0 ? costSeries : SAMPLE_COST;
  const chartIsSample = costSeries.length === 0;

  if (!user || user.role !== "admin") {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: D.bg }}>
        <Loader2 size={30} style={{ color: D.blue, animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: D.bg, fontFamily: D.font, color: D.ink }}>
      <AppHeader />

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Sidebar */}
        <aside style={{ width: 232, borderRight: `1px solid ${D.line}`, background: D.canvas, padding: "20px 12px", display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
          <h2 style={{ fontSize: 10.5, fontWeight: 700, color: D.dim, textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 12px", margin: "4px 0 12px" }}>
            Admin Console
          </h2>
          {NAV.map(({ key, label, icon: Icon }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                style={{
                  width: "100%", padding: "9px 12px", borderRadius: 6, border: "none",
                  background: active ? D.blueSoft : "transparent",
                  color: active ? D.blue : D.sub,
                  fontSize: 13, fontWeight: 600, fontFamily: D.font,
                  display: "flex", alignItems: "center", gap: 10, textAlign: "left", cursor: "pointer",
                }}
              >
                <Icon size={16} />
                <span>{label}</span>
              </button>
            );
          })}
        </aside>

        {/* Content */}
        <main style={{ flex: 1, overflowY: "auto", padding: "32px 36px", background: D.bg }}>
          {error && (
            <div style={{ background: "rgba(220,38,38,0.06)", border: `1px solid ${D.red}40`, borderRadius: 6, padding: "12px 16px", color: D.red, fontSize: 13.5, marginBottom: 22 }}>
              {error}
            </div>
          )}

          {/* TAB: USERS & ACCESS */}
          {activeTab === "users" && (
            <div>
              <h1 style={h1Style}>Users &amp; Access</h1>
              <p style={subStyle}>Approve accounts and grant roles. New sign-ups start as recruiters; elevate to interviewer or admin here.</p>

              {loading ? (
                <Spinner />
              ) : (
                <div style={tableWrap}>
                  <table style={table}>
                    <thead>
                      <tr>
                        <th style={thStyle}>User</th>
                        <th style={thStyle}>Current</th>
                        <th style={thStyle}>Assign Role</th>
                        <th style={thStyle}>Approved</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td style={tdStyle}>
                            <div style={{ fontWeight: 600, color: D.ink }}>{u.name}</div>
                            <div style={{ fontSize: 11.5, color: D.muted }}>{u.email}</div>
                          </td>
                          <td style={tdStyle}><RoleBadge role={u.role} /></td>
                          <td style={tdStyle}>
                            <select
                              value={u.role}
                              onChange={(e) => editUser(u.id, { role: e.target.value as UserRow["role"] })}
                              style={{ padding: "6px 8px", borderRadius: 6, border: `1px solid ${D.line}`, background: D.canvas, color: D.ink, fontSize: 12.5, fontFamily: D.font, cursor: "pointer" }}
                            >
                              <option value="recruiter">Recruiter</option>
                              <option value="interviewer">Interviewer</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td style={tdStyle}>
                            <button onClick={() => editUser(u.id, { is_approved: !u.is_approved })} style={{ background: "none", border: "none", cursor: "pointer", color: u.is_approved ? D.mint : D.dim, display: "flex", alignItems: "center" }}>
                              {u.is_approved ? <ToggleRight size={30} /> : <ToggleLeft size={30} />}
                            </button>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>
                            <button
                              onClick={() => handleSaveUser(u)}
                              disabled={!dirty[u.id] || savingId === u.id}
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6,
                                border: `1px solid ${dirty[u.id] ? D.blue : D.line}`,
                                background: dirty[u.id] ? D.blue : D.surface,
                                color: dirty[u.id] ? "#fff" : D.dim,
                                fontSize: 12, fontWeight: 600, fontFamily: D.font,
                                cursor: dirty[u.id] && savingId !== u.id ? "pointer" : "default",
                              }}
                            >
                              {savingId === u.id ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <Save size={13} />}
                              Save
                            </button>
                          </td>
                        </tr>
                      ))}
                      {users.length === 0 && (
                        <tr><td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: D.muted, padding: 28 }}>No users found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB: ABAC & SESSIONS */}
          {activeTab === "abac" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              <div>
                <h1 style={h1Style}>Attribute-Based Access Control</h1>
                <p style={subStyle}>Toggle real-time PII masking per role (e.g. interviewer) without editing backend code.</p>
                {loading ? <Spinner /> : (
                  <div style={tableWrap}>
                    <table style={table}>
                      <thead>
                        <tr>
                          <th style={thStyle}>Target Role</th>
                          <th style={thStyle}>Resource</th>
                          <th style={thStyle}>PII Field</th>
                          <th style={thStyle}>Strategy</th>
                          <th style={{ ...thStyle, textAlign: "right" }}>Masked</th>
                        </tr>
                      </thead>
                      <tbody>
                        {policies.map((p) => (
                          <tr key={p.id}>
                            <td style={{ ...tdStyle, fontWeight: 600, color: D.ink }}>{p.role}</td>
                            <td style={tdStyle}>{p.resource}</td>
                            <td style={{ ...tdStyle, fontFamily: D.mono, color: D.blue }}>{p.field_name}</td>
                            <td style={tdStyle}>
                              <span style={{ fontSize: 11, background: D.surface, border: `1px solid ${D.line}`, padding: "2px 7px", borderRadius: 4, color: D.sub }}>Replace “{p.masking_pattern}”</span>
                            </td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>
                              <button onClick={() => handleTogglePolicy(p)} style={{ background: "none", border: "none", color: p.is_masked ? D.mint : D.dim, cursor: "pointer" }}>
                                {p.is_masked ? <ToggleRight size={30} /> : <ToggleLeft size={30} />}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: D.ink, margin: "0 0 6px" }}>Active JWT Sessions</h2>
                <p style={subStyle}>Revoke a token to force immediate re-authentication.</p>
                {loading ? <Spinner /> : (
                  <div style={tableWrap}>
                    <table style={table}>
                      <thead>
                        <tr>
                          <th style={thStyle}>User</th>
                          <th style={thStyle}>Role</th>
                          <th style={thStyle}>IP</th>
                          <th style={thStyle}>Issued</th>
                          <th style={thStyle}>Status</th>
                          <th style={{ ...thStyle, textAlign: "right" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map((s) => (
                          <tr key={s.id}>
                            <td style={tdStyle}>
                              <div style={{ fontWeight: 600, color: D.ink }}>{s.user_name}</div>
                              <div style={{ fontSize: 11, color: D.muted }}>{s.user_email}</div>
                            </td>
                            <td style={tdStyle}><RoleBadge role={s.user_role} /></td>
                            <td style={{ ...tdStyle, fontFamily: D.mono }}>{s.ip_address}</td>
                            <td style={tdStyle}>{new Date(s.created_at).toLocaleString()}</td>
                            <td style={tdStyle}>
                              {s.is_revoked ? (
                                <span style={{ color: D.red, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><Ban size={12} /> Revoked</span>
                              ) : (
                                <span style={{ color: D.mint, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><CheckCircle size={12} /> Active</span>
                              )}
                            </td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>
                              {!s.is_revoked && (
                                <button onClick={() => handleRevokeSession(s.jti)} style={{ padding: "4px 10px", background: "rgba(220,38,38,0.06)", border: `1px solid ${D.red}40`, borderRadius: 6, color: D.red, cursor: "pointer", fontSize: 11.5, fontWeight: 600 }}>Kill Token</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: AI & VECTOR */}
          {activeTab === "ai" && (
            <div>
              <h1 style={h1Style}>AI Engine Cost &amp; Vector Analytics</h1>
              <p style={subStyle}>Monitor token/cost utilisation and trigger pgvector re-indexing.</p>

              {aiMetrics && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16, marginBottom: 24 }}>
                  <StatCard label="Estimated Total Cost" value={`$${aiMetrics.total_estimated_cost.toFixed(4)}`} color={D.mint} />
                  <StatCard label="Total Tokens" value={aiMetrics.total_tokens.toLocaleString()} color={D.blue} />
                  <StatCard label="Prompt Tokens" value={aiMetrics.total_prompt_tokens.toLocaleString()} color={D.purple} />
                  <StatCard label="Completion Tokens" value={aiMetrics.total_completion_tokens.toLocaleString()} color={D.amber} />
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 28 }}>
                <div style={{ ...card, padding: 20 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: D.ink, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 6 }}>
                    <TrendingUp size={15} style={{ color: D.blue }} /> Daily API Cost {chartIsSample && <span style={{ fontSize: 10.5, color: D.dim, fontWeight: 500 }}>(sample — no usage yet)</span>}
                  </h3>
                  <div style={{ width: "100%", height: 232, marginTop: 12 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                        <defs>
                          <linearGradient id="cost" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={D.blue} stopOpacity={0.22} />
                            <stop offset="95%" stopColor={D.blue} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={D.lineSoft} />
                        <XAxis dataKey="name" stroke={D.dim} fontSize={11} />
                        <YAxis stroke={D.dim} fontSize={11} />
                        <Tooltip contentStyle={{ background: D.canvas, border: `1px solid ${D.line}`, borderRadius: 6, color: D.ink, fontSize: 12 }} />
                        <Area type="monotone" dataKey="cost" stroke={D.blue} strokeWidth={2} fillOpacity={1} fill="url(#cost)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div style={{ ...card, padding: 20, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: D.ink, margin: "0 0 10px", display: "flex", alignItems: "center", gap: 8 }}>
                      <Database size={15} style={{ color: D.mint }} /> pgvector re-indexing
                    </h3>
                    <p style={{ fontSize: 12.5, color: D.muted, lineHeight: 1.5, margin: "0 0 14px" }}>
                      Rebuild HNSW / IVFFlat indexes on the embedding tables.
                    </p>
                    {reindexMsg && (
                      <div style={{ fontSize: 12, background: D.surface, padding: "10px 12px", borderRadius: 6, border: `1px solid ${D.line}`, color: D.sub, marginBottom: 14 }}>{reindexMsg}</div>
                    )}
                  </div>
                  <button onClick={handleTriggerReindex} disabled={reindexing} style={{ width: "100%", padding: 11, background: D.mint, border: "none", borderRadius: 6, color: "#fff", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: reindexing ? "default" : "pointer", opacity: reindexing ? 0.75 : 1 }}>
                    {reindexing ? <><Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} /> Rebuilding…</> : <><RefreshCw size={15} /> Run Vector Re-Index</>}
                  </button>
                </div>
              </div>

              <h3 style={{ fontSize: 15, fontWeight: 700, color: D.ink, margin: "0 0 12px" }}>Token Consumption by Model</h3>
              <div style={tableWrap}>
                <table style={table}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Model</th>
                      <th style={thStyle}>Calls</th>
                      <th style={thStyle}>Tokens</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Cost (USD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiMetrics?.by_model.map((m, i) => (
                      <tr key={i}>
                        <td style={{ ...tdStyle, fontWeight: 600, color: D.blue }}>{m.model_name}</td>
                        <td style={tdStyle}>{m.calls.toLocaleString()}</td>
                        <td style={{ ...tdStyle, fontFamily: D.mono }}>{m.total_tokens.toLocaleString()}</td>
                        <td style={{ ...tdStyle, textAlign: "right", color: D.mint, fontWeight: 600 }}>${m.cost.toFixed(5)}</td>
                      </tr>
                    ))}
                    {(!aiMetrics || aiMetrics.by_model.length === 0) && (
                      <tr><td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: D.muted, padding: 20 }}>No LLM usage recorded.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: INFRASTRUCTURE */}
          {activeTab === "infra" && (
            <div>
              <h1 style={h1Style}>Infrastructure &amp; Queue Monitoring</h1>
              <p style={subStyle}>Azure Service Bus, ingestion retries, and third-party API rate limits.</p>
              {infraMetrics && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  <div style={{ ...card, padding: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: D.ink, display: "flex", alignItems: "center", gap: 8, margin: 0 }}><HardDrive size={17} style={{ color: D.blue }} /> Azure Service Bus</h3>
                      <span style={{ fontSize: 11, background: D.mintSoft, color: D.mint, padding: "2px 8px", borderRadius: 99, fontWeight: 700, textTransform: "uppercase" }}>{infraMetrics.azure_service_bus.status}</span>
                    </div>
                    <InfraRow label="Queue" value={infraMetrics.azure_service_bus.queue_name} mono />
                    <InfraRow label="Active Messages" value={infraMetrics.azure_service_bus.active_message_count} strong color={D.blue} />
                    <InfraRow label="Deadletter" value={infraMetrics.azure_service_bus.deadletter_message_count} strong color={D.red} />
                    <InfraRow label="Ingestion Failures" value={infraMetrics.azure_service_bus.failed_ingestions} />
                    <InfraRow label="Retry Status" value={infraMetrics.azure_service_bus.retry_status} color={D.mint} last />
                  </div>

                  <div style={{ ...card, padding: 20 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: D.ink, margin: "0 0 18px", display: "flex", alignItems: "center", gap: 8 }}><RefreshCw size={17} style={{ color: D.blue }} /> API Rate Limits</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {infraMetrics.api_rate_limits.map((l, i) => {
                        const pct = l.rate_limit_total ? (l.rate_limit_remaining / l.rate_limit_total) : 0;
                        return (
                          <div key={i} style={{ background: D.surface, padding: 14, borderRadius: 6, border: `1px solid ${D.line}` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                              <span style={{ fontWeight: 700, textTransform: "uppercase", color: D.blue, fontSize: 12 }}>{l.provider}</span>
                              <span style={{ fontSize: 12, color: D.sub }}>{l.rate_limit_remaining} / {l.rate_limit_total}</span>
                            </div>
                            <div style={{ width: "100%", height: 7, background: D.line, borderRadius: 99, overflow: "hidden" }}>
                              <div style={{ width: `${pct * 100}%`, height: "100%", background: pct < 0.25 ? D.red : D.mint, borderRadius: 99 }} />
                            </div>
                            <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 11, color: D.dim, marginTop: 6 }}>
                              Resets: {new Date(l.rate_limit_reset).toLocaleTimeString()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: AUDIT */}
          {activeTab === "audit" && (
            <div>
              <h1 style={h1Style}>Compliance Audit Trail</h1>
              <p style={subStyle}>Searchable log of system actions mapped by user_id and candidate_uuid.</p>

              <div style={{ display: "flex", gap: 10, maxWidth: 480, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, padding: "8px 12px", background: D.canvas, border: `1px solid ${D.line}`, borderRadius: 6 }}>
                  <Search size={15} style={{ color: D.dim }} />
                  <input value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} placeholder="Search by action, user, keyword…" onKeyDown={(e) => e.key === "Enter" && loadTabData()} style={{ background: "transparent", border: "none", outline: "none", color: D.ink, fontSize: 13, width: "100%", fontFamily: D.font }} />
                </div>
                <button onClick={loadTabData} style={{ padding: "8px 16px", background: D.blue, border: "none", borderRadius: 6, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Search</button>
              </div>

              {loading ? <Spinner /> : (
                <div style={tableWrap}>
                  <table style={table}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Timestamp</th>
                        <th style={thStyle}>Operator</th>
                        <th style={thStyle}>Action</th>
                        <th style={thStyle}>Network</th>
                        <th style={thStyle}>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr key={log.id}>
                          <td style={{ ...tdStyle, whiteSpace: "nowrap", color: D.muted }}>{new Date(log.created_at).toLocaleString()}</td>
                          <td style={tdStyle}>
                            <div style={{ fontWeight: 600, color: D.ink }}>{log.user_name}</div>
                            {log.user_email && <div style={{ fontSize: 10.5, color: D.muted }}>{log.user_email}</div>}
                          </td>
                          <td style={tdStyle}>
                            <span style={{ fontSize: 11, background: D.blueSoft, color: D.blue, padding: "2px 7px", borderRadius: 4, fontWeight: 600, fontFamily: D.mono }}>{log.action}</span>
                          </td>
                          <td style={tdStyle}>
                            <div>{log.ip_address}</div>
                            <div style={{ fontSize: 10, color: D.dim, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.user_agent}</div>
                          </td>
                          <td style={tdStyle}>
                            <pre style={{ margin: 0, fontSize: 11, background: D.surface, padding: 8, borderRadius: 6, overflowX: "auto", maxWidth: 300, color: D.sub, fontFamily: D.mono, border: `1px solid ${D.lineSoft}` }}>{JSON.stringify(log.details, null, 2)}</pre>
                          </td>
                        </tr>
                      ))}
                      {auditLogs.length === 0 && (
                        <tr><td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: D.muted, padding: 28 }}>No audit trails found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const Spinner: React.FC = () => (
  <div style={{ padding: 30, display: "flex", justifyContent: "center" }}>
    <Loader2 size={22} style={{ color: D.blue, animation: "spin 0.8s linear infinite" }} />
  </div>
);

const StatCard: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ ...card, padding: 18 }}>
    <div style={{ fontSize: 11.5, color: D.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</div>
    <div style={{ fontSize: 25, fontWeight: 800, color, marginTop: 6 }}>{value}</div>
  </div>
);

const InfraRow: React.FC<{ label: string; value: React.ReactNode; strong?: boolean; color?: string; mono?: boolean; last?: boolean }> = ({ label, value, strong, color, mono, last }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: last ? "none" : `1px solid ${D.lineSoft}` }}>
    <span style={{ color: D.muted, fontSize: 13 }}>{label}</span>
    <span style={{ fontWeight: strong ? 700 : 600, fontSize: strong ? 15 : 13, color: color ?? D.ink, fontFamily: mono ? D.mono : D.font }}>{value}</span>
  </div>
);
