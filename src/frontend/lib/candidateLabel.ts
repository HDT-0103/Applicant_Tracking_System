/**
 * Một cách gọi tên ứng viên DUY NHẤT cho mọi màn hình, bất kể role.
 *
 * Backend che PII cho `tech_lead` bằng chuỗi `"***"` — là chuỗi có giá trị,
 * nên `full_name || "Unknown"` KHÔNG rơi vào nhánh fallback. Dashboard từng
 * vẽ heading là `***`, avatar là `**`, và mọi hồ sơ trông giống hệt nhau. Cùng
 * lúc, trang profile tự ghép `Candidate 1a2b3c4d` còn workspace phân tích
 * ghép `candidate-1a2b3c4d`: hai format cho cùng một người.
 *
 * Chuẩn chung: tên thật nếu có và chưa bị che, ngược lại `Candidate #1a2b3c4d`
 * (8 ký tự đầu của uuid). Đủ để tech lead phân biệt hồ sơ với nhau và nói
 * chuyện với HR về đúng người, mà không lộ danh tính.
 */

/** Giá trị bị ABAC che hiện về đúng chuỗi này. */
export const MASKED = "***";

export const isMasked = (value: unknown): boolean => value === MASKED;

/** `Candidate #1a2b3c4d` — định danh ẩn danh, ổn định theo uuid. */
export function anonymousCandidateLabel(uuid: string | null | undefined): string {
  const short = (uuid ?? "").slice(0, 8);
  return short ? `Candidate #${short}` : "Candidate";
}

/**
 * Tên để hiện ở heading. Tên thật nếu có và chưa bị che; nếu không thì nhãn
 * ẩn danh — dùng chung cho cả HR (hồ sơ chưa có tên) lẫn tech lead (bị che).
 */
export function candidateDisplayName(
  fullName: string | null | undefined,
  uuid: string | null | undefined,
): string {
  const name = typeof fullName === "string" ? fullName.trim() : "";
  if (name && !isMasked(name)) return name;
  return anonymousCandidateLabel(uuid);
}

/**
 * Chữ cái trong avatar. Tên thật thì lấy chữ đầu mỗi từ; nhãn ẩn danh thì
 * lấy 2 ký tự đầu của uuid để avatar cũng khác nhau giữa các hồ sơ, thay vì
 * `C#` cho tất cả.
 */
export function candidateInitials(
  fullName: string | null | undefined,
  uuid: string | null | undefined,
): string {
  const name = typeof fullName === "string" ? fullName.trim() : "";
  if (name && !isMasked(name)) {
    return name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  }
  const short = (uuid ?? "").slice(0, 2).toUpperCase();
  return short || "?";
}

/**
 * Dòng phụ dưới tên: tin tuyển dụng mà ứng viên nộp vào, ghi rõ "Applying for"
 * để không bị đọc thành chức danh hiện tại của họ.
 */
export function appliedForLabel(jobTitle: string | null | undefined): string {
  const title = typeof jobTitle === "string" ? jobTitle.trim() : "";
  return title && !isMasked(title) ? `Applying for: ${title}` : "General application";
}
