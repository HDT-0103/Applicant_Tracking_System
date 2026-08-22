import { api } from "./httpClient";

/* ─── Types ──────────────────────────────────────────────────────── */

export type ReviewDecision = "pending" | "approved" | "rejected";

export interface TLReviewSummary {
  reviewer_id: string;
  decision: ReviewDecision;
  review_text: string;
}

export interface ReviewStatus {
  candidate_uuid: string;
  hr_decision: ReviewDecision;
  hr_review_text: string;
  tl_reviews: TLReviewSummary[];
  total_tls: number;
  approved_tls: number;
  rejected_tls: number;
  overall_status: "waiting_for_tls" | "rejected_by_tls" | "waiting_for_hr" | "rejected_by_hr" | "ready_to_schedule";
}

/* ─── API Calls ────────────────────────────────────────────────────── */

export async function submitReview(
  candidateUuid: string,
  decision: ReviewDecision,
  reviewText: string,
): Promise<ReviewStatus> {
  return api.post<ReviewStatus>(`/api/review/${candidateUuid}`, {
    decision,
    review_text: reviewText,
  });
}

export async function getReviewStatus(
  candidateUuid: string,
): Promise<ReviewStatus> {
  return api.get<ReviewStatus>(`/api/review/${candidateUuid}`);
}
