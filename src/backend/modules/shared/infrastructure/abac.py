"""ABAC field masking (U006).

Đây là NƠI DUY NHẤT phân biệt `hr` và `tech_lead`. Route và UI của hai role là
như nhau; chỉ dữ liệu ứng viên trả về khác nhau.

Che ở backend chứ không ở frontend: nếu để UI tự ẩn thì PII vẫn nằm trong
network response, mở DevTools là đọc được.

Chính sách của `tech_lead` là **default-deny**: chỉ field nằm trong whitelist
mới đi qua, mọi field khác bị che. Trước đây policy là blacklist (liệt kê field
cần che) nên field PII mới thêm vào schema sẽ tự động lọt ra ngoài.
"""

from typing import Any

import structlog

logger = structlog.get_logger(__name__)

_REDACTED = "***"

#: Các field `tech_lead` được phép thấy — thuần chuyên môn, không định danh.
#: Whitelist áp dụng đệ quy theo TÊN field ở mọi độ sâu của payload.
TECH_LEAD_VISIBLE_FIELDS: frozenset[str] = frozenset(
    {
        # Khung bao của CandidateEnrichment / payload WebSocket
        "candidate_uuid",
        "enrichment_status",
        "enriched_profile",
        "updated_at",
        "status",
        "data",
        "skills_matrix",
        "career_trajectory",
        "error",
        # GitHub
        "github",
        "github_username",
        "public_repos_count",
        "top_languages",
        "readme_content",
        "repos",
        "name",
        "language",
        "size",
        # LinkedIn — kinh nghiệm, học vấn, chứng chỉ (KHÔNG gồm tên/ảnh)
        "linkedin",
        "linkedin_url",
        "experiences",
        "educations",
        "certifications",
        "title",
        "company",
        "start_date",
        "end_date",
        "description",
        "school",
        "degree",
        "field_of_study",
        "issuing_organization",
        "issue_date",
        "expiration_date",
        "headline",
        # Analytics / chấm điểm
        "analytics",
        "match_confidence_score",
        "score_increase",
        "semantic_tags",
        "technical_skill_matrix",
        "pre_enrichment",
        "post_enrichment",
    }
)

#: Field mà giá trị là một map DỮ LIỆU (key do dữ liệu sinh ra, không phải tên
#: field trong schema) — ví dụ ``top_languages = {"Go": 0.7}``. Với những field
#: này phải cho cả cây con đi qua, nếu lọc theo key sẽ che nhầm chính dữ liệu.
OPAQUE_FIELDS: frozenset[str] = frozenset({"top_languages"})

#: `hr` không bị che gì. `admin` thực tế không gọi được endpoint nghiệp vụ nào
#: (xem require_operational_roles), để đây cho đủ 3 role.
_ROLE_VISIBLE_FIELDS: dict[str, frozenset[str] | None] = {
    "hr": None,  # None = thấy tất cả
    "admin": None,
    "tech_lead": TECH_LEAD_VISIBLE_FIELDS,
}


def _mask_value(value: Any) -> Any:
    """Che một giá trị mà vẫn GIỮ NGUYÊN kiểu dữ liệu.

    Giữ kiểu là bắt buộc: payload sau khi che còn phải validate lại qua pydantic
    response_model. Che một field số bằng chuỗi "***" sẽ làm response 500 thay
    vì chỉ ẩn dữ liệu.
    """
    if value is None:
        return None
    if isinstance(value, str):
        return _REDACTED
    if isinstance(value, bool):
        return False
    if isinstance(value, (int, float)):
        return 0
    if isinstance(value, list):
        return []
    if isinstance(value, dict):
        return {}
    return _REDACTED


def apply_abac(data: dict, role: str) -> dict:
    """Trả về BẢN SAO của *data* đã che field theo policy của *role*.

    Không sửa đối tượng gốc — dữ liệu gốc thường là bản ghi dùng chung trong bộ
    nhớ, che tại chỗ sẽ làm HR cũng mất dữ liệu vĩnh viễn.

    Role lạ được xử lý như `tech_lead` (che nhiều nhất) — fail closed.
    """
    visible = _ROLE_VISIBLE_FIELDS.get(role, TECH_LEAD_VISIBLE_FIELDS)
    if visible is None:
        return data
    return _filter(data, visible)


def _filter(data: dict, visible: frozenset[str]) -> dict:
    result: dict = {}
    for key, value in data.items():
        if key not in visible:
            result[key] = _mask_value(value)
            continue
        if key in OPAQUE_FIELDS:
            result[key] = value
        elif isinstance(value, dict):
            result[key] = _filter(value, visible)
        elif isinstance(value, list):
            result[key] = [
                _filter(item, visible) if isinstance(item, dict) else item
                for item in value
            ]
        else:
            result[key] = value
    return result
