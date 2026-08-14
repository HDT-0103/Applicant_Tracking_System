import { api } from "./httpClient";

/* ─── Types ──────────────────────────────────────────────────────────── */

export type ReviewDecision = "pending" | "approved" | "rejected";

export interface ReviewStatus {
  candidate_uuid: string;
  hr_decision: ReviewDecision;
  tl_decision: ReviewDecision;
  hr_review_text: string;
  tl_review_text: string;
  overall_status: "waiting" | "ready_to_schedule" | "rejected" | "conflict";
}

/* ─── API Calls ──────────────────────────────────────────────────────── */

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

export async function resolveConflict(
  candidateUuid: string,
  finalDecision: ReviewDecision,
): Promise<ReviewStatus> {
  return api.post<ReviewStatus>(`/api/review/${candidateUuid}/resolve`, {
    final_decision: finalDecision,
  });
}
