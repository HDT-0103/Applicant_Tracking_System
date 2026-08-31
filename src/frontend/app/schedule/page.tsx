"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Calendar, Clock, Users, CheckCircle2,
  Loader2, User, Zap, AlertCircle,
  ChevronRight, RefreshCw, Check, Search, X, Link2,
} from "lucide-react";
import { D, Dot, Badge, SectionLabel, Divider } from "../../lib/shared";
import { useAuth } from "../../contexts/AuthContext";
import { AppShell } from "../../components/AppShell";
import {
  checkCalendarStatus, getGoogleAuthUrl, exchangeGoogleCode,
  fetchConnectedInterviewers, querySlots, confirmSlot,
  type Interviewer, type TimeSlot, type ConfirmedSlot,
} from "../../services/schedulingService";

import { listCandidateOptions } from "../../services/catalogService";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function InterviewerCard({ interviewer, selected, onToggle }: { interviewer: Interviewer; selected: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={onToggle}
      style={{
        padding: "10px 12px", borderRadius: 6,
        border: `1px solid ${selected ? `${D.blue}40` : D.line}`,
        background: selected ? D.blueSoft : D.canvas,
        cursor: "pointer", transition: "all 0.15s ease",
        display: "flex", alignItems: "center", gap: 8,
      }}
    >
      <div style={{
        width: 16, height: 16, borderRadius: 3, flexShrink: 0,
        border: `2px solid ${selected ? D.blue : D.line}`,
        background: selected ? D.blue : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s ease",
      }}>
        {selected && <Check size={10} strokeWidth={3} color="#fff" />}
      </div>
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: D.blue, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 10, fontWeight: 700, color: "#fff" }}>
        {interviewer.name.charAt(0)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: D.ink }}>{interviewer.name}</div>
        <div style={{ fontSize: 9.5, color: D.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {interviewer.role} · {interviewer.email}
        </div>
      </div>
      <Dot color={D.mint} />
    </div>
  );
}

function WorkHoursBar({ slots }: { slots: TimeSlot[] }) {
  const dayMap = new Map<string, TimeSlot[]>();
  for (const s of slots) {
    const day = s.start.slice(0, 10);
    if (!dayMap.has(day)) dayMap.set(day, []);
    dayMap.get(day)!.push(s);
  }
  const sortedDays = Array.from(dayMap.entries()).sort(([a], [b]) => a.localeCompare(b));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {sortedDays.map(([day, daySlots]) => {
        const sorted = daySlots.sort((a, b) => a.start.localeCompare(b.start));
        const workStart = 480; const workEnd = 1020;
        const totalRange = workEnd - workStart;
        const scale = totalRange > 0 ? 100 / totalRange : 1;
        const toMin = (s: string) => { const d = new Date(s); return d.getHours() * 60 + d.getMinutes(); };
        return (
          <div key={day}>
            <div style={{ fontSize: 10, fontWeight: 600, color: D.sub, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <Calendar size={10} strokeWidth={2} color={D.muted} />
              {formatDate(sorted[0].start)}
              <span style={{ color: D.muted, fontWeight: 400, fontFamily: D.mono, fontSize: 9 }}>({daySlots.length} slots)</span>
            </div>
            <div style={{ position: "relative", height: 20, background: D.surface, borderRadius: 4, border: `1px solid ${D.lineSoft}`, overflow: "hidden" }}>
              {sorted.map((slot, i) => {
                const sMin = toMin(slot.start);
                const eMin = toMin(slot.end);
                const left = (sMin - workStart) * scale;
                const width = (eMin - sMin) * scale;
                return (
                  <div key={i} style={{
                    position: "absolute", left: `${left}%`, width: `${Math.max(width, 0.5)}%`,
                    top: 1, bottom: 1, background: D.blue, borderRadius: 2, opacity: 0.7, minWidth: 2,
                  }} title={`${new Date(slot.start).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} - ${new Date(slot.end).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`} />
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: D.dim, fontFamily: D.mono }}>
              <span>08:00</span><span>17:00</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function SchedulePage() {
  const searchParams = useSearchParams();
  const { user, hasRole } = useAuth();
  const router = useRouter();

  const [candidatesList, setCandidatesList] = useState<{ uuid: string; full_name: string }[]>([]);
  const [candidateUuid, setCandidateUuid] = useState<string>(searchParams.get("uuid") || "");
  const [candidateName, setCandidateName] = useState<string>(searchParams.get("name") || "");

  // OAuth state
  const [calendarConnected, setCalendarConnected] = useState<boolean | null>(null); // null = loading
  const [connecting, setConnecting] = useState(false);
  const codeExchangedRef = useRef(false);

  // Interviewer selection state
  const [connectedInterviewers, setConnectedInterviewers] = useState<Interviewer[]>([]);
  const [selectedUuids, setSelectedUuids] = useState<string[]>([]);
  const [loadingInterviewers, setLoadingInterviewers] = useState(false);

  // Scheduling state
  const [dateFrom, setDateFrom] = useState(daysFromNow(1));
  const [dateTo, setDateTo] = useState(daysFromNow(7));
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmedSlot, setConfirmedSlot] = useState<ConfirmedSlot | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(45);

  // Load available candidates if not provided in URL
  useEffect(() => {
    // Qua backend chứ không hỏi thẳng Supabase: danh sách này chỉ được chứa
    // ứng viên mà người đang đăng nhập có quyền xem.
    listCandidateOptions()
      .then((options) => {
        const data = options.map((o) => ({
          uuid: o.candidate_uuid,
          full_name: o.full_name || "Candidate",
        }));
        if (data.length > 0) {
          setCandidatesList(data);
          const initialUuid = searchParams.get("uuid");
          const initialName = searchParams.get("name");
          if (initialUuid && initialUuid !== "00000000-0000-0000-0000-000000000000") {
            setCandidateUuid(initialUuid);
            const found = data.find((c) => c.uuid === initialUuid);
            setCandidateName(initialName || found?.full_name || "Candidate");
          } else {
            setCandidateUuid(data[0].uuid);
            setCandidateName(data[0].full_name || "Candidate");
          }
        }
      })
      .catch(() => {
        // Danh sách rỗng vẫn dùng được: HR tới đây từ hồ sơ ứng viên thì uuid
        // đã có sẵn trong URL.
      });
  }, [searchParams]);

  // Redirect if not HR (unless processing an OAuth callback code)
  useEffect(() => {
    const code = searchParams.get("code");
    if (user && !hasRole("hr") && !code) {
      router.replace("/");
    }
  }, [user, hasRole, router, searchParams]);

  // On mount: check for OAuth callback code, then check calendar status
  useEffect(() => {
    const code = searchParams.get("code");
    if (code && !codeExchangedRef.current) {
      codeExchangedRef.current = true;
      // OAuth callback - exchange code for tokens
      setConnecting(true);
      exchangeGoogleCode(code)
        .then(() => {
          setCalendarConnected(true);
          // If non-HR (e.g. tech_lead) just connected calendar, redirect them to dashboard
          if (user && !hasRole("hr")) {
            router.replace("/");
            return;
          }
          // Clean the URL
          const url = new URL(window.location.href);
          url.searchParams.delete("code");
          url.searchParams.delete("scope");
          url.searchParams.delete("authuser");
          url.searchParams.delete("prompt");
          window.history.replaceState({}, "", url.toString());
        })
        .catch((err) => setError("Failed to connect Google Calendar: " + (err?.message || "Error")))
        .finally(() => setConnecting(false));
    } else if (!code) {
      // Normal page load - check if already connected
      checkCalendarStatus()
        .then((res) => setCalendarConnected(res.connected))
        .catch(() => setCalendarConnected(false));
    }
  }, [user, hasRole, router, searchParams]);

  // When calendar is connected, load connected interviewers
  useEffect(() => {
    if (calendarConnected) {
      setLoadingInterviewers(true);
      fetchConnectedInterviewers()
        .then((ivs) => {
          setConnectedInterviewers(ivs);
          // Auto-select all
          setSelectedUuids(ivs.map((iv) => iv.uuid));
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoadingInterviewers(false));
    }
  }, [calendarConnected]);

  const handleConnectGoogle = async () => {
    setConnecting(true);
    try {
      const { url } = await getGoogleAuthUrl();
      // Redirect to Google consent page
      window.location.href = url;
    } catch (err) {
      setError("Failed to start Google connection");
      setConnecting(false);
    }
  };

  const toggleInterviewer = (uuid: string) => {
    setSelectedUuids((prev) =>
      prev.includes(uuid) ? prev.filter((id) => id !== uuid) : [...prev, uuid]
    );
  };

  const handleFindSlots = async () => {
    if (selectedUuids.length === 0) {
      setError("Please select at least one interviewer");
      return;
    }
    setLoadingSlots(true);
    setError(null);
    setSelectedSlot(null);
    setConfirmedSlot(null);
    try {
      const result = await querySlots({
        candidate_uuid: candidateUuid,
        candidate_name: candidateName,
        interviewer_uuids: selectedUuids,
        date_from: dateFrom,
        date_to: dateTo,
      });
      setSlots(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to query slots");
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedSlot) return;
    if (!candidateUuid || candidateUuid === "00000000-0000-0000-0000-000000000000") {
      setError("Please select a valid candidate before confirming interview schedule.");
      return;
    }
    setConfirming(true);
    setError(null);
    try {
      const result = await confirmSlot({
        candidate_uuid: candidateUuid,
        candidate_name: candidateName,
        interviewer_uuids: selectedUuids,
        start: selectedSlot.start,
        end: selectedSlot.end,
      });
      setConfirmedSlot(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm slot");
    } finally {
      setConfirming(false);
    }
  };

  const slotsByDay = slots.reduce<Record<string, TimeSlot[]>>((acc, s) => {
    const day = s.start.slice(0, 10);
    if (!acc[day]) acc[day] = [];
    acc[day].push(s);
    return acc;
  }, {});
  const sortedDays = Object.keys(slotsByDay).sort();

  // Show Google Connect screen if not connected
  if (calendarConnected === null || connecting) {
    return (
      <AppShell candidateName={candidateName} scroll={false} padded={false}>
        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
          <Loader2 size={32} strokeWidth={1.5} color={D.blue} style={{ animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: 13, color: D.muted }}>{connecting ? "Connecting Google Calendar..." : "Checking calendar status..."}</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </AppShell>
    );
  }

  if (calendarConnected === false) {
    return (
      <AppShell candidateName={candidateName} scroll={false} padded={false}>
        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, padding: 40 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: D.blueSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Calendar size={28} strokeWidth={1.5} color={D.blue} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: D.ink, marginBottom: 6 }}>Connect Google Calendar</div>
            <div style={{ fontSize: 13, color: D.sub, maxWidth: 400, lineHeight: 1.6 }}>
              To schedule interviews, you need to connect your Google Calendar. This allows the system to check your availability and create calendar events automatically.
            </div>
          </div>
          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 6, background: `${D.red}0B`, border: `1px solid ${D.red}22`, fontSize: 11, color: D.sub }}>
              <AlertCircle size={12} strokeWidth={2} color={D.red} />
              {error}
            </div>
          )}
          <button
            onClick={handleConnectGoogle}
            disabled={connecting}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "12px 28px", border: "none", borderRadius: 8,
              background: D.blue, color: "#fff",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <Link2 size={16} strokeWidth={2} />
            Connect Google Calendar
          </button>
          <div style={{ fontSize: 11, color: D.dim, marginTop: 4 }}>
            You only need to do this once. The system will remember your connection.
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </AppShell>
    );
  }

  // Main scheduling UI (connected)
  return (
    <AppShell candidateName={candidateName} scroll={false} padded={false}>
      {/* Split panes manage their own scrolling, so the shell hands over the
          full height untouched (scroll=false, padded=false). */}
      <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Sub-header */}
      <div style={{ height: 38, background: D.canvas, borderBottom: `1px solid ${D.line}`, display: "flex", alignItems: "center", padding: "0 20px", gap: 6, flexShrink: 0 }}>
        <Calendar size={12} strokeWidth={1.8} color={D.muted} />
        <span style={{ fontSize: 11, color: D.sub, fontWeight: 500 }}>Schedule Interview</span>
        <ChevronRight size={10} strokeWidth={2} color={D.dim} />
        <span style={{ fontSize: 11, color: D.blue, fontWeight: 600 }}>Time Slots</span>
        {candidatesList.length > 0 && (
          <div style={{ marginLeft: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: D.muted }}>Candidate:</span>
            <select
              value={candidateUuid}
              onChange={(e) => {
                const selected = candidatesList.find((c) => c.uuid === e.target.value);
                if (selected) {
                  setCandidateUuid(selected.uuid);
                  setCandidateName(selected.full_name);
                }
              }}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 4,
                border: `1px solid ${D.line}`,
                background: D.surface,
                color: D.ink,
                outline: "none",
                cursor: "pointer",
              }}
            >
              {candidatesList.map((c) => (
                <option key={c.uuid} value={c.uuid}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </div>
        )}
        {confirmedSlot && (
          <>
            <ChevronRight size={10} strokeWidth={2} color={D.dim} />
            <span style={{ fontSize: 11, color: D.mint, fontWeight: 600 }}>Confirmed</span>
          </>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9.5, color: D.mint }}>
          <CheckCircle2 size={10} strokeWidth={2} color={D.mint} />
          Calendar Connected
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* LEFT PANEL — Interviewers */}
        <div style={{ flex: "0 0 220px", minWidth: 0, display: "flex", flexDirection: "column", background: D.canvas, borderRight: `1px solid ${D.line}` }}>
          <div style={{
            height: 36, background: D.canvas, borderBottom: `1px solid ${D.line}`,
            display: "flex", alignItems: "center", padding: "0 12px", flexShrink: 0, gap: 6,
          }}>
            <Users size={12} strokeWidth={1.8} color={D.muted} />
            <span style={{ fontSize: 11, fontWeight: 600, color: D.ink }}>Interviewers</span>
            <span style={{ fontSize: 9, color: D.muted, fontFamily: D.mono }}>({selectedUuids.length}/{connectedInterviewers.length})</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
            {loadingInterviewers ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                <Loader2 size={16} strokeWidth={2} color={D.muted} style={{ animation: "spin 1s linear infinite" }} />
              </div>
            ) : connectedInterviewers.length === 0 ? (
              <div style={{ padding: "16px 8px", textAlign: "center", fontSize: 10.5, color: D.muted }}>
                No interviewers with connected calendars found.
              </div>
            ) : (
              connectedInterviewers.map((iv) => (
                <InterviewerCard
                  key={iv.uuid}
                  interviewer={iv}
                  selected={selectedUuids.includes(iv.uuid)}
                  onToggle={() => toggleInterviewer(iv.uuid)}
                />
              ))
            )}
          </div>
        </div>

        {/* CENTER PANEL — Date Range + Slots */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: D.canvas }}>
          <div style={{
            height: 36, background: D.canvas, borderBottom: `1px solid ${D.line}`,
            display: "flex", alignItems: "center", padding: "0 16px", flexShrink: 0, gap: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Calendar size={12} strokeWidth={1.8} color={D.muted} />
              <span style={{ fontSize: 10, fontWeight: 500, color: D.sub }}>From</span>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                style={{ fontSize: 10, fontFamily: D.mono, padding: "2px 6px", border: `1px solid ${D.line}`, borderRadius: 4, background: D.surface, color: D.ink, outline: "none" }} />
              <span style={{ fontSize: 10, fontWeight: 500, color: D.sub }}>To</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                style={{ fontSize: 10, fontFamily: D.mono, padding: "2px 6px", border: `1px solid ${D.line}`, borderRadius: 4, background: D.surface, color: D.ink, outline: "none" }} />
            </div>
            <div style={{ width: 1, height: 18, background: D.line }} />
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={10} strokeWidth={2} color={D.muted} />
              <select value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))}
                style={{ fontSize: 10, fontFamily: D.mono, padding: "2px 4px", border: `1px solid ${D.line}`, borderRadius: 4, background: D.surface, color: D.ink, outline: "none", cursor: "pointer" }}>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
                <option value={90}>90 min</option>
                <option value={120}>120 min</option>
              </select>
            </div>
            <div style={{ flex: 1 }} />
            <button
              onClick={handleFindSlots}
              disabled={loadingSlots || selectedUuids.length === 0}
              style={{
                display: "flex", alignItems: "center", gap: 5, padding: "4px 14px",
                border: `1px solid ${D.blue}`, borderRadius: 5, background: D.blue, color: "#fff",
                fontSize: 10.5, fontWeight: 600,
                cursor: selectedUuids.length === 0 ? "default" : "pointer",
                opacity: selectedUuids.length === 0 ? 0.5 : 1,
              }}
            >
              {loadingSlots
                ? <Loader2 size={11} strokeWidth={2} style={{ animation: "spin 1s linear infinite" }} />
                : <Search size={11} strokeWidth={2} />}
              {loadingSlots ? "Searching..." : "Find Available Slots"}
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>
            {error && (
              <div style={{
                display: "flex", alignItems: "flex-start", gap: 6, padding: "8px 12px",
                borderRadius: 5, background: `${D.red}0B`, border: `1px solid ${D.red}22`,
                marginBottom: 12, fontSize: 10.5, color: D.sub, lineHeight: 1.5,
              }}>
                <AlertCircle size={11} strokeWidth={2} color={D.red} style={{ marginTop: 1, flexShrink: 0 }} />
                {error}
              </div>
            )}

            {slots.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <SectionLabel>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Zap size={10} strokeWidth={2} color={D.blue} />
                    Available Slots ({slots.length})
                  </div>
                </SectionLabel>
                <WorkHoursBar slots={slots} />
              </div>
            )}

            {slots.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {sortedDays.map((day) => (
                  <div key={day}>
                    <div style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                      color: D.muted, padding: "6px 4px 4px", borderBottom: `1px solid ${D.lineSoft}`, marginBottom: 4,
                    }}>
                      {formatDate(slotsByDay[day][0].start)}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {slotsByDay[day].map((slot, i) => {
                        const isSelected = selectedSlot === slot;
                        return (
                          <div key={i} onClick={() => { setSelectedSlot(slot); setConfirmedSlot(null); }}
                            style={{
                              display: "flex", alignItems: "center", gap: 10,
                              padding: "7px 12px", borderRadius: 5,
                              border: `1px solid ${isSelected ? `${D.blue}50` : D.lineSoft}`,
                              background: isSelected ? D.blueSoft : D.surface,
                              cursor: "pointer", transition: "all 0.12s ease",
                            }}
                          >
                            <div style={{
                              width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                              border: `2px solid ${isSelected ? D.blue : D.line}`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              {isSelected && <div style={{ width: 6, height: 6, borderRadius: "50%", background: D.blue }} />}
                            </div>
                            <Clock size={11} strokeWidth={2} color={isSelected ? D.blue : D.muted} />
                            <span style={{ fontSize: 11.5, fontWeight: 600, color: D.ink, fontFamily: D.mono }}>
                              {new Date(slot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {new Date(slot.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <Badge color={D.blue} bg={D.blueSoft}>{slot.duration_minutes} min</Badge>
                            <div style={{ flex: 1 }} />
                            {isSelected && <Badge color={D.blue} bg={D.blueSoft}><Check size={8} strokeWidth={2} />Selected</Badge>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loadingSlots && slots.length === 0 && !error && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", gap: 8 }}>
                <Calendar size={28} strokeWidth={1.5} color={D.dim} />
                <span style={{ fontSize: 12, color: D.muted }}>Select interviewers and date range, then click &quot;Find Available Slots&quot;</span>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL — Confirmation */}
        <div style={{ flex: "0 0 28%", minWidth: 0, display: "flex", flexDirection: "column", background: D.canvas, borderLeft: `1px solid ${D.line}` }}>
          <div style={{
            height: 36, background: D.canvas, borderBottom: `1px solid ${D.line}`,
            display: "flex", alignItems: "center", padding: "0 16px", flexShrink: 0, gap: 6,
          }}>
            <CheckCircle2 size={12} strokeWidth={1.8} color={D.muted} />
            <span style={{ fontSize: 11, fontWeight: 600, color: D.ink }}>Confirm</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
            {confirmedSlot ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeSlideIn 0.3s ease both" }}>
                <div style={{
                  padding: "12px 14px", borderRadius: 6,
                  background: D.mintSoft, border: `1px solid ${D.mint}28`,
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <CheckCircle2 size={18} strokeWidth={1.8} color={D.mint} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: D.ink }}>Interview Confirmed</div>
                    <div style={{ fontSize: 10.5, color: D.sub }}>Slot has been booked successfully</div>
                  </div>
                </div>
                <Divider />
                <div style={{ fontSize: 10, color: D.sub, fontFamily: D.mono, lineHeight: 1.7 }}>
                  <div><strong style={{ color: D.ink }}>Candidate:</strong> {candidateName}</div>
                  <div><strong style={{ color: D.ink }}>Start:</strong> {formatDate(confirmedSlot.start)} {new Date(confirmedSlot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  <div><strong style={{ color: D.ink }}>End:</strong> {formatDate(confirmedSlot.end)} {new Date(confirmedSlot.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  <div><strong style={{ color: D.ink }}>Interviewers:</strong> {selectedUuids.length} selected</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 4,
                    background: confirmedSlot.calendar_event_id ? D.mintSoft : `${D.amber}0A`,
                    border: `1px solid ${confirmedSlot.calendar_event_id ? D.mint + "28" : D.amber + "22"}`,
                    fontSize: 10, color: D.sub,
                  }}>
                    <Calendar size={10} strokeWidth={2} color={confirmedSlot.calendar_event_id ? D.mint : D.amber} />
                    <span style={{ flex: 1 }}>
                      {confirmedSlot.calendar_event_id ? "Calendar event created" : "Calendar event skipped"}
                    </span>
                  </div>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 4,
                    background: confirmedSlot.notified ? D.mintSoft : `${D.amber}0A`,
                    border: `1px solid ${confirmedSlot.notified ? D.mint + "28" : D.amber + "22"}`,
                    fontSize: 10, color: D.sub,
                  }}>
                    {confirmedSlot.notified ? <Check size={10} strokeWidth={2} color={D.mint} /> : <AlertCircle size={10} strokeWidth={2} color={D.amber} />}
                    <span>{confirmedSlot.notified ? <>Email sent to <strong style={{ color: D.ink }}>the candidate</strong></> : "Email not sent"}</span>
                  </div>
                </div>
                <button onClick={() => { setConfirmedSlot(null); setSelectedSlot(null); setSlots([]); }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    padding: "8px 14px", border: `1px solid ${D.line}`, borderRadius: 5,
                    background: D.canvas, cursor: "pointer", fontSize: 10.5, fontWeight: 600, color: D.sub, marginTop: 8,
                  }}>
                  <RefreshCw size={11} strokeWidth={2} />Schedule Another
                </button>
              </div>
            ) : selectedSlot ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <SectionLabel>Selected Time Slot</SectionLabel>
                  <div style={{ padding: "10px 14px", borderRadius: 6, background: D.blueSoft, border: `1px solid ${D.blue}28` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: D.ink, fontFamily: D.mono, marginBottom: 2 }}>
                      {formatDate(selectedSlot.start)}
                    </div>
                    <div style={{ fontSize: 12, fontFamily: D.mono, color: D.blue, marginBottom: 4 }}>
                      {new Date(selectedSlot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {new Date(selectedSlot.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <Badge color={D.blue} bg={D.blueSoft}>
                      <Clock size={9} strokeWidth={2} /> {selectedSlot.duration_minutes} minutes
                    </Badge>
                  </div>
                </div>
                <Divider />
                <div>
                  <SectionLabel>Details</SectionLabel>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 10.5, color: D.sub, lineHeight: 1.6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <User size={10} strokeWidth={2} color={D.muted} />
                      <strong style={{ color: D.ink }}>Candidate:</strong> {candidateName}
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 5 }}>
                      <Users size={10} strokeWidth={2} color={D.muted} style={{ marginTop: 2 }} />
                      <div>
                        <strong style={{ color: D.ink }}>Interviewers ({selectedUuids.length}):</strong>
                        {connectedInterviewers.filter(iv => selectedUuids.includes(iv.uuid)).map(iv => (
                          <div key={iv.uuid} style={{ fontSize: 10, color: D.sub, fontFamily: D.mono, marginLeft: 10 }}>— {iv.name}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <Divider />
                <button onClick={handleConfirm} disabled={confirming}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "10px 14px", border: "none", borderRadius: 6,
                    background: confirming ? D.muted : D.mint,
                    color: "#fff", fontSize: 12, fontWeight: 700, cursor: confirming ? "default" : "pointer",
                    transition: "all 0.15s ease",
                  }}>
                  {confirming
                    ? <Loader2 size={14} strokeWidth={2} style={{ animation: "spin 1s linear infinite" }} />
                    : <CheckCircle2 size={14} strokeWidth={2} />}
                  {confirming ? "Confirming..." : "Confirm Interview"}
                </button>
              </div>
            ) : (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: "40px 16px", gap: 8, textAlign: "center",
              }}>
                <CheckCircle2 size={26} strokeWidth={1.5} color={D.dim} />
                <span style={{ fontSize: 11.5, color: D.muted }}>Select a time slot from the center panel to confirm</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      </div>
    </AppShell>
  );
}
