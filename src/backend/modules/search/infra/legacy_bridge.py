"""Cầu nối tới các service tìm kiếm nằm trong cây `src/backend/app/`.

## Vì sao cần một file riêng cho việc này

Repo đang có hai cây code song song do lịch sử merge để lại:

* `modules/*` — kiến trúc hiện tại, được `apps/main.py` nạp;
* `app/*` — nơi nhóm AI agent xây luồng tìm kiếm ngữ nghĩa và xếp hạng.

Cây thứ hai import bằng tiền tố `src.backend.app.*`, cần GỐC REPO nằm trên
`sys.path`. Nhưng app chạy với `PYTHONPATH=src:src/backend` (xem `run.py`), nên
tiền tố đó không phân giải được — và đó chính là lý do toàn bộ luồng tìm kiếm
tuy đã có mặt trên `main` nhưng chưa bao giờ chạm được từ HTTP.

Cách chữa gọn nhất KHÔNG phải là đổi import của 84 file bên `app/`: nhóm khác
đang làm việc trên đó và một lần đổi hàng loạt sẽ va chạm với mọi nhánh của họ.
Thay vào đó, gom toàn bộ phần vá `sys.path` vào đúng file này, có ghi chú, và
để mọi nơi khác import qua đây.

`conftest.py` ở gốc repo làm y hệt cho test — đó là lý do bộ test của `app/`
chạy được trong khi ứng dụng thật thì không.
"""

import sys
from pathlib import Path

import structlog

logger = structlog.get_logger(__name__)

#: .../ATS — thư mục chứa `src/`.
_REPO_ROOT = Path(__file__).resolve().parents[5]


def _ensure_repo_root_on_path() -> None:
    root = str(_REPO_ROOT)
    if root not in sys.path:
        sys.path.insert(0, root)


_ensure_repo_root_on_path()

# Import SAU khi vá đường dẫn. Thứ tự ở đây là quan trọng, đừng để công cụ sắp
# xếp import tự động đẩy khối này lên trên.
from src.backend.app.dtos.candidate_search import (  # noqa: E402
    CandidateSearchResultDTO,
    HardFilterDTO,
    SearchRequirementDTO,
    SoftRequirementDTO,
)
from src.backend.app.repositories.candidate_search_repository import (  # noqa: E402
    CandidateSearchRepository,
)
from src.backend.app.repositories.enrichment_repository import (  # noqa: E402
    EnrichmentRepository,
)
from src.backend.app.services.candidate_search_service import (  # noqa: E402
    CandidateSearchService,
)
from src.backend.app.services.embedding_service import EmbeddingService  # noqa: E402
from src.backend.app.services.ranking_service import RankingService  # noqa: E402

__all__ = [
    "CandidateSearchResultDTO",
    "CandidateSearchRepository",
    "CandidateSearchService",
    "EmbeddingService",
    "EnrichmentRepository",
    "HardFilterDTO",
    "RankingService",
    "SearchRequirementDTO",
    "SoftRequirementDTO",
]

# Pipeline xử lý CV (bóc tách bằng LLM + vector + điểm khớp theo tin). Cùng
# cây `app/`, cùng lý do phải đi qua đây. `modules/scoring/application/
# cv_pipeline.py` là nơi duy nhất dùng các tên này.
from src.backend.app.pipelines.cv_processing_pipeline import (  # noqa: E402
    CVProcessingPipeline,
)
from src.backend.app.repositories.application_repository import (  # noqa: E402
    ApplicationRepository,
)
from src.backend.app.repositories.embedding_repository import (  # noqa: E402
    EmbeddingRepository,
)
from src.backend.app.repositories.job_embedding_repository import (  # noqa: E402
    JobEmbeddingRepository,
)
from src.backend.app.repositories.job_posting_repository import (  # noqa: E402
    JobPostingRepository,
)
from src.backend.app.services.llm_provider import (  # noqa: E402
    LLMNotConfiguredError,
    build_default_llm_provider,
)
from src.backend.app.services.llm_service import LLMService  # noqa: E402
