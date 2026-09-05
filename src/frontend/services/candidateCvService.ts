import { api } from "./httpClient";

export interface CandidateCvLink {
  /** Mở/hiển thị inline (iframe, tab mới). */
  url: string;
  expires_in_seconds: number | null;
  /** Cùng file, máy chủ ép `Content-Disposition: attachment` để tải về. */
  download_url: string | null;
}

/**
 * Xin một đường dẫn tạm để xem CV của ứng viên.
 *
 * Trước đây nút "View CV" gọi thẳng `window.open` vào endpoint backend. Điều
 * hướng của trình duyệt không gắn được header `Authorization`, nên endpoint đó
 * buộc phải để mở — ai biết `candidate_uuid` là tải được CV, khỏi cần tài
 * khoản. Đi qua `api` thì request mang token, và backend gác được.
 */
export async function getCandidateCvLink(candidateUuid: string): Promise<CandidateCvLink> {
  return api.get<CandidateCvLink>(`/api/v1/candidates/${candidateUuid}/cv`);
}

/**
 * Mở CV ở tab mới.
 *
 * Cửa sổ được mở TRƯỚC khi `await`, rồi mới điền địa chỉ vào. Trình duyệt chỉ
 * cho `window.open` khi nó nằm ngay trong cử chỉ bấm của người dùng; mở sau
 * một lượt chờ mạng thì bị chặn pop-up, và người dùng chỉ thấy nút không làm
 * gì cả.
 */
export async function openCandidateCv(candidateUuid: string): Promise<void> {
  const tab = window.open("", "_blank");
  try {
    const { url } = await getCandidateCvLink(candidateUuid);
    if (tab) {
      tab.location.href = url;
    } else {
      // Pop-up bị chặn dù đã mở đồng bộ: điều hướng ngay tab hiện tại còn hơn
      // để người dùng bấm mà không thấy gì.
      window.location.href = url;
    }
  } catch (err) {
    tab?.close();
    throw err;
  }
}
