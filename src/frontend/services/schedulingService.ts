import { api } from "./httpClient";

/* ─── Frontend Types ──────────────────────────────────────────────── */

export interface Interviewer {
  uuid: string;
  name: string;
  email: string;
  role: string;
  cal_connected: boolean;
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
  candidate_uuid: string;
  candidate_name: string;
  interviewer_uuids: string[];
  date_from: string;
  date_to: string;
  duration_minutes?: number;
}

export interface ConfirmRequest {
  candidate_uuid: string;
  candidate_name: string;
  interviewer_uuids: string[];
  start: string;
  end: string;
}

/* ─── API Functions ────────────────────────────────────────────────── */

export async function checkCalendarStatus(): Promise<{ connected: boolean }> {
  return api.get<{ connected: boolean }>("/api/scheduling/calendar-status");
}

export async function getGoogleAuthUrl(): Promise<{ url: string }> {
  return api.get<{ url: string }>("/api/scheduling/auth/google/url");
}

export async function exchangeGoogleCode(code: string): Promise<{ status: string; message: string }> {
  return api.post<{ status: string; message: string }>("/api/scheduling/auth/google/callback", { code });
}

export async function fetchConnectedInterviewers(candidateId?: string): Promise<Interviewer[]> {
  type BackendIV = { id: string; name: string; email: string; role: string; cal_connected: boolean };
  const query = candidateId ? `?candidate_id=${encodeURIComponent(candidateId)}` : "";
  const raw = await api.get<BackendIV[]>(`/api/scheduling/connected-interviewers${query}`);
  return raw.map((iv) => ({
    uuid: iv.id,
    name: iv.name,
    email: iv.email,
    role: iv.role,
    cal_connected: iv.cal_connected,
  }));
}

export async function querySlots(req: SlotsRequest): Promise<TimeSlot[]> {
  type BackendSlot = { start_time: string; end_time: string; duration_min: number; interviewer_ids: string[]; recommendation: string };
  const raw = await api.post<BackendSlot[]>("/api/scheduling/slots", {
    candidate_id: req.candidate_uuid,
    interviewer_ids: req.interviewer_uuids,
    date_from: req.date_from,
    date_to: req.date_to,
    duration_minutes: req.duration_minutes,
  });
  return raw.map((s) => ({
    start: s.start_time,
    end: s.end_time,
    duration_minutes: s.duration_min,
  }));
}

export async function confirmSlot(req: ConfirmRequest): Promise<ConfirmedSlot> {
  type BackendConfirm = { id: string; candidate_id: string; start_time: string; end_time: string; interviewer_ids: string[]; calendar_event_id: string | null; slack_notified: boolean; email_notified: boolean; created_at: string };
  const raw = await api.post<BackendConfirm>("/api/scheduling/confirm", {
    candidate_id: req.candidate_uuid,
    candidate_name: req.candidate_name,
    start_time: req.start,
    end_time: req.end,
    interviewer_ids: req.interviewer_uuids,
  });
  return {
    uuid: raw.id,
    candidate_name: req.candidate_name,
    candidate_email: undefined,
    interviewer_uuids: raw.interviewer_ids,
    start: raw.start_time,
    end: raw.end_time,
    created_at: raw.created_at,
    notified: raw.email_notified,
    calendar_event_id: raw.calendar_event_id,
  };
}

/**
 * Sends room/address details for a confirmed slot to candidate + panel.
 */
export async function sendInterviewDetails(slotId: string, room: string, address: string): Promise<{status: string, message: string}> {
  return api.post<{status: string, message: string}>(`/api/scheduling/${slotId}/send-details`, { room, address });
}
