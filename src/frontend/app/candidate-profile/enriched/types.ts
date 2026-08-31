/* Kiểu dùng chung cho màn hình hồ sơ ứng viên đã enrich.
 * Tách khỏi page.tsx để component con dùng lại mà không phải import
 * ngược từ file trang — vòng import đó sẽ làm Next.js dựng lại cả cây.
 */

export interface GithubRepo {
  name: string;
  language: string | null;
  size: number;
}

export interface GithubProfile {
  public_repos_count: number;
  top_languages: Record<string, number>;
  readme_content: string | null;
  repos: GithubRepo[];
}

export interface LinkedinExperience {
  title: string;
  company: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  is_current?: boolean;
}

export interface LinkedinEducation {
  school: string;
  degree: string | null;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface LinkedinCertification {
  name: string;
  issuing_organization: string;
  issue_date: string | null;
  expiration_date: string | null;
}

export interface LinkedinProfile {
  full_name?: string;
  headline?: string;
  profile_url?: string;
  avatar_url?: string;
  experiences: LinkedinExperience[];
  educations: LinkedinEducation[];
  certifications: LinkedinCertification[];
}

export interface TimelineItem {
  year: string;
  title: string;
  org: string;
  period: string;
  type: "work" | "edu";
  current: boolean;
  note: string;
  verified: boolean;
}

export interface TechnicalSkillMatrix {
  pre_enrichment: number[];
  post_enrichment: number[];
}

export interface MockAnalytics {
  match_confidence_score: number;
  score_increase: number;
  semantic_tags: string[];
  technical_skill_matrix: TechnicalSkillMatrix;
}

export interface EnrichedProfile {
  github: GithubProfile | null;
  linkedin: LinkedinProfile | null;
  analytics: MockAnalytics;
  github_username: string | null;
  linkedin_url: string | null;
  full_name: string | null;
  /**
   * Requirement breakdown written by the CV pipeline
   * (`must_have` / `nice_to_have` / `extra_skills`).
   *
   * Optional and untyped on purpose. It is a column on `enrichment_profiles`
   * and the enrichment WebSocket payload does not carry it yet, so the panel
   * has to degrade to an empty state rather than break. Once the backend
   * includes it, this needs no change here.
   */
  skill_matrix?: unknown;
}

export interface WSMessage {
  status: string;
  data?: EnrichedProfile;
  error?: string;
}

/** Code server dùng khi từ chối handshake xác thực của WebSocket. */
export const WS_UNAUTHORIZED_CODE = 4401;

export interface EnrichmentStatusResponse {
  candidate_uuid: string;
  enrichment_status:
    | "QUEUED"
    | "IN_PROGRESS"
    | "ENRICHED"
    | "ENRICHMENT_FAILED"
    | "NO_PROFILES_FOUND";
  enriched_profile?: EnrichedProfile | null;
}
