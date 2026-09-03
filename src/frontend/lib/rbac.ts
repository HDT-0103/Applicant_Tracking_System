// Single source of truth cho phân quyền phía frontend.
// Bản sao 1-1 của src/backend/modules/shared/domain/roles.py — đổi một bên thì
// phải đổi bên kia.
//
// Hệ thống có đúng 3 role:
//
//   admin      — chỉ Admin Panel (/admin). Bị chặn khỏi mọi màn hình nghiệp vụ.
//   hr         — workspace đầy đủ, thấy toàn bộ dữ liệu ứng viên.
//   tech_lead  — workspace Y HỆT hr; khác biệt duy nhất là PII ứng viên đã bị
//                backend che (***) trước khi trả về.
//
// Không thêm nhánh giao diện riêng cho tech_lead: nếu để UI tự ẩn thì PII vẫn
// nằm trong network response. Việc che là của tầng ABAC ở backend.

export type UserRole = "admin" | "hr" | "tech_lead";

export const ALL_ROLES: readonly UserRole[] = ["admin", "hr", "tech_lead"];

/** Hai role dùng các màn hình nghiệp vụ. `admin` cố ý không có mặt. */
export const OPERATIONAL_ROLES: readonly UserRole[] = ["hr", "tech_lead"];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  hr: "HR Manager",
  tech_lead: "Tech Lead",
};

/**
 * Hai role người dùng TỰ CHỌN được ở màn hình đăng ký công khai.
 *
 * Bản sao của `SELF_SIGNUP_ROLES` trong `modules/shared/domain/roles.py`.
 * `admin` cố ý không có mặt và không được thêm vào: nó mở `/api/admin/*`.
 * Backend mới là chốt chặn thật — `RegisterRequest.role` chỉ nhận hai giá trị
 * này và trả 422 cho mọi giá trị khác; danh sách ở đây chỉ để dựng giao diện.
 */
export const SELF_SIGNUP_ROLES = ["hr", "tech_lead"] as const;

export type SelfSignupRole = (typeof SELF_SIGNUP_ROLES)[number];

/** Mô tả ngắn hiện cạnh mỗi lựa chọn ở màn hình đăng ký. */
export const SELF_SIGNUP_ROLE_HINTS: Record<SelfSignupRole, string> = {
  hr: "Post jobs, screen applicants and schedule interviews. Sees full candidate details.",
  tech_lead: "Review applicants on a panel. Candidate personal details are hidden.",
};

/** Route duy nhất admin được vào (ngoài các trang công khai). */
export const ADMIN_HOME = "/admin";

/** Từ vựng cũ còn sót trong token/localStorage chưa hết hạn. */
const LEGACY_ROLE_ALIASES: Record<string, UserRole> = {
  recruiter: "hr",
  hr_manager: "hr",
  interviewer: "tech_lead",
};

/** Quy đổi chuỗi role bất kỳ về 1 trong 3 role chuẩn, hoặc undefined. */
export function normaliseRole(raw?: string | null): UserRole | undefined {
  if (!raw) return undefined;
  const value = raw.trim().toLowerCase();
  if ((ALL_ROLES as readonly string[]).includes(value)) return value as UserRole;
  return LEGACY_ROLE_ALIASES[value];
}

/** Trang đích sau khi đăng nhập. Admin đi thẳng vào Admin Panel. */
export function landingPathForRole(role?: UserRole): string {
  return role === "admin" ? ADMIN_HOME : "/";
}

export function isOperationalRole(role?: UserRole): boolean {
  return role !== undefined && (OPERATIONAL_ROLES as readonly string[]).includes(role);
}

/**
 * Admin có được ở lại `pathname` không.
 *
 * Admin chỉ quản trị hệ thống, không tham gia tuyển dụng — mọi route nghiệp vụ
 * đều bị đẩy về /admin. Các trang công khai (/careers) vẫn xem được.
 */
export function isAdminAllowedPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === ADMIN_HOME || pathname.startsWith(`${ADMIN_HOME}/`);
}
