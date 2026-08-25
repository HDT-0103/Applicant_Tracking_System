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
  /**
   * Số phiếu Tech Lead cần có, backend tính sẵn từ ngưỡng 80%.
   *
   * Frontend KHÔNG tự nhân 0.8: giữ bản sao thứ hai của một luật thì hai bản
   * sẽ lệch, và lúc đó màn hình hứa với người duyệt một điều mà server không
   * thi hành. Xem `modules/review/domain/policy.py`.
   */
  required_tl_approvals: number;
  /** Câu mô tả luật, hiện ngay cạnh nút duyệt để không ai phải đoán. */
  panel_rule: string;
  overall_status: OverallStatus;
}

export type OverallStatus =
  | "waiting_for_tls"
  | "rejected_by_tls"
  | "waiting_for_hr"
  | "rejected_by_hr"
  | "ready_to_schedule";

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

/** Backend từ chối lô lớn hơn ngần này. Khớp với `MAX_BATCH` ở review/adapters/routes.py. */
export const REVIEW_BATCH_LIMIT = 100;

/**
 * Trạng thái review của cả một danh sách ứng viên trong MỘT request.
 *
 * Dashboard trước đây gọi `getReviewStatus` cho từng dòng — 30 ứng viên là 30
 * vòng khứ hồi trước khi bảng hiện ra. Trả về map theo uuid; ứng viên chưa ai
 * chấm vẫn có mục riêng ở trạng thái `waiting_for_tls`.
 */
export async function getReviewStatuses(
  candidateUuids: string[],
): Promise<Record<string, ReviewStatus>> {
  if (candidateUuids.length === 0) return {};

  const unique = Array.from(new Set(candidateUuids));
  const batches: string[][] = [];
  for (let i = 0; i < unique.length; i += REVIEW_BATCH_LIMIT) {
    batches.push(unique.slice(i, i + REVIEW_BATCH_LIMIT));
  }

  const results = await Promise.all(
    batches.map((candidate_uuids) =>
      api.post<Record<string, ReviewStatus>>("/api/review/batch", { candidate_uuids }),
    ),
  );
  return Object.assign({}, ...results);
}
