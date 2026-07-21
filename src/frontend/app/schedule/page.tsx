"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Calendar, Clock, Users, CheckCircle2,
  Loader2, Key, User, Zap, AlertCircle,
  ChevronRight, RefreshCw, Check, Search, X,
} from "lucide-react";
import { D, Dot, Badge, SectionLabel, Divider } from "../../lib/shared";
import { useAuth } from "../../contexts/AuthContext";
import { AppHeader } from "../../components/AppHeader";
import {
  fetchInterviewers, querySlots, confirmSlot,
  type Interviewer, type TimeSlot, type ConfirmedSlot,
} from "../../services/schedulingService";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

interface InterviewerCardProps {
  interviewer: Interviewer;
  selected: boolean;
  onToggle: () => void;
}

function InterviewerCard({ interviewer, selected, onToggle }: InterviewerCardProps) {
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
      <div style={{ width: 24, height: 24, borderRadius: "50%", background: D.blue, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 9, fontWeight: 700, color: "#fff" }}>
        {interviewer.name.charAt(0)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: D.ink }}>{interviewer.name}</div>
        <div style={{ fontSize: 9.5, color: D.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{interviewer.email}</div>
      </div>
    </div>
  );
}

function timeToMinutes(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
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
        const daySlotsSorted = daySlots.sort((a, b) => a.start.localeCompare(b.start));
        const workStart = 450;
        const workEnd = 1020;
        const totalRange = workEnd - workStart;
        const scale = totalRange > 0 ? 100 / totalRange : 1;

        return (
          <div key={day}>
            <div style={{ fontSize: 10, fontWeight: 600, color: D.sub, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <Calendar size={10} strokeWidth={2} color={D.muted} />
              {formatDate(daySlotsSorted[0].start)}
              <span style={{ color: D.muted, fontWeight: 400, fontFamily: D.mono, fontSize: 9 }}>
                ({daySlots.length} slots)
              </span>
            </div>
            <div style={{ position: "relative", height: 20, background: D.surface, borderRadius: 4, border: `1px solid ${D.lineSoft}`, overflow: "hidden" }}>
              <div style={{ position: "absolute", left: 0, width: "100%", height: "100%", background: `${D.blue}08` }} />
              {daySlotsSorted.map((slot, i) => {
                const sMin = timeToMinutes(slot.start.slice(11, 16));
                const eMin = timeToMinutes(slot.end.slice(11, 16));
                const left = (sMin - workStart) * scale;
                const width = (eMin - sMin) * scale;
                return (
                  <div key={i} style={{
                    position: "absolute", left: `${left}%`, width: `${Math.max(width, 0.5)}%`,
                    top: 1, bottom: 1, background: D.blue, borderRadius: 2, opacity: 0.7,
                    minWidth: 2,
                  }} title={`${slot.start.slice(11, 16)} - ${slot.end.slice(11, 16)}`} />
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: D.dim, fontFamily: D.mono }}>
              <span>07:30</span>
              <span>17:00</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ApiKeyModal({ open, storedKey, onSave, onClose }: { open: boolean; storedKey: string; onSave: (key: string) => void; onClose: () => void }) {
  const [value, setValue] = React.useState(storedKey);
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    if (open) setValue(storedKey);
  }, [open, storedKey]);

  if (!open) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)",
    }}>
      <div style={{
        width: 420, background: D.canvas, borderRadius: 10,
        border: `1px solid ${D.line}`, overflow: "hidden",
        animation: "fadeSlideIn 0.2s ease both",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", borderBottom: `1px solid ${D.line}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Key size={14} strokeWidth={1.8} color={D.blue} />
            <span style={{ fontSize: 13, fontWeight: 700, color: D.ink }}>Google Calendar API Key</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: D.muted }}>
            <X size={16} strokeWidth={2} />
          </button>
        </div>
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11, color: D.sub, lineHeight: 1.5 }}>
            This key is used to check interviewer calendar availability. It is stored for the session.
          </div>
          <input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Paste your Google Calendar API key"
            style={{
              width: "100%", fontSize: 11.5, fontFamily: D.mono, padding: "8px 10px",
              border: `1px solid ${D.line}`, borderRadius: 5, background: D.surface,
              color: D.ink, outline: "none",
            }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: D.muted, cursor: "pointer" }}>
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} style={{ accentColor: D.blue }} />
            Show key
          </label>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 18px", borderTop: `1px solid ${D.line}` }}>
          <button onClick={onClose} style={{
            padding: "7px 14px", border: `1px solid ${D.line}`, borderRadius: 5,
            background: D.canvas, cursor: "pointer", fontSize: 11, color: D.sub,
          }}>
            Cancel
          </button>
          <button
            onClick={() => { onSave(value); onClose(); }}
            disabled={!value.trim()}
            style={{
              padding: "7px 14px", border: "none", borderRadius: 5,
              background: value.trim() ? D.blue : D.muted, color: "#fff",
              cursor: value.trim() ? "pointer" : "default", fontSize: 11, fontWeight: 600,
            }}
          >
            Save Key
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const searchParams = useSearchParams();
  const { user, hasRole } = useAuth();

  const candidateName = searchParams.get("name") || "Candidate";
  const prefillUuids = searchParams.get("interviewers")?.split(",").filter(Boolean) || [];

  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const [selectedUuids, setSelectedUuids] = useState<Set<string>>(new Set(prefillUuids));
  const [dateFrom, setDateFrom] = useState(daysFromNow(1));
  const [dateTo, setDateTo] = useState(daysFromNow(7));
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingInterviewers, setLoadingInterviewers] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmedSlot, setConfirmedSlot] = useState<ConfirmedSlot | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showApiModal, setShowApiModal] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(45);
  const router = useRouter();

  useEffect(() => {
    if (user && !hasRole("hr", "admin")) {
      router.replace("/");
    }
  }, [user, hasRole, router]);

  useEffect(() => {
    const saved = localStorage.getItem("smartats_calendar_api_key");
    if (saved) setApiKey(saved);
    fetchInterviewers()
      .then(setInterviewers)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingInterviewers(false));
  }, []);

  useEffect(() => {
    if (apiKey) localStorage.setItem("smartats_calendar_api_key", apiKey);
    else localStorage.removeItem("smartats_calendar_api_key");
  }, [apiKey]);

  const handleToggleInterviewer = useCallback((uuid: string) => {
    setSelectedUuids((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  }, []);

  const handleFindSlots = async () => {
    if (selectedUuids.size === 0) {
      setError("Select at least one interviewer");
      return;
    }
    if (!apiKey.trim()) {
      setShowApiModal(true);
      return;
    }
    setLoadingSlots(true);
    setError(null);
    setSelectedSlot(null);
    setConfirmedSlot(null);
    try {
      const uuids = Array.from(selectedUuids);
      const result = await querySlots({
        candidate_name: candidateName,
        interviewer_uuids: uuids,
        date_from: dateFrom,
        date_to: dateTo,
        api_key: apiKey,
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
    setConfirming(true);
    setError(null);
    try {
      const result = await confirmSlot({
        candidate_name: candidateName,
        interviewer_uuids: Array.from(selectedUuids),
        start: selectedSlot.start,
        end: selectedSlot.end,
        api_key: apiKey,
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

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <AppHeader candidateName={candidateName} />

      <ApiKeyModal open={showApiModal} storedKey={apiKey} onSave={setApiKey} onClose={() => setShowApiModal(false)} />

      {/* Sub-header */}
      <div style={{ height: 38, background: D.canvas, borderBottom: `1px solid ${D.line}`, display: "flex", alignItems: "center", padding: "0 20px", gap: 6, flexShrink: 0 }}>
        <Calendar size={12} strokeWidth={1.8} color={D.muted} />
        <span style={{ fontSize: 11, color: D.sub, fontWeight: 500 }}>Schedule Interview</span>
        <ChevronRight size={10} strokeWidth={2} color={D.dim} />
        <span style={{ fontSize: 11, color: D.blue, fontWeight: 600 }}>Time Slots</span>
        {confirmedSlot && (
          <>
            <ChevronRight size={10} strokeWidth={2} color={D.dim} />
            <span style={{ fontSize: 11, color: D.mint, fontWeight: 600 }}>Confirmed</span>
          </>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setShowApiModal(true)}
          title="Change API Key"
          style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "3px 8px", border: `1px solid ${D.line}`, borderRadius: 4,
            background: D.surface, cursor: "pointer", fontSize: 9.5, color: D.sub,
          }}
        >
          <Key size={10} strokeWidth={2} color={apiKey ? D.mint : D.amber} />
          {apiKey ? "Key Set" : "Set API Key"}
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left Panel — Interviewers */}
        <div style={{ flex: "0 0 26%", minWidth: 0, display: "flex", flexDirection: "column", background: D.bg, borderRight: `1px solid ${D.line}` }}>
          <div style={{
            height: 36, background: D.canvas, borderBottom: `1px solid ${D.line}`,
            display: "flex", alignItems: "center", padding: "0 16px", flexShrink: 0, gap: 6,
          }}>
            <Users size={12} strokeWidth={1.8} color={D.muted} />
            <span style={{ fontSize: 11, fontWeight: 600, color: D.ink }}>Interviewers</span>
            <Badge color={D.sub} bg={D.surface}>{interviewers?.length ?? 0}</Badge>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
            {loadingInterviewers ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 20 }}>
                <Loader2 size={14} strokeWidth={2} color={D.blue} style={{ animation: "spin 1s linear infinite" }} />
                <span style={{ fontSize: 11, color: D.muted }}>Loading...</span>
              </div>
            ) : (
              (interviewers ?? []).map((iv) => (
                <InterviewerCard
                  key={iv.uuid}
                  interviewer={iv}
                  selected={selectedUuids.has(iv.uuid)}
                  onToggle={() => handleToggleInterviewer(iv.uuid)}
                />
              ))
            )}
          </div>
        </div>

        {/* Center Panel — Date Range + Slots */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: D.canvas }}>
          <div style={{
            height: 36, background: D.canvas, borderBottom: `1px solid ${D.line}`,
            display: "flex", alignItems: "center", padding: "0 16px", flexShrink: 0, gap: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Calendar size={12} strokeWidth={1.8} color={D.muted} />
              <span style={{ fontSize: 10, fontWeight: 500, color: D.sub }}>From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{
                  fontSize: 10, fontFamily: D.mono, padding: "2px 6px",
                  border: `1px solid ${D.line}`, borderRadius: 4, background: D.surface,
                  color: D.ink, outline: "none",
                }}
              />
              <span style={{ fontSize: 10, fontWeight: 500, color: D.sub }}>To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{
                  fontSize: 10, fontFamily: D.mono, padding: "2px 6px",
                  border: `1px solid ${D.line}`, borderRadius: 4, background: D.surface,
                  color: D.ink, outline: "none",
                }}
              />
            </div>
            <div style={{ width: 1, height: 18, background: D.line }} />
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={10} strokeWidth={2} color={D.muted} />
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                style={{
                  fontSize: 10, fontFamily: D.mono, padding: "2px 4px",
                  border: `1px solid ${D.line}`, borderRadius: 4, background: D.surface,
                  color: D.ink, outline: "none", cursor: "pointer",
                }}
              >
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
              disabled={loadingSlots || selectedUuids.size === 0}
              style={{
                display: "flex", alignItems: "center", gap: 5, padding: "4px 14px",
                border: `1px solid ${D.blue}`, borderRadius: 5, background: D.blue, color: "#fff",
                fontSize: 10.5, fontWeight: 600, cursor: selectedUuids.size === 0 ? "default" : "pointer",
                opacity: selectedUuids.size === 0 ? 0.5 : 1,
              }}
            >
              {loadingSlots
                ? <Loader2 size={11} strokeWidth={2} style={{ animation: "spin 1s linear infinite" }} />
                : <Search size={11} strokeWidth={2} />
              }
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
                      color: D.muted, padding: "6px 4px 4px", borderBottom: `1px solid ${D.lineSoft}`,
                      marginBottom: 4,
                    }}>
                      {formatDate(slotsByDay[day][0].start)}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {slotsByDay[day].map((slot, i) => {
                        const isSelected = selectedSlot === slot;
                        return (
                          <div
                            key={i}
                            onClick={() => { setSelectedSlot(slot); setConfirmedSlot(null); }}
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
                              {slot.start.slice(11, 16)} — {slot.end.slice(11, 16)}
                            </span>
                            <Badge color={D.blue} bg={D.blueSoft}>{slot.duration_minutes} min</Badge>
                            <div style={{ flex: 1 }} />
                            {isSelected && (
                              <Badge color={D.blue} bg={D.blueSoft}>
                                <Check size={8} strokeWidth={2} />Selected
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loadingSlots && slots.length === 0 && !error && (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: "40px 20px", gap: 8,
              }}>
                <Calendar size={28} strokeWidth={1.5} color={D.dim} />
                <span style={{ fontSize: 12, color: D.muted }}>Select interviewers and date range, then click &quot;Find Available Slots&quot;</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel — Confirmation */}
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
                  <div><strong style={{ color: D.ink }}>Candidate:</strong> {confirmedSlot.candidate_name}</div>
                  <div><strong style={{ color: D.ink }}>Start:</strong> {formatDate(confirmedSlot.start)} {confirmedSlot.start.slice(11, 16)}</div>
                  <div><strong style={{ color: D.ink }}>End:</strong> {formatDate(confirmedSlot.end)} {confirmedSlot.end.slice(11, 16)}</div>
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
                      {confirmedSlot.calendar_event_id ? "Calendar event created" : "Calendar event skipped (check API key)"}
                    </span>
                    {confirmedSlot.calendar_event_id && (
                      <span style={{ fontFamily: D.mono, fontSize: 9, color: D.mint }}>{confirmedSlot.calendar_event_id.slice(0, 8)}</span>
                    )}
                  </div>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 4,
                    background: confirmedSlot.notified ? D.mintSoft : `${D.amber}0A`,
                    border: `1px solid ${confirmedSlot.notified ? D.mint + "28" : D.amber + "22"}`,
                    fontSize: 10, color: D.sub,
                  }}>
                    {confirmedSlot.notified ? <Check size={10} strokeWidth={2} color={D.mint} /> : <AlertCircle size={10} strokeWidth={2} color={D.amber} />}
                    <span>
                      {confirmedSlot.notified
                        ? <>Email notification sent to <strong style={{ color: D.ink, fontFamily: D.mono }}>cn20378@gmail.com</strong></>
                        : "Email notification not sent (configure SMTP in .env)"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => { setConfirmedSlot(null); setSelectedSlot(null); setSlots([]); }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    padding: "8px 14px", border: `1px solid ${D.line}`, borderRadius: 5,
                    background: D.canvas, cursor: "pointer", fontSize: 10.5, fontWeight: 600,
                    color: D.sub, marginTop: 8,
                  }}
                >
                  <RefreshCw size={11} strokeWidth={2} />
                  Schedule Another
                </button>
              </div>
            ) : selectedSlot ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <SectionLabel>Selected Time Slot</SectionLabel>
                  <div style={{
                    padding: "10px 14px", borderRadius: 6,
                    background: D.blueSoft, border: `1px solid ${D.blue}28`,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: D.ink, fontFamily: D.mono, marginBottom: 2 }}>
                      {formatDate(selectedSlot.start)}
                    </div>
                    <div style={{ fontSize: 12, fontFamily: D.mono, color: D.blue, marginBottom: 4 }}>
                      {selectedSlot.start.slice(11, 16)} — {selectedSlot.end.slice(11, 16)}
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
                        <strong style={{ color: D.ink }}>Interviewers:</strong>
                        {Array.from(selectedUuids).map((uuid) => {
                            const iv = (interviewers ?? []).find((i) => i.uuid === uuid);
                          return iv ? <div key={uuid} style={{ fontSize: 10, color: D.sub, fontFamily: D.mono, marginLeft: 10 }}>— {iv.name}</div> : null;
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <Divider />

                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "10px 14px", border: "none", borderRadius: 6,
                    background: confirming ? D.muted : D.mint,
                    color: "#fff", fontSize: 12, fontWeight: 700, cursor: confirming ? "default" : "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {confirming
                    ? <Loader2 size={14} strokeWidth={2} style={{ animation: "spin 1s linear infinite" }} />
                    : <CheckCircle2 size={14} strokeWidth={2} />
                  }
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
      `}</style>
    </div>
  );
}
