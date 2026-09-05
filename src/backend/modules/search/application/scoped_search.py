"""Tìm kiếm ứng viên trong đồ thị agent, thu về phạm vi của người gọi.

`CandidateSearchService` của cây `app/` xếp hạng trên TOÀN BỘ ứng viên và
không biết ai đang hỏi. Màn hình `/search` đã được `SearchService` lọc lại theo
`job_visibility`, nhưng chatbot ở dashboard dựng service trần và gợi ý cả ứng
viên nộp vào tin của HR khác. Ở đây phạm vi được ép vào bộ lọc cứng — chạy
TRƯỚC tìm từ khoá/vector — để top-k là top-k trong dữ liệu người này được thấy.
"""

from __future__ import annotations

import asyncio
from typing import List, Optional

from modules.search.infra.legacy_bridge import CandidateSearchService, SearchRequirementDTO
from modules.search.infra.scope import SupabaseSearchScope
from modules.shared.domain.job_visibility import visible_job_posting_ids


class ScopedCandidateSearchService(CandidateSearchService):
    def __init__(self, *, scope: SupabaseSearchScope, user_id: str, role: str, **kwargs) -> None:
        super().__init__(**kwargs)
        self._scope = scope
        self._user_id = user_id
        self._role = role

    def allowed_candidate_ids(self) -> Optional[List[str]]:
        """`None` = không giới hạn (admin); `[]` = không thấy ai. Tính mỗi lượt
        tìm, không cache: hội đồng và tin có thể đổi giữa hai câu hỏi."""
        allowed_jobs = visible_job_posting_ids(self._role, self._user_id, self._scope)
        if allowed_jobs is None:
            return None
        if not allowed_jobs:
            return []
        return self._scope.candidates_for_job_postings(allowed_jobs)

    async def _apply_hard_filters(self, requirement: SearchRequirementDTO) -> Optional[List]:
        base = await super()._apply_hard_filters(requirement)
        # Hai truy vấn Supabase đồng bộ — đẩy ra thread như repo của cây `app/`.
        allowed = await asyncio.to_thread(self.allowed_candidate_ids)
        if allowed is None:
            return base
        if base is None:
            return list(allowed)
        allowed_set = {str(c) for c in allowed}
        return [c for c in base if str(c) in allowed_set]
