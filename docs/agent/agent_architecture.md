# 📄 TÀI LIỆU KIẾN TRÚC & THIẾT KẾ HỆ THỐNG
## **ATS CANDIDATE SEARCH AGENT SYSTEM**

---

## 1. 📌 Tổng quan Hệ thống (System Overview)

Hệ thống **ATS Candidate Search Agent** là một Agent AI phục vụ việc tìm kiếm, phân tích và đánh giá ứng viên thông qua ngôn ngữ tự nhiên (Natural Language Prompts). Hệ thống được xây dựng trên kiến trúc **ReAct (Reasoning and Acting)** kết hợp với **LangGraph State Machine**, giúp đảm bảo các tiêu chí:

* **Phân tách bạch hoạch**: Tách biệt rõ giữa **Hard Requirements (Filter chính xác)** và **Soft Requirements (Semantic / Lexical Search)**.
* **Xử lý linh hoạt**: Tự động tương tác hỏi lại Recruiter (`InteractionNode`) khi câu truy vấn thiếu thông tin quan trọng.
* **Khả năng tự suy ngẫm (Self-Reflection)**: Đánh giá chất lượng tìm kiếm (`ReflectionNode`) và tự động điều chỉnh câu query tìm lại nếu kết quả chưa đạt yêu cầu.
* **Phụ thuộc độc lập (Clean Architecture)**: Cách ly hoàn toàn logic Agent khỏi tầng Cơ sở dữ liệu và Provider thông qua **Repositories** và **Interfaces**.

---

## 2. 🏗️ Kiến trúc Cấu trúc Dữ liệu (`ATSState`)

State chung của Agent (`ATSState`) lưu trữ toàn bộ thông tin phiên làm việc, tồn tại xuyên suốt qua các Nodes trong LangGraph.

```text
ATSState
├── candidate_search: CandidateSearchState
│   ├── mission: Mission                    # Mục tiêu search, retry count, trạng thái
│   ├── query_assessment: QueryAssessment   # Đánh giá chất lượng query (Đủ/Thiếu thông tin)
│   ├── search_requirement: SearchReq       # Phân tách Hard Filter & Soft Query
│   ├── candidates: List[CandidateContext]  # Danh sách ứng viên retrieved từ DB
│   ├── observations: List[Observation]     # Kết quả tóm tắt từ từng Node (ReAct)
│   ├── reflection: Reflection              # Kết quả đánh giá Retry / Proceed
│   ├── final_decision: RecruiterDecision   # Khuyến nghị tuyển dụng cuối cùng
│   └── action_history: List[ActionRecord]  # Nhật ký từng bước thực thi (Audit Trail)
├── iteration: int                          # Số bước đã thực thi trong Graph
├── max_steps: int                          # Giới hạn an toàn chống vòng lặp vô hạn (Default: 20)
└── messages: List[str]                     # Lịch sử hội thoại với Recruiter
```

---

## 3. 🔄 Luồng Thực thi & Điều hướng (Graph Flow & Routing)

### 3.1. Sơ đồ Luồng (Flowchart)

```text
       [START]
          │
          ▼
     ┌─────────┐
     │ Planner │
     └────┬────┘
          │
    (route_after_planner)
    ├── Thiếu thông tin ─────────► [Interaction] ──────┐
    └── Đủ thông tin                                   │ (User trả lời)
          │                                            │
          ▼                                            │
    ┌───────────┐                                      │
    │ Retrieval │◄─────────────────────────────────────┘
    └─────┬─────┘
          │
          ▼
    ┌────────────┐
    │ Reflection │
    └─────┬──────┘
          │
   (route_after_reflection)
    ├── Retry (Chưa đạt & Retry < Max) ──► [Planner] (Thử lại)
    └── Pass / Hit Limit
          │
          ▼
   ┌───────────────┐
   │ Recruiter     │
   │ Decision      │
   └──────┬────────┘
          │
          ▼
        [END]
```

### 3.2. Quy tắc Điều hướng (Routing Conditions)

1. **`route_after_planner`**:
   * Chuyển sang **`interaction`** nếu `query_assessment.clarification.status == "not_enough"`.
   * Chuyển sang **`retrieval`** nếu query đủ thông tin (`status == "enough"`).

2. **`route_after_reflection`**:
   * Chuyển về **`planner`** nếu `reflection.retry == True` VÀ `retry_count < max_retries` VÀ `iteration < max_steps`.
   * Chuyển sang **`recruiter`** nếu kết quả đạt yêu cầu hoặc đã chạm ngưỡng retry tối đa.

---

## 🧩 4. Chi tiết Chức năng từng Node (Nodes Specification)

### 1. `PlannerNode`
* **Nhiệm vụ**: Phân tích yêu cầu Recruiter, lập plan, và phân tách query thành:
  * **HardFilter**: Địa điểm, kỹ năng bắt buộc, bằng cấp, trường học.
  * **SoftQuery**: Tóm tắt kinh nghiệm, định hướng, yêu cầu GitHub/LinkedIn.
  * **Clarification**: Kiểm tra xem query có bị thiếu thông tin cốt lõi hay không.

### 2. `InteractionNode`
* **Nhiệm vụ**: Giao tiếp với người dùng qua `HumanInteractionGateway` để yêu cầu cung cấp thêm các thông tin còn thiếu trước khi tiến hành search.

### 3. `RetrievalNode`
* **Nhiệm vụ**: Đóng vai trò Actuation (Thực thi). Gọi `CandidateSearchService.search()` để thực hiện **Hybrid Search** (Hard Filter RPC + Dense Vector RPC + Lexical RPC $\rightarrow$ Fusion & Ranking).
* **Đầu ra**: Cập nhật danh sách `CandidateContext` vào State và đẩy 1 `Observation` tóm tắt kết quả tìm kiếm vào history.

### 4. `ReflectionNode`
* **Nhiệm vụ**: Đóng vai trò Critic (Đánh giá). Chỉ đọc `Observation` mới nhất (không đọc trực tiếp raw candidates) để đánh giá xem tập ứng viên tìm được có sát với nhu cầu hay không. Nếu không, đề xuất hướng điều chỉnh cho Planner ở vòng lặp sau.

### 5. `RecruiterDecisionNode`
* **Nhiệm vụ**: Tổng hợp dữ liệu từ `CandidateContext`, đóng vai Recruiter cấp cao đưa ra bảng đánh giá chi tiết cho từng ứng viên (`Strong Hire`, `Hire`, `Consider`, `Reject`), điểm tin cậy, điểm mạnh, điểm yếu và rủi ro.

---

## 🛠️ 5. Kiến trúc Dependency Inversion & Isolation

Hệ thống tuân thủ nghiêm ngặt nguyên lý **Dependency Inversion (SOLID)**:

```text
[LangGraph Nodes] ──(Gọi Interface)──► [LLMProvider] ◄──(Implement)── [GroqProvider]
[RetrievalNode]   ──(Gọi Service)────► [CandidateSearchService]
                                              │
                                     (Tách bạch Repositories)
                                              ├── [EnrichmentProfileRepository]
                                              ├── [CandidateEmbeddingRepository]
                                              └── [ApplicationRepository]
```

* **`LLMProvider`**: Các Node chỉ tương tác qua Abstract Class `LLMProvider`. Việc thay đổi LLM Backend (Groq, OpenAI, Ollama) hoàn toàn không ảnh hưởng đến logic của Agent.
* **`CandidateSearchService`**: Chịu trách nhiệm thực thi Hybrid Search, cách ly hoàn toàn các câu lệnh SQL/RPC Database khỏi Agent.

---

## 💻 6. Hướng dẫn Khởi chạy & Tích hợp (Run & Integration Guide)

### Thư mục Code Chuẩn

```text
src/backend/app/
├── agents/
│   ├── nodes/
│   │   ├── base.py
│   │   ├── interaction.py
│   │   ├── planner.py
│   │   ├── recruiter_decision.py
│   │   ├── reflection.py
│   │   └── retrieval.py
│   ├── graph.py
│   ├── router.py
│   └── state.py
├── services/
│   ├── candidate_search_service.py
│   └── llm_provider.py
└── main.py
```

### Mã nguồn Khởi chạy Demo (`main.py`)

```python
import asyncio
from src.backend.app.agents.graph import build_graph
from src.backend.app.agents.nodes.interaction import CLIInteractionGateway
from src.backend.app.agents.state import ATSState, CandidateSearchState, Mission, MissionStatus
from src.backend.app.services.candidate_search_service import CandidateSearchService
from src.backend.app.services.llm_provider import GroqProvider

async def main():
    # 1. Instantiating Services & Gateways
    llm_provider = GroqProvider(model="llama-3.1-8b-instant")
    search_service = CandidateSearchService(...)  # Inject Repositories vào đây
    cli_gateway = CLIInteractionGateway()

    # 2. Compile Graph
    app = build_graph(
        llm_provider=llm_provider,
        search_service=search_service,
        interaction_gateway=cli_gateway,
    )

    # 3. Setup Prompt & Initial State
    user_query = "Tìm cho tôi Senior Python Developer có kinh nghiệm làm việc với FastAPI và Docker"
    
    initial_state = ATSState(
        messages=[user_query],
        candidate_search=CandidateSearchState(
            mission=Mission(
                objective=user_query,
                current_step="Initial Assessment",
                status=MissionStatus.PENDING,
            )
        ),
    )

    # 4. Invoke Agent
    final_state = await app.ainvoke(initial_state)

    # 5. Get Results
    decision = final_state["candidate_search"].final_decision
    if decision:
        print("\n--- FINAL RECRUITER DECISION ---")
        print(decision.final_summary)

if __name__ == "__main__":
    asyncio.run(main())
```