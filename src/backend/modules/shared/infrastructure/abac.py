"""ABAC field masking (U006).

Đây là NƠI DUY NHẤT phân biệt `hr` và `tech_lead`. Route và UI của hai role là
như nhau; chỉ dữ liệu ứng viên trả về khác nhau.

Che ở backend chứ không ở frontend: nếu để UI tự ẩn thì PII vẫn nằm trong
network response, mở DevTools là đọc được.

Chính sách của `tech_lead` là **default-deny**: chỉ field nằm trong whitelist
mới đi qua, mọi field khác bị che. Trước đây policy là blacklist (liệt kê field
cần che) nên field PII mới thêm vào schema sẽ tự động lọt ra ngoài.
"""

import threading
import time
from typing import Any

import structlog

from modules.shared.domain.roles import normalise_role

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
        # Mốc thời gian, không định danh ai. `updated_at` đã ở đây từ trước;
        # thiếu `created_at` thì cột "2 giờ trước" trên danh sách ứng viên hiện
        # ra dấu sao, mà đó là thông tin điều phối công việc chứ không phải PII.
        "created_at",
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
        # Kết quả tìm kiếm ngữ nghĩa (modules/search). Đây đúng là thứ một
        # tech lead được giao đọc: mức phù hợp và điểm mạnh/yếu về chuyên môn.
        # KHÔNG có `summary`, `github_summary`, `linkedin_summary` — ba trường
        # đó là văn bản tự do do LLM viết và gần như chắc chắn nhắc tên ứng
        # viên, nên vẫn bị che.
        "score",
        "overall_score",
        "lexical_score",
        "semantic_score",
        "skills",
        "strengths",
        "weaknesses",
        # Chức danh trong lịch sử công việc. `title` và `company` đã có ở trên;
        # `position` là cùng khái niệm dưới tên khác, đến từ DTO của luồng tìm
        # kiếm. Thiếu nó thì dòng kinh nghiệm hiện ra là "*** tại Acme".
        "position",
        "duration",
        "highlights",
        # Tên tin tuyển dụng mà ứng viên nộp vào (CandidateCard trên dashboard).
        # Không phải PII: tech lead vốn thấy danh sách tin và được mời vào hội
        # đồng của đúng tin đó. Tách tên riêng thay vì dùng lại `title` để
        # không lẫn với chức danh trong lịch sử công việc của ứng viên.
        "applied_job_title",
        # Câu trả lời sàng lọc của ứng viên mà tech lead cần để chấm chuyên môn:
        # tự đánh giá kỹ năng và nhóm số năm kinh nghiệm. Không định danh ai.
        # Lương mong muốn, chế độ làm việc, ngày sẵn sàng vẫn bị che — là việc
        # của HR, không phải của hội đồng kỹ thuật.
        "skill_ratings",
        "experience_bucket",
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
# `skill_ratings` = {"Python": 4}: key là tên kỹ năng do ứng viên nhập, cùng lý do.
OPAQUE_FIELDS: frozenset[str] = frozenset({"top_languages", "skill_ratings"})

#: `hr` không bị che gì. `admin` thực tế không gọi được endpoint nghiệp vụ nào
#: (xem require_operational_roles), để đây cho đủ 3 role.
_ROLE_VISIBLE_FIELDS: dict[str, frozenset[str] | None] = {
    "hr": None,  # None = thấy tất cả
    "admin": None,
    "tech_lead": TECH_LEAD_VISIBLE_FIELDS,
}

#: Bảng `abac_policies` liệt kê field CẦN CHE (``strategy='redact'``), tức là
#: một deny-list. Whitelist ở trên mới là nguồn quyết định field nào đi qua.
#: Ta chỉ TRỪ deny-list của DB khỏi whitelist — DB vì vậy chỉ có thể che THÊM,
#: không bao giờ mở khoá được field mà code chưa cho phép.
#:
#: Hệ quả có chủ đích: dòng ``strategy='passthrough'`` trong DB bị BỎ QUA.
#: Nếu tôn trọng nó thì bất kỳ ai ghi được bảng này đều tự mở được PII ứng
#: viên mà không qua code review — biến DB thành đường leo thang đặc quyền.
#: Muốn cho tech_lead thấy thêm field thì sửa TECH_LEAD_VISIBLE_FIELDS.
_CACHE_TTL_SECONDS = 300

#: role đã chuẩn hoá -> tên field bị DB che thêm.
_db_deny_overrides: dict[str, frozenset[str]] = {}
#: -inf nghĩa là "chưa từng nạp". KHÔNG dùng 0.0: time.monotonic() trên Linux đếm
#: từ lúc boot, nên trong 5 phút đầu sau khi máy khởi động thì
#: `monotonic() - 0.0 <= _CACHE_TTL_SECONDS` và cache bị coi là còn hạn — override
#: từ DB không bao giờ được nạp cho tới khi hết TTL. Runner CI (VM vừa tạo) và
#: container vừa deploy đều rơi vào đúng cửa sổ đó.
_last_fetch_time: float = float("-inf")

#: FastAPI phục vụ nhiều request đồng thời; cache dưới đây là biến module dùng
#: chung nên mọi thao tác đọc-ghi phải nằm trong khoá, tránh một request đọc
#: được cache đang vá dở.
_cache_lock = threading.Lock()

def _leaf_field_name(row: dict) -> str | None:
    """Lấy TÊN field từ một dòng policy.

    `_filter` so khớp theo tên field ở mọi độ sâu, không theo đường dẫn có dấu
    chấm. Dòng ``field_path='resume.email'`` vì thế phải quy về ``email``, nếu
    giữ nguyên cả chuỗi thì không bao giờ khớp key nào và policy thành vô hiệu.
    """
    raw = row.get("field_name") or row.get("field_path")
    if not raw:
        return None
    return str(raw).rsplit(".", maxsplit=1)[-1].strip() or None


def _parse_policy_rows(rows: list[dict]) -> dict[str, frozenset[str]]:
    """Quy các dòng `abac_policies` thành deny-list theo role đã chuẩn hoá.

    Tách khỏi phần gọi mạng để test được luật diễn giải mà không cần Supabase.
    """
    overrides: dict[str, set[str]] = {}
    for row in rows or []:
        # Chỉ dòng yêu cầu CHE mới có hiệu lực. `passthrough` bị bỏ qua có chủ
        # đích — xem ghi chú ở _db_deny_overrides.
        if row.get("strategy") != "redact" and row.get("is_masked") is not True:
            continue
        field = _leaf_field_name(row)
        if not field:
            continue
        # Quy đổi từ vựng cũ ('interviewer') về role chuẩn, nếu không thì policy
        # ghi bằng từ vựng trước V005 sẽ không bao giờ được tra tới.
        canonical = normalise_role(row.get("role"))
        if canonical is None:
            logger.warning("abac.policy_unknown_role", role=row.get("role"))
            continue
        overrides.setdefault(canonical, set()).add(field)

    return {r: frozenset(f) for r, f in overrides.items()}


def _fetch_deny_overrides() -> dict[str, frozenset[str]]:
    """Đọc deny-list từ bảng `abac_policies`. Ném lỗi cho caller xử lý."""
    from modules.shared.infrastructure.config import get_settings
    from modules.shared.infrastructure.supabase_client import get_supabase_client

    client = get_supabase_client(get_settings(), use_admin=True)
    if client is None:
        return {}

    res = client.table("abac_policies").select(
        "role, field_path, field_name, strategy, is_masked"
    ).execute()
    return _parse_policy_rows(res.data)


#: Sau khi nạp hỏng thì chờ bấy nhiêu giây mới thử lại.
#: Không có mốc lùi này, một Supabase đang chậm sẽ khiến MỌI request đi mạng
#: lại từ đầu — mỗi lượt che dữ liệu tốn thêm một vòng khứ hồi, nối đuôi nhau.
_RETRY_BACKOFF_SECONDS = 30


def _refresh_deny_overrides() -> None:
    """Nạp lại cache nếu đã quá hạn. Lỗi mạng/DB không làm nới lỏng quyền.

    Ba điều quan trọng về khoá ở đây, vì hàm này nằm trên đường đi của MỌI
    response có che dữ liệu:

    1. Đường nhanh không giành khoá. Đọc một biến float là thao tác nguyên tử
       trong CPython, mà FastAPI chạy handler đồng bộ trên threadpool — bắt mọi
       request xếp hàng chỉ để đọc một mốc thời gian là tự tạo nút cổ chai.
    2. Lượt gọi mạng nằm NGOÀI khoá. Giữ khoá suốt một vòng khứ hồi ~400ms sẽ
       chặn hết các request khác đúng bằng ngần ấy thời gian.
    3. Hỏng thì lùi lại. Trước đây lỗi không dời mốc thời gian, nên request kế
       tiếp lại đi mạng — Supabase chậm biến thành app chậm toàn diện.
    """
    global _last_fetch_time, _db_deny_overrides

    # (1) đường nhanh, không khoá
    if time.monotonic() - _last_fetch_time <= _CACHE_TTL_SECONDS:
        return

    # (2) gọi mạng ngoài khoá
    try:
        overrides = _fetch_deny_overrides()
    except Exception as exc:
        # (3) lùi lại: coi như vừa nạp, nhưng chỉ giữ trong _RETRY_BACKOFF_SECONDS.
        # Cache cũ chỉ có thể che NHIỀU hơn whitelist nên giữ lại vẫn an toàn.
        with _cache_lock:
            _last_fetch_time = (
                time.monotonic() - _CACHE_TTL_SECONDS + _RETRY_BACKOFF_SECONDS
            )
        logger.error("abac.load_policies_failed", error=str(exc))
        return

    # Chỉ giữ khoá đúng lúc tráo kết quả vào. Hai luồng cùng nạp thì cùng ra một
    # kết quả, nên lượt thừa chỉ tốn công chứ không sai.
    with _cache_lock:
        _db_deny_overrides = overrides
        _last_fetch_time = time.monotonic()

    logger.info(
        "abac.deny_overrides_loaded",
        roles={r: sorted(f) for r, f in overrides.items()},
    )


def _get_dynamic_policy(role: str) -> frozenset[str] | None:
    """Whitelist hiệu lực của *role* = whitelist cứng TRỪ deny-list trong DB."""
    # Role lạ (kể cả None) quy về `tech_lead` — policy che nhiều nhất.
    canonical = normalise_role(role) or "tech_lead"
    if canonical != role:
        logger.debug("abac.role_normalised", raw=role, canonical=canonical)

    base = _ROLE_VISIBLE_FIELDS.get(canonical, TECH_LEAD_VISIBLE_FIELDS)
    if base is None:  # hr / admin: không che gì, khỏi cần đụng tới DB
        return None

    _refresh_deny_overrides()
    with _cache_lock:
        extra_hidden = _db_deny_overrides.get(canonical, frozenset())

    return base - extra_hidden



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


#: Dữ liệu nhân khẩu học phục vụ báo cáo đa dạng (EEO). Che với MỌI role, kể
#: cả `hr` và `admin` — đây là ngoại lệ duy nhất đứng trên policy theo role.
#:
#: Lý do không phải kỹ thuật mà là pháp lý và đạo đức: cho người sàng lọc nhìn
#: thấy chủng tộc, giới tính, tình trạng khuyết tật hay tình trạng quân ngũ của
#: ứng viên là tạo thiên kiến ngay tại điểm ra quyết định, và ở nhiều nơi là vi
#: phạm luật tuyển dụng. `hr` mới là role nguy hiểm nhất ở đây vì chính họ đi
#: sàng lọc — che `tech_lead` mà để hở `hr` thì gần như vô nghĩa.
#:
#: Các trường này vẫn nằm nguyên trong DB. Chúng chỉ không được đi ra qua API
#: hồ sơ ứng viên. Báo cáo đa dạng phải truy vấn riêng ở dạng TỔNG HỢP, không
#: gắn với một ứng viên cụ thể.
ALWAYS_REDACTED_FIELDS: frozenset[str] = frozenset(
    {
        "race",
        "ethnicity",
        "gender_identity",
        "gender",
        "pronouns",
        "custom_pronouns",
        "disability_status",
        "military_status",
        "veteran_status",
        "age_group",
        "date_of_birth",
        "marital_status",
        "religion",
        "sexual_orientation",
        "national_origin",
    }
)


def apply_abac(data: dict, role: str) -> dict:
    """Trả về BẢN SAO của *data* đã che field theo policy của *role*.

    Không sửa đối tượng gốc — dữ liệu gốc thường là bản ghi dùng chung trong bộ
    nhớ, che tại chỗ sẽ làm HR cũng mất dữ liệu vĩnh viễn.

    Role lạ được xử lý như `tech_lead` (che nhiều nhất) — fail closed.
    Trường trong ALWAYS_REDACTED_FIELDS bị che bất kể role.
    """
    visible = _get_dynamic_policy(role)
    if visible is None:
        # `hr` / `admin` thấy mọi thứ NGOẠI TRỪ nhân khẩu học EEO.
        return _filter_always_redacted(data)
    # Với role bị giới hạn, trừ thêm EEO khỏi whitelist để dù ai đó lỡ thêm
    # `race` vào TECH_LEAD_VISIBLE_FIELDS thì nó vẫn không lọt ra.
    return _filter(data, visible - ALWAYS_REDACTED_FIELDS)


def _filter_always_redacted(data: dict) -> dict:
    """Che riêng nhóm EEO, giữ nguyên phần còn lại. Đệ quy theo tên field."""
    result: dict = {}
    for key, value in data.items():
        if key in ALWAYS_REDACTED_FIELDS:
            result[key] = _mask_value(value)
        elif key in OPAQUE_FIELDS:
            result[key] = value
        elif isinstance(value, dict):
            result[key] = _filter_always_redacted(value)
        elif isinstance(value, list):
            result[key] = [
                _filter_always_redacted(item) if isinstance(item, dict) else item
                for item in value
            ]
        else:
            result[key] = value
    return result


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
