# 📚 Document Kỹ Thuật: Phase D — GitHub Matching & Evidence Building

1. Công việc đã thực hiện (Implemented Features)
   🔹 Module 1: Evidence Builder (src/backend/app/services/github_evidence.py)
   Chức năng: Biến đổi GitHubProjectDTO (dạng object) thành chuỗi văn bản chuẩn hóa (Evidence Text) giúp Embedding Model đọc hiểu tốt nhất.

Hàm chính:

build_single_project_evidence(project: GitHubProjectDTO) -> str: Tạo text cho 1 project (bao gồm Name, Primary Language, Description, Topics).

build_github_evidence(projects: list[GitHubProjectDTO]) -> str: Ghép danh sách Top-K projects thành 1 block text lớn.

🔹 Module 2: GitHub Matching Service (src/backend/app/services/github_matching.py)
Chức năng: Tính toán điểm tương đồng (github_score) giữa Job Posting Embedding và các GitHub Project Embeddings của ứng viên.

Chiến lược chốt (MVP Defaults):

Best-Project Strategy (max): Chấm điểm từng project trong Top-K, lấy project có Cosine Similarity cao nhất làm github_score và lưu lại thông tin best_project + best_embedding.

Re-weighting Support: Khi ứng viên không có GitHub hoặc không retrieval được project nào, hệ thống trả về github_score = None để Application Pipeline sau này tự phân bổ lại trọng số cho Summary & Experience (tránh bị phạt 0 điểm vô lý).

2. Kết quả Kiểm thử (Test Suite & Results)
   🧪 Test Evidence Builder (tests/services/test_github_evidence.py)
   Kiểm tra: Formatter hiển thị đúng tên, ngôn ngữ, description, clean array topics rỗng, và xử lý trường hợp không có project.

Kết quả: PASSED

🧪 Test GitHub Matching (tests/services/test_github_matching.py)
Kiểm tra:

Best-project selection: Với 2 project có Cosine Similarity là 0.8 và 1.0, service chọn chính xác project 1.0 làm best_project.

Missing GitHub: Trả về github_score = None đúng như thiết kế Re-weighting.

Kết quả: PASSED

3. Hướng dẫn Chạy Test & Sử dụng
   💻 Lệnh Chạy Test (Đã kèm PYTHONPATH chống lỗi import)
   Trên Windows PowerShell:

PowerShell
$env:PYTHONPATH="."; pytest tests/services/test_github_evidence.py -v
$env:PYTHONPATH="."; pytest tests/services/test_github_matching.py -v
Trên Git Bash / Linux / macOS:

Bash
PYTHONPATH=. pytest tests/services/test_github_evidence.py -v
PYTHONPATH=. pytest tests/services/test_github_matching.py -v
💡 Cách Sử dụng Service trong Code
Python
from src.backend.app.dtos.github_matching import GitHubMatchResult
from src.backend.app.services.github_matching import GitHubMatchingService

# Khởi tạo service (Inject Embedding Client thực tế)

matching_service = GitHubMatchingService(
retrieval_service=retrieval_service,
embedding_client=your_embedding_client
)

# Chạy matching

result: GitHubMatchResult = await matching_service.match_candidate_github(
candidate_uuid="candidate-uuid-123",
job_query="Python FastAPI Senior Backend",
job_embedding=[0.012, -0.043, ...], # Job Posting Vector
top_k=3
)

if result.github_score is not None:
print(f"Top Score: {result.github_score}")
print(f"Best Project: {result.best_project.name}")
else:
print("Candidate has no relevant GitHub projects. Triggering Re-weighting pipeline...")
📋 Cập nhật Checklist Tiến độ
Plaintext
Phase D — GitHub Matching
[x] Build GitHub project evidence text
[x] Generate embedding for retrieved evidence
[x] Compare evidence embedding with Job Posting
[x] Aggregate Top-K project scores (Max strategy)
[x] Standardize DTO (Pydantic GitHubMatchResult)
[x] Unit Tests & Documented

Phase E & F — Application Pipeline Integration      <-- BƯỚC KẾ TIẾP
[ ] Summary Matching Logic
[ ] Experience Matching Logic
[ ] Re-weighting & Overall Score Aggregation
[ ] Integrate into Application Pipeline & Update DB
