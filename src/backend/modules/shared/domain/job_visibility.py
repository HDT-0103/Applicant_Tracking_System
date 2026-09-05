"""Ai được thấy tin tuyển dụng nào — MỘT luật cho mọi module.

Trước đây chỉ có `tech_lead` bị giới hạn (theo hội đồng chấm, V008), còn `hr`
thấy mọi tin, mọi ứng viên, mọi hồ sơ — kể cả tài khoản vừa đăng ký xong và
chưa tạo gì. Cột `jobs_posting.created_by` được ghi từ lâu nhưng chưa có chỗ
nào ĐỌC nó để lọc.

Luật, viết ở đúng một nơi để catalog / review / search / scheduling không mỗi
module diễn giải một kiểu:

    admin      -> thấy tất cả (thực tế bị chặn khỏi mọi route nghiệp vụ)
    hr         -> tin do CHÍNH MÌNH tạo  (jobs_posting.created_by = user.id)
    tech_lead  -> tin mình được mời vào hội đồng (job_posting_reviewers)
    role khác  -> không thấy gì

Ứng viên đi theo tin: một người được thấy hồ sơ khi hồ sơ đó nộp vào một tin
mình được thấy. Mỗi module tự cung cấp nguồn dữ liệu (repo của module đó)
qua `JobVisibilitySource`; luật thì lấy từ đây.
"""

from typing import Awaitable, List, Literal, Optional, Protocol

VisibilityScope = Literal["all", "created_by", "panel", "none"]


def visibility_scope(role: Optional[str]) -> VisibilityScope:
    """Role này nhìn dữ liệu qua ống kính nào. Fail-closed cho role lạ."""
    if role == "admin":
        return "all"
    if role == "hr":
        return "created_by"
    if role == "tech_lead":
        return "panel"
    return "none"


class JobVisibilitySource(Protocol):
    """Hai câu hỏi mà repo của module phải trả lời được."""

    def job_postings_created_by(self, user_id: str) -> List[str]: ...

    def job_postings_for_reviewer(self, user_id: str) -> List[str]: ...


class AsyncJobVisibilitySource(Protocol):
    def job_postings_created_by(self, user_id: str) -> Awaitable[List[str]]: ...

    def job_postings_for_reviewer(self, user_id: str) -> Awaitable[List[str]]: ...


def visible_job_posting_ids(
    role: Optional[str], user_id: str, source: JobVisibilitySource
) -> Optional[List[str]]:
    """Danh sách id tin được thấy. `None` = không giới hạn; `[]` = không gì cả.

    Phân biệt hai giá trị đó là cố ý: caller phải xử lý `[]` thành "trả về
    rỗng", KHÔNG được coi như "không lọc" — đó chính là lỗ hổng cũ.
    """
    scope = visibility_scope(role)
    if scope == "all":
        return None
    if scope == "created_by":
        return list(source.job_postings_created_by(user_id))
    if scope == "panel":
        return list(source.job_postings_for_reviewer(user_id))
    return []


async def visible_job_posting_ids_async(
    role: Optional[str], user_id: str, source: AsyncJobVisibilitySource
) -> Optional[List[str]]:
    """Bản async cho repo của module review (mọi hàm ở đó đều async)."""
    scope = visibility_scope(role)
    if scope == "all":
        return None
    if scope == "created_by":
        return list(await source.job_postings_created_by(user_id))
    if scope == "panel":
        return list(await source.job_postings_for_reviewer(user_id))
    return []
