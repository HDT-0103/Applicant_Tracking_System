import { api } from "./httpClient";

/**
 * Tìm kiếm ứng viên theo yêu cầu tuyển dụng viết bằng ngôn ngữ tự nhiên.
 *
 * Kết quả đã được backend che PII theo role: `tech_lead` nhận điểm số, kỹ
 * năng, điểm mạnh/yếu và lịch sử công việc, nhưng ba trường tóm tắt dạng văn
 * bản tự do đều là `***` — chúng do LLM viết và gần như chắc chắn nhắc tên
 * ứng viên.
 */

export interface SearchExperience {
  company: string;
  position: string;
  duration: string;
  highlights: string[];
}

export interface SearchResult {
  candidate_uuid: string;
  score: number;
  summary: string;
  skills: string[];
  strengths: string[];
  weaknesses: string[];
  experiences: SearchExperience[];
  github_summary: string | null;
  linkedin_summary: string | null;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  /** Ngưỡng backend đã áp dụng — dùng để biết kết quả ứng với lần kéo nào. */
  min_score: number;
}

export interface SearchRequest {
  summary: string;
  experience?: string;
  required_skills?: string[];
  top_k?: number;
  min_score?: number;
}

/** Trần do backend đặt (`MAX_TOP_K`). Gửi quá sẽ bị từ chối 422. */
export const MAX_TOP_K = 50;

export async function searchCandidates(req: SearchRequest): Promise<SearchResponse> {
  return api.post<SearchResponse>("/api/search", { ...req } as Record<string, unknown>);
}

/** Giá trị bị che hiện về đúng chuỗi này. */
export const MASKED = "***";

export const isMasked = (value: unknown): boolean => value === MASKED;
