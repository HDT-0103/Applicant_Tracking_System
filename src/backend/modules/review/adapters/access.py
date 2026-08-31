"""Gác quyền XEM hồ sơ ứng viên, dùng chung cho nhiều module.

Hồ sơ ứng viên xuất hiện ở ba nơi ngoài module review: trạng thái enrichment,
kênh WebSocket, và file CV gốc. Cả ba đều trả PII, nên cả ba phải hỏi cùng một
câu hỏi — nếu mỗi nơi tự trả lời theo cách riêng thì sớm muộn sẽ có một nơi trả
lời khác, và đó chính là chỗ dữ liệu rò ra.
"""

from typing import Annotated, Callable

from fastapi import Depends, HTTPException, status

from modules.auth.domain.models import AuthUser
from modules.review.adapters.routes import ServiceDep
from modules.review.application.review_service import ReviewService
from modules.shared.infrastructure.auth_dependencies import require_operational_roles


def require_candidate_access(
    param_name: str = "candidate_uuid",
) -> Callable:
    """Dependency: chặn nếu người gọi không được xem hồ sơ ứng viên này.

    `hr` qua hết. `tech_lead` phải nằm trong hội đồng của tin tuyển dụng mà ứng
    viên đã nộp vào.

    Trả 404 chứ không phải 403 khi tech_lead không có quyền: 403 xác nhận rằng
    ứng viên đó CÓ TỒN TẠI, biến endpoint thành công cụ dò xem một người có ứng
    tuyển hay không — bản thân điều đó đã là thông tin cá nhân.
    """

    async def _check(
        candidate_uuid: str,
        service: ServiceDep,
        user: Annotated[AuthUser, Depends(require_operational_roles())],
    ) -> AuthUser:
        allowed = await service.may_access_candidate(
            candidate_uuid=candidate_uuid, user_id=user.id, role=user.role
        )
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Candidate not found.",
            )
        return user

    return _check


async def may_access_candidate(
    service: ReviewService, candidate_uuid: str, user_id: str, role: str
) -> bool:
    """Bản gọi trực tiếp, cho WebSocket — nơi không dùng được Depends."""
    return await service.may_access_candidate(candidate_uuid, user_id, role)
