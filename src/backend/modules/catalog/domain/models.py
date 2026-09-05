"""Mô hình ĐỌC cho các màn hình danh sách.

Đây là read model, không phải bản sao của bảng: mỗi lớp chỉ mang đúng những
trường màn hình tương ứng cần vẽ. Việc đó có chủ đích — trước đây trình duyệt
`select` thẳng vào PostgREST, và mỗi lần ai đó thêm cột vào `candidates` thì cột
đó lập tức đi ra ngoài mà không ai phải duyệt gì.
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class JobPostingSummary(BaseModel):
    """Một tin tuyển dụng trong danh sách bên trái."""

    id: str
    job_title: str
    status: str
    applicant_count: int = 0


class JobPostingDraft(BaseModel):
    """Nội dung một tin tuyển dụng khi tạo hoặc sửa.

    Danh sách trường là CỐ ĐỊNH. Trước đây trình duyệt gửi thẳng payload vào
    PostgREST, nên client quyết định được cột nào bị ghi — kể cả `created_by`
    hay `id`.
    """

    job_title: str = Field(min_length=1, max_length=255)
    department: Optional[str] = None
    location: Optional[str] = None
    seniority_level: Optional[str] = None
    employment_type: Optional[str] = None
    work_mode: Optional[str] = None
    target_openings: Optional[int] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    must_have_skills: List[str] = Field(default_factory=list)
    nice_to_have_skills: List[str] = Field(default_factory=list)
    description: Optional[str] = None
    key_responsibilities: Optional[str] = None
    requirements: Optional[str] = None
    nice_to_have_qualifications: Optional[str] = None


class CandidateCard(BaseModel):
    """Một dòng ứng viên trên dashboard.

    CỐ Ý KHÔNG mang race / gender_identity / disability_status /
    military_status / age_group. Đó là dữ liệu EEO phục vụ báo cáo tổng hợp;
    đưa lên màn hình sàng lọc là tạo thiên kiến ngay tại chỗ ra quyết định.
    """

    # Tên trường bám theo TỪ VỰNG mà abac.py đã biết (`candidate_uuid`,
    # `company`, `skills_matrix`), chứ không bám theo tên cột trong bảng.
    # Whitelist của ABAC so khớp theo TÊN field, nên một trường đặt tên lệch
    # sẽ bị che nhầm — và cái bị che nhầm ở đây là thứ tech lead cần để làm
    # việc, ví dụ vị trí đang tuyển.
    candidate_uuid: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    created_at: Optional[str] = None
    company: Optional[str] = None
    current_location: Optional[str] = None
    # Tên TIN TUYỂN DỤNG mà ứng viên nộp vào — KHÔNG phải chức danh của ứng
    # viên. Trường này từng tên là `title` (để lọt whitelist ABAC), và frontend
    # vẽ nó ngay dưới tên ứng viên, cạnh `company` là công ty HIỆN TẠI của họ:
    # tech lead đọc "*** — Senior Backend Engineer · Acme" thành "người này
    # đang là Senior Backend ở Acme". Tên mới nói rõ nghĩa và được whitelist
    # riêng trong abac.py.
    applied_job_title: Optional[str] = None
    job_posting_id: Optional[str] = None
    match_confidence_score: Optional[float] = None
    skills_matrix: Optional[Dict[str, Any]] = None
    public_repos_count: Optional[int] = None
    top_languages: Optional[Dict[str, Any]] = None


class CandidateOption(BaseModel):
    """Ứng viên trong ô chọn của màn hình đặt lịch — chỉ cần tên."""

    candidate_uuid: str
    full_name: Optional[str] = None


class ConfirmedSlotSummary(BaseModel):
    id: str
    candidate_uuid: str
    start_time: str
    end_time: Optional[str] = None


class DashboardData(BaseModel):
    """Tất cả những gì dashboard cần, trong MỘT lượt gọi.

    Gộp lại vì ba mảnh này luôn được vẽ cùng nhau; tách thành ba endpoint chỉ
    tạo ba trạng thái tải rời rạc cho cùng một khung hình.
    """

    candidates: List[CandidateCard] = Field(default_factory=list)
    slots: List[ConfirmedSlotSummary] = Field(default_factory=list)


class AnalyticsData(BaseModel):
    """Dữ liệu thô cho màn hình Analytics.

    Không có tên hay email ứng viên: màn hình này vẽ số liệu tổng hợp, nên
    danh tính không cần rời khỏi máy chủ.
    """

    jobs: List[Dict[str, Any]] = Field(default_factory=list)
    applications: List[Dict[str, Any]] = Field(default_factory=list)
    candidate_count: int = 0
    candidates_with_github: int = 0
    candidates_with_linkedin: int = 0
    locations: Dict[str, int] = Field(default_factory=dict)
