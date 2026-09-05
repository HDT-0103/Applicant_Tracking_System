"""Phạm vi của người gọi cho kết quả tìm kiếm.

Tìm kiếm ngữ nghĩa chạy trên TOÀN BỘ ứng viên đã được làm giàu hồ sơ — cây
`app/` không biết ai đang hỏi. Trước đây kết quả chỉ được che PII theo role rồi
trả ra ngoài, nên một tech lead ngoài mọi hội đồng, hay một HR chưa tạo tin
nào, vẫn xếp hạng được ứng viên của người khác. Lớp này trả lời hai câu hỏi
mà `job_visibility.py` cần, cộng một câu để lọc kết quả về đúng phạm vi.
"""

from typing import List, Sequence, Set

from supabase import Client


class SupabaseSearchScope:
    def __init__(self, client: Client) -> None:
        self._client = client

    # JobVisibilitySource
    def job_postings_created_by(self, user_id: str) -> List[str]:
        res = (
            self._client.table("jobs_posting")
            .select("id")
            .eq("created_by", user_id)
            .execute()
        )
        return [row["id"] for row in res.data or []]

    def job_postings_for_reviewer(self, reviewer_id: str) -> List[str]:
        res = (
            self._client.table("job_posting_reviewers")
            .select("job_posting_id")
            .eq("reviewer_id", reviewer_id)
            .execute()
        )
        return [row["job_posting_id"] for row in res.data or []]

    def candidates_on_job_postings(
        self, candidate_uuids: Sequence[str], job_posting_ids: Sequence[str]
    ) -> Set[str]:
        if not candidate_uuids or not job_posting_ids:
            return set()
        res = (
            self._client.table("applications")
            .select("candidate_uuid")
            .in_("candidate_uuid", list(candidate_uuids))
            .in_("job_posting_id", list(job_posting_ids))
            .execute()
        )
        return {row["candidate_uuid"] for row in res.data or []}
