import { api } from "./httpClient";

/* ─── Frontend Types (page-facing) ──────────────────────────────────────────── */

export interface Interviewer {
  uuid: string;
  name: string;
  email: string;
  calendar_provider: string;
  calendar_id: string | null;
  calendar_api_key: string | null;
  is_active: boolean;
}

export interface TimeSlot {
  start: string;
  end: string;
  duration_minutes: number;
}

export interface ConfirmedSlot {
  uuid: string;
  candidate_name: string;
  candidate_email?: string;
  interviewer_uuids: string[];
  start: string;
  end: string;
  created_at: string;
  notified: boolean;
  calendar_event_id: string | null;
}

export interface SlotsRequest {
  candidate_name: string;
  candidate_email?: string;
  interviewer_uuids: string[];
  date_from: string;
  date_to: string;
  duration_minutes?: number;
  api_key?: string;
}

export interface ConfirmRequest {
  candidate_name: string;
  candidate_email?: string;
  interviewer_uuids: string[];
  start: string;
  end: string;
  notify?: boolean;
  api_key?: string;
}

/* ─── Mock Data ─────────────────────────────────────────────────────────────── */

const MOCK_INTERVIEWERS: Interviewer[] = [
  { uuid: "interviewer-sarah-chen", name: "Sarah Chen", email: "sarah.chen@example.com", calendar_provider: "google", calendar_id: "primary", calendar_api_key: null, is_active: true },
  { uuid: "interviewer-mike-park", name: "Mike Park", email: "mike.park@example.com", calendar_provider: "google", calendar_id: "primary", calendar_api_key: null, is_active: true },
  { uuid: "interviewer-lisa-wong", name: "Lisa Wong", email: "lisa.wong@example.com", calendar_provider: "google", calendar_id: "primary", calendar_api_key: null, is_active: true },
  { uuid: "interviewer-david-kim", name: "David Kim", email: "david.kim@example.com", calendar_provider: "google", calendar_id: "primary", calendar_api_key: null, is_active: true },
];

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_SCHEDULING === "true";

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/* ─── Backend API Mapping ──────────────────────────────────────────────────────
 *     Maps frontend types to/from backend API shapes.
 *     When Supabase is ready, only this section changes.
 * ────────────────────────────────────────────────────────────────────────────── */

/* ─── fetchInterviewers ─────────────────────────────────────────────────────── */

export async function fetchInterviewers(): Promise<Interviewer[]> {
  if (USE_MOCK) {
    await delay(400);
    return MOCK_INTERVIEWERS;
  }
  type BackendIV = { id: string; name: string; role: string; initials: string; color: string; cal_connected: boolean; calendar_api_key: string | null; calendar_id: string };
  const raw = await api.get<BackendIV[]>("/api/scheduling/interviewers");
  return raw.map((iv) => ({
    uuid: iv.id,
    name: iv.name,
    email: iv.calendar_id,
    calendar_provider: "google",
    calendar_id: iv.calendar_id,
    calendar_api_key: iv.calendar_api_key,
    is_active: true,
  }));
}

/* ─── updateCalendarKey ─────────────────────────────────────────────────────── */

export async function updateCalendarKey(
  interviewerUuid: string,
  calendarApiKey: string,
): Promise<Interviewer> {
  type BackendIV = { id: string; name: string; role: string; initials: string; color: string; cal_connected: boolean; calendar_api_key: string | null; calendar_id: string };
  const raw = await api.put<BackendIV>(`/api/scheduling/interviewers/${interviewerUuid}/calendar-key`, {
    api_key: calendarApiKey,
  });
  return {
    uuid: raw.id,
    name: raw.name,
    email: raw.calendar_id,
    calendar_provider: "google",
    calendar_id: raw.calendar_id,
    calendar_api_key: raw.calendar_api_key,
    is_active: true,
  };
}

/* ─── querySlots — ALWAYS calls backend ─────────────────────────────────────── */

export async function querySlots(req: SlotsRequest): Promise<TimeSlot[]> {
  type BackendSlot = { start_time: string; end_time: string; duration_min: number; interviewer_ids: string[]; recommendation: string };
  const raw = await api.post<BackendSlot[]>("/api/scheduling/slots", {
    candidate_id: req.candidate_name,
    interviewer_ids: req.interviewer_uuids,
    date_from: req.date_from,
    date_to: req.date_to,
    api_key: req.api_key ?? "",
  });
  return raw.map((s) => ({
    start: s.start_time,
    end: s.end_time,
    duration_minutes: s.duration_min,
  }));
}

/* ─── confirmSlot — ALWAYS calls backend ────────────────────────────────────── */

export async function confirmSlot(req: ConfirmRequest): Promise<ConfirmedSlot> {
  type BackendConfirm = { id: string; candidate_id: string; start_time: string; end_time: string; interviewer_ids: string[]; calendar_event_id: string | null; slack_notified: boolean; email_notified: boolean; created_at: string };
  const raw = await api.post<BackendConfirm>("/api/scheduling/confirm", {
    candidate_id: req.candidate_name,
    candidate_name: req.candidate_name,
    start_time: req.start,
    end_time: req.end,
    interviewer_ids: req.interviewer_uuids,
    api_key: req.api_key ?? "",
  });
  return {
    uuid: raw.id,
    candidate_name: raw.candidate_id,
    candidate_email: undefined,
    interviewer_uuids: raw.interviewer_ids,
    start: raw.start_time,
    end: raw.end_time,
    created_at: raw.created_at,
    notified: raw.email_notified,
    calendar_event_id: raw.calendar_event_id,
  };
}
