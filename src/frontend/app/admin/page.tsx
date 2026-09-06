"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "../../components/AppHeader";
import { api } from "../../services/httpClient";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useAuth } from "../../contexts/AuthContext";
import { ALL_ROLES, type UserRole } from "../../lib/rbac";
import { D, tint } from "../../lib/shared";
import { useLang } from "../../lib/i18n";
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
  // Dữ liệu chưa migrate có thể còn role cũ; API trả role dạng text để admin
  // vẫn thấy và sửa lại được (xem V005__consolidate_roles.sql).
  role: UserRole | string;
  is_approved: boolean;
  created_at: string | null;
  company_name?: string | null;
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
  /** `null` = phiên tạo trước khi auth ghi nguồn gốc; hiện "không ghi nhận", không bịa. */
  ip_address: string | null;
  user_agent: string | null;
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
  /**
   * `null` khi bản ghi không ghi nhận được nguồn gốc.
   *
   * Backend từng điền "127.0.0.1" và "Browser" cho những dòng thiếu. Một nhật
   * ký kiểm toán nói dối về nguồn gốc còn tệ hơn một dòng thừa nhận là không
   * biết: "127.0.0.1" không phân biệt nổi với một truy cập thật từ máy chủ.
   */
  ip_address: string | null;
  user_agent: string | null;
  details: unknown;
  created_at: string;
}

interface LLMMetrics {
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  total_estimated_cost: number;
  /** `cost` null = model không có trong bảng giá; hiện "chưa có giá", không phải $0. */
  by_model: { model_name: string; total_tokens: number; cost: number | null; calls: number }[];
}

interface InfraMetrics {
  azure_service_bus: {
    queue_name: string;
    status: "healthy" | "degraded" | "unavailable" | "not_configured";
    /**
     * `null` nghĩa là KHÔNG đọc được, khác hẳn với 0.
     *
     * Backend từng trả 0 cứng kèm status "healthy", nên một Service Bus chết
     * hiện lên đây y hệt một hàng đợi rỗng đang chạy tốt. Kiểu `| null` là để
     * không thể vô tình quay lại chỗ đó.
     */
    active_message_count: number | null;
    deadletter_message_count: number | null;
    /** Vì sao không phải healthy. */
    detail: string | null;
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

const roleColor = (r: string) => (r === "admin" ? D.amber : r === "hr" ? D.blue : D.mint);

const RoleBadge: React.FC<{ role: string }> = ({ role }) => (
  <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 4, textTransform: "uppercase", color: roleColor(role), background: `${roleColor(role)}14`, border: `1px solid ${roleColor(role)}30` }}>
    {role}
  </span>
);

const NAV: { key: ActiveTab; labelKey: string; icon: LucideIcon }[] = [
  { key: "users", labelKey: "admin.nav.users", icon: Users },
  { key: "abac", labelKey: "admin.nav.abac", icon: ShieldAlert },
  { key: "ai", labelKey: "admin.nav.ai", icon: Cpu },
  { key: "infra", labelKey: "admin.nav.infra", icon: Activity },
  { key: "audit", labelKey: "admin.nav.audit", icon: ScrollText },
];

export default function AdminDashboard() {
  const router = useRouter();
  const { user, hasRole } = useAuth();
  const { lang, t } = useLang();
  const locale = lang === "vi" ? "vi-VN" : "en-US";
  const [activeTab, setActiveTab] = useState<ActiveTab>("users");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Phiên đang chờ xác nhận thu hồi. `null` = hộp thoại đóng. */
  const [revokingJti, setRevokingJti] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

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
      setError(err instanceof Error ? err.message : t("admin.error.loadMetrics"));
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
      setError(t("admin.error.updateUser", { message: err instanceof Error ? err.message : t("admin.error.generic") }));
    } finally {
      setSavingId(null);
    }
  };

  const handleTogglePolicy = async (policy: Policy) => {
    try {
      const updated = await api.put<Policy>(`/api/admin/abac/policies/${policy.id}`, { is_masked: !policy.is_masked });
      setPolicies((prev) => prev.map((p) => (p.id === policy.id ? updated : p)));
    } catch (err) {
      setError(t("admin.error.togglePolicy", { message: err instanceof Error ? err.message : t("admin.error.generic") }));
    }
  };

  const handleRevokeSession = async () => {
    const jti = revokingJti;
    if (!jti) return;
    setRevoking(true);
    setError(null);
    try {
      await api.post(`/api/admin/sessions/${jti}/revoke`);
      setSessions((prev) => prev.map((s) => (s.jti === jti ? { ...s, is_revoked: true } : s)));
      setRevokingJti(null);
    } catch (err) {
      setError(t("admin.error.revokeSession", { message: err instanceof Error ? err.message : t("admin.error.generic") }));
    } finally {
      setRevoking(false);
    }
  };

  const handleTriggerReindex = async () => {
    setReindexing(true);
    setReindexMsg(null);
    try {
      const res = await api.post<{ message: string }>("/api/admin/vector/reindex");
      setReindexMsg(res.message);
    } catch (err) {
      setReindexMsg(t("admin.error.reindex", { message: err instanceof Error ? err.message : t("admin.error.generic") }));
    } finally {
      setReindexing(false);
    }
  };

  // Không có lượt dùng thì KHÔNG vẽ biểu đồ mẫu: một đường cong bịa trên trang
  // theo dõi chi phí là thứ admin sẽ tin. Trống thì nói trống.
  const chartData = costSeries;

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
            {t("admin.console")}
          </h2>
          {NAV.map(({ key, labelKey, icon: Icon }) => {
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
                <span>{t(labelKey)}</span>
              </button>
            );
          })}
        </aside>

        {/* Content */}
        <main style={{ flex: 1, overflowY: "auto", padding: "32px 36px", background: D.bg }}>
          <ConfirmDialog
            open={revokingJti !== null}
            title={t("admin.revoke.title")}
            message={t("admin.revoke.message")}
            confirmLabel={t("admin.revoke.confirm")}
            busy={revoking}
            onCancel={() => setRevokingJti(null)}
            onConfirm={handleRevokeSession}
          />

          {error && (
            <div style={{ background: "rgba(220,38,38,0.06)", border: `1px solid ${tint("red", "40")}`, borderRadius: 6, padding: "12px 16px", color: D.red, fontSize: 13.5, marginBottom: 22 }}>
              {error}
            </div>
          )}

          {/* TAB: USERS & ACCESS */}
          {activeTab === "users" && (
            <div>
              <h1 style={h1Style}>{t("admin.users.title")}</h1>
              <p style={subStyle}>{t("admin.users.subtitle")}</p>

              {loading ? (
                <Spinner />
              ) : (
                <div style={tableWrap}>
                  <table style={table}>
                    <thead>
                      <tr>
                        <th style={thStyle}>{t("admin.users.col.user")}</th>
                        <th style={thStyle}>{t("admin.users.col.current")}</th>
                        <th style={thStyle}>{t("admin.users.col.assignRole")}</th>
                        <th style={thStyle}>{t("admin.users.col.approved")}</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>{t("admin.users.col.action")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td style={tdStyle}>
                            <div style={{ fontWeight: 600, color: D.ink }}>{u.name}</div>
                            <div style={{ fontSize: 11.5, color: D.muted }}>{u.email}</div>
                            {u.company_name && (
                              <div style={{ fontSize: 11, color: D.dim }}>{u.company_name}</div>
                            )}
                          </td>
                          <td style={tdStyle}><RoleBadge role={u.role} /></td>
                          <td style={tdStyle}>
                            <select
                              value={u.role}
                              onChange={(e) => editUser(u.id, { role: e.target.value as UserRow["role"] })}
                              style={{ padding: "6px 8px", borderRadius: 6, border: `1px solid ${D.line}`, background: D.canvas, color: D.ink, fontSize: 12.5, fontFamily: D.font, cursor: "pointer" }}
                            >
                              {/* Role cũ (recruiter/interviewer) nếu còn trong
                                  DB vẫn hiện ở value nhưng không chọn lại được —
                                  chọn 1 trong 3 role dưới đây là đã migrate. */}
                              {ALL_ROLES.map((r) => (
                                <option key={r} value={r}>{t(`role.${r}`)}</option>
                              ))}
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
                              {t("common.save")}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {users.length === 0 && (
                        <tr><td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: D.muted, padding: 28 }}>{t("admin.users.empty")}</td></tr>
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
                <h1 style={h1Style}>{t("admin.abac.title")}</h1>
                <p style={subStyle}>{t("admin.abac.subtitle")}</p>
                {loading ? <Spinner /> : (
                  <div style={tableWrap}>
                    <table style={table}>
                      <thead>
                        <tr>
                          <th style={thStyle}>{t("admin.abac.col.targetRole")}</th>
                          <th style={thStyle}>{t("admin.abac.col.resource")}</th>
                          <th style={thStyle}>{t("admin.abac.col.field")}</th>
                          <th style={thStyle}>{t("admin.abac.col.strategy")}</th>
                          <th style={{ ...thStyle, textAlign: "right" }}>{t("admin.abac.col.masked")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {policies.map((p) => (
                          <tr key={p.id}>
                            <td style={{ ...tdStyle, fontWeight: 600, color: D.ink }}>{p.role}</td>
                            <td style={tdStyle}>{p.resource}</td>
                            <td style={{ ...tdStyle, fontFamily: D.mono, color: D.blue }}>{p.field_name}</td>
                            <td style={tdStyle}>
                              <span style={{ fontSize: 11, background: D.surface, border: `1px solid ${D.line}`, padding: "2px 7px", borderRadius: 4, color: D.sub }}>{t("admin.abac.replaceWith", { pattern: p.masking_pattern })}</span>
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
                <h2 style={{ fontSize: 16, fontWeight: 700, color: D.ink, margin: "0 0 6px" }}>{t("admin.sessions.title")}</h2>
                <p style={subStyle}>{t("admin.sessions.subtitle")}</p>
                {loading ? <Spinner /> : (
                  <div style={tableWrap}>
                    <table style={table}>
                      <thead>
                        <tr>
                          <th style={thStyle}>{t("admin.sessions.col.user")}</th>
                          <th style={thStyle}>{t("admin.sessions.col.role")}</th>
                          <th style={thStyle}>{t("admin.sessions.col.ip")}</th>
                          <th style={thStyle}>{t("admin.sessions.col.issued")}</th>
                          <th style={thStyle}>{t("admin.sessions.col.status")}</th>
                          <th style={{ ...thStyle, textAlign: "right" }}>{t("admin.sessions.col.action")}</th>
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
                            <td style={{ ...tdStyle, fontFamily: D.mono }}>{s.ip_address ?? t("admin.audit.notRecorded")}</td>
                            <td style={tdStyle}>{new Date(s.created_at).toLocaleString(locale)}</td>
                            <td style={tdStyle}>
                              {s.is_revoked ? (
                                <span style={{ color: D.red, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><Ban size={12} /> {t("admin.sessions.revoked")}</span>
                              ) : (
                                <span style={{ color: D.mint, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><CheckCircle size={12} /> {t("admin.sessions.active")}</span>
                              )}
                            </td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>
                              {!s.is_revoked && (
                                <button type="button" onClick={() => setRevokingJti(s.jti)} style={{ padding: "4px 10px", background: "rgba(220,38,38,0.06)", border: `1px solid ${tint("red", "40")}`, borderRadius: 6, color: D.red, cursor: "pointer", fontSize: 11.5, fontWeight: 600 }}>{t("admin.sessions.kill")}</button>
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
              <h1 style={h1Style}>{t("admin.ai.title")}</h1>
              <p style={subStyle}>{t("admin.ai.subtitle")}</p>

              {aiMetrics && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16, marginBottom: 24 }}>
                  <StatCard label={t("admin.ai.stat.cost")} value={`$${aiMetrics.total_estimated_cost.toFixed(4)}`} color={D.mint} />
                  <StatCard label={t("admin.ai.stat.tokens")} value={aiMetrics.total_tokens.toLocaleString(locale)} color={D.blue} />
                  <StatCard label={t("admin.ai.stat.promptTokens")} value={aiMetrics.total_prompt_tokens.toLocaleString(locale)} color={D.purple} />
                  <StatCard label={t("admin.ai.stat.completionTokens")} value={aiMetrics.total_completion_tokens.toLocaleString(locale)} color={D.amber} />
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 28 }}>
                <div style={{ ...card, padding: 20 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: D.ink, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 6 }}>
                    <TrendingUp size={15} style={{ color: D.blue }} /> {t("admin.ai.dailyCost")}
                  </h3>
                  {chartData.length === 0 ? (
                    <div style={{ height: 232, marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", color: D.muted, fontSize: 12.5, border: `1px dashed ${D.line}`, borderRadius: 8 }}>
                      {t("admin.ai.empty")}
                    </div>
                  ) : (
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
                  )}
                </div>

                <div style={{ ...card, padding: 20, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: D.ink, margin: "0 0 10px", display: "flex", alignItems: "center", gap: 8 }}>
                      <Database size={15} style={{ color: D.mint }} /> {t("admin.ai.reindex.title")}
                    </h3>
                    <p style={{ fontSize: 12.5, color: D.muted, lineHeight: 1.5, margin: "0 0 14px" }}>
                      {t("admin.ai.reindex.body")}
                    </p>
                    {reindexMsg && (
                      <div style={{ fontSize: 12, background: D.surface, padding: "10px 12px", borderRadius: 6, border: `1px solid ${D.line}`, color: D.sub, marginBottom: 14 }}>{reindexMsg}</div>
                    )}
                  </div>
                  <button onClick={handleTriggerReindex} disabled={reindexing} style={{ width: "100%", padding: 11, background: D.mint, border: "none", borderRadius: 6, color: "#fff", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: reindexing ? "default" : "pointer", opacity: reindexing ? 0.75 : 1 }}>
                    {reindexing ? <><Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} /> {t("admin.ai.reindex.running")}</> : <><RefreshCw size={15} /> {t("admin.ai.reindex.run")}</>}
                  </button>
                </div>
              </div>

              <h3 style={{ fontSize: 15, fontWeight: 700, color: D.ink, margin: "0 0 12px" }}>{t("admin.ai.byModel")}</h3>
              <div style={tableWrap}>
                <table style={table}>
                  <thead>
                    <tr>
                      <th style={thStyle}>{t("admin.ai.col.model")}</th>
                      <th style={thStyle}>{t("admin.ai.col.calls")}</th>
                      <th style={thStyle}>{t("admin.ai.col.tokens")}</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>{t("admin.ai.col.cost")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiMetrics?.by_model.map((m, i) => (
                      <tr key={i}>
                        <td style={{ ...tdStyle, fontWeight: 600, color: D.blue }}>{m.model_name}</td>
                        <td style={tdStyle}>{m.calls.toLocaleString(locale)}</td>
                        <td style={{ ...tdStyle, fontFamily: D.mono }}>{m.total_tokens.toLocaleString(locale)}</td>
                        <td style={{ ...tdStyle, textAlign: "right", color: D.mint, fontWeight: 600 }}>{m.cost === null ? t("admin.ai.unpriced") : `$${m.cost.toFixed(5)}`}</td>
                      </tr>
                    ))}
                    {(!aiMetrics || aiMetrics.by_model.length === 0) && (
                      <tr><td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: D.muted, padding: 20 }}>{t("admin.ai.empty")}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: INFRASTRUCTURE */}
          {activeTab === "infra" && (
            <div>
              <h1 style={h1Style}>{t("admin.infra.title")}</h1>
              <p style={subStyle}>{t("admin.infra.subtitle")}</p>
              {infraMetrics && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  <div style={{ ...card, padding: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: D.ink, display: "flex", alignItems: "center", gap: 8, margin: 0 }}><HardDrive size={17} style={{ color: D.blue }} /> {t("admin.infra.serviceBus")}</h3>
                      <span style={{ fontSize: 11, background: `${queueTone(infraMetrics.azure_service_bus.status)}18`, color: queueTone(infraMetrics.azure_service_bus.status), padding: "2px 8px", borderRadius: 99, fontWeight: 700, textTransform: "uppercase" }}>{t(`admin.infra.status.${infraMetrics.azure_service_bus.status}`)}</span>
                    </div>
                    <InfraRow label={t("admin.infra.queue")} value={infraMetrics.azure_service_bus.queue_name} mono />
                    <InfraRow label={t("admin.infra.activeMessages")} value={countOrUnknown(infraMetrics.azure_service_bus.active_message_count)} strong color={D.blue} />
                    <InfraRow label={t("admin.infra.deadletter")} value={countOrUnknown(infraMetrics.azure_service_bus.deadletter_message_count)} strong color={D.red} last={!infraMetrics.azure_service_bus.detail} />
                    {infraMetrics.azure_service_bus.detail && (
                      <div style={{ marginTop: 12, padding: "8px 10px", borderRadius: 6, background: `${queueTone(infraMetrics.azure_service_bus.status)}0D`, border: `1px solid ${queueTone(infraMetrics.azure_service_bus.status)}28`, fontSize: 12, color: D.sub, lineHeight: 1.5 }}>
                        {infraMetrics.azure_service_bus.detail}
                      </div>
                    )}
                  </div>

                  <div style={{ ...card, padding: 20 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: D.ink, margin: "0 0 18px", display: "flex", alignItems: "center", gap: 8 }}><RefreshCw size={17} style={{ color: D.blue }} /> {t("admin.infra.rateLimits")}</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {infraMetrics.api_rate_limits.length === 0 && (
                        // Danh sách rỗng là câu trả lời thật. Trước đây chỗ này
                        // dựng sẵn github/proxycurl với hạn mức bịa.
                        <div style={{ fontSize: 13, color: D.muted, padding: "12px 0" }}>
                          {t("admin.infra.noRateLimits")}
                        </div>
                      )}
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
                              {t("admin.infra.resets", { time: new Date(l.rate_limit_reset).toLocaleTimeString(locale) })}
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
              <h1 style={h1Style}>{t("admin.audit.title")}</h1>
              <p style={subStyle}>{t("admin.audit.subtitle")}</p>

              <div style={{ display: "flex", gap: 10, maxWidth: 480, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, padding: "8px 12px", background: D.canvas, border: `1px solid ${D.line}`, borderRadius: 6 }}>
                  <Search size={15} style={{ color: D.dim }} />
                  <input value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} placeholder={t("admin.audit.searchPlaceholder")} onKeyDown={(e) => e.key === "Enter" && loadTabData()} style={{ background: "transparent", border: "none", outline: "none", color: D.ink, fontSize: 13, width: "100%", fontFamily: D.font }} />
                </div>
                <button onClick={loadTabData} style={{ padding: "8px 16px", background: D.blue, border: "none", borderRadius: 6, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t("admin.audit.search")}</button>
              </div>

              {loading ? <Spinner /> : (
                <div style={tableWrap}>
                  <table style={table}>
                    <thead>
                      <tr>
                        <th style={thStyle}>{t("admin.audit.col.timestamp")}</th>
                        <th style={thStyle}>{t("admin.audit.col.operator")}</th>
                        <th style={thStyle}>{t("admin.audit.col.action")}</th>
                        <th style={thStyle}>{t("admin.audit.col.network")}</th>
                        <th style={thStyle}>{t("admin.audit.col.details")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr key={log.id}>
                          <td style={{ ...tdStyle, whiteSpace: "nowrap", color: D.muted }}>{new Date(log.created_at).toLocaleString(locale)}</td>
                          <td style={tdStyle}>
                            <div style={{ fontWeight: 600, color: D.ink }}>{log.user_name}</div>
                            {log.user_email && <div style={{ fontSize: 10.5, color: D.muted }}>{log.user_email}</div>}
                          </td>
                          <td style={tdStyle}>
                            <span style={{ fontSize: 11, background: D.blueSoft, color: D.blue, padding: "2px 7px", borderRadius: 4, fontWeight: 600, fontFamily: D.mono }}>{log.action}</span>
                          </td>
                          <td style={tdStyle}>
                            {log.ip_address ? (
                              <div style={{ fontFamily: D.mono }}>{log.ip_address}</div>
                            ) : (
                              <div style={{ color: D.dim, fontStyle: "italic" }}>{t("admin.audit.notRecorded")}</div>
                            )}
                            {log.user_agent && (
                              <div style={{ fontSize: 10, color: D.dim, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={log.user_agent}>{log.user_agent}</div>
                            )}
                          </td>
                          <td style={tdStyle}>
                            <pre style={{ margin: 0, fontSize: 11, background: D.surface, padding: 8, borderRadius: 6, overflowX: "auto", maxWidth: 300, color: D.sub, fontFamily: D.mono, border: `1px solid ${D.lineSoft}` }}>{JSON.stringify(log.details, null, 2)}</pre>
                          </td>
                        </tr>
                      ))}
                      {auditLogs.length === 0 && (
                        <tr><td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: D.muted, padding: 28 }}>
                          {auditSearch
                            ? t("admin.audit.noMatch", { query: auditSearch })
                            : t("admin.audit.empty")}
                        </td></tr>
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

/** Bộ đếm không đọc được thì hiện dấu gạch, không hiện 0. */
const countOrUnknown = (n: number | null) =>
  n === null ? <span style={{ color: D.dim }}>—</span> : n;

const queueTone = (status: InfraMetrics["azure_service_bus"]["status"]): string => {
  if (status === "healthy") return D.mint;
  if (status === "degraded") return D.amber;
  return D.red; // unavailable | not_configured — cả hai đều là "không giám sát được"
};

const InfraRow: React.FC<{ label: string; value: React.ReactNode; strong?: boolean; color?: string; mono?: boolean; last?: boolean }> = ({ label, value, strong, color, mono, last }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: last ? "none" : `1px solid ${D.lineSoft}` }}>
    <span style={{ color: D.muted, fontSize: 13 }}>{label}</span>
    <span style={{ fontWeight: strong ? 700 : 600, fontSize: strong ? 15 : 13, color: color ?? D.ink, fontFamily: mono ? D.mono : D.font }}>{value}</span>
  </div>
);
