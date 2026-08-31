import { api } from "./httpClient";

/** Một Tech Lead trong hội đồng chấm của một tin tuyển dụng. */
export interface PanelMember {
  reviewer_id: string;
  name: string;
  email: string;
  invited_at: string;
}

/**
 * Tech Lead mà HR có thể mời.
 *
 * Không dùng `/api/admin/users` được: endpoint đó chỉ admin gọi, và nó trả về
 * cả bảng `users`. HR chỉ cần tên với email để chọn đúng người.
 */
export async function listAvailableReviewers(): Promise<PanelMember[]> {
  return api.get<PanelMember[]>("/api/review/reviewers");
}

export async function getPanel(jobPostingId: string): Promise<PanelMember[]> {
  return api.get<PanelMember[]>(`/api/review/panels/${jobPostingId}`);
}

/**
 * Mời một Tech Lead vào hội đồng. Chỉ HR gọi được — backend chặn bằng
 * `require_roles("hr")`, vì để tech lead tự thêm mình là để họ tự cấp quyền
 * xem PII ứng viên.
 */
export async function invitePanelMember(
  jobPostingId: string,
  reviewerId: string,
): Promise<PanelMember[]> {
  return api.post<PanelMember[]>(`/api/review/panels/${jobPostingId}`, {
    reviewer_id: reviewerId,
  });
}

export async function removePanelMember(
  jobPostingId: string,
  reviewerId: string,
): Promise<PanelMember[]> {
  return api.delete<PanelMember[]>(`/api/review/panels/${jobPostingId}/${reviewerId}`);
}
