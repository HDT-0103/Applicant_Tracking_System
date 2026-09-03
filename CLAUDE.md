# SmartATS

Hệ thống theo dõi ứng viên (ATS) cho đồ án Intro2SE — HCMUS. FastAPI +
Next.js + Supabase, có bóc tách CV bằng LLM, làm giàu hồ sơ từ GitHub/LinkedIn,
xếp hạng ngữ nghĩa bằng pgvector, và đặt lịch phỏng vấn qua Google Calendar.

---

## Chạy ở máy local

**Backend** — `PYTHONPATH` phải có **cả hai** thư mục, vì repo trộn ba tiền tố
import (`modules.*`, `app.*`, `src.backend.app.*`):

```bash
PYTHONPATH="$(pwd)/src:$(pwd)/src/backend" ./venv/bin/python -m uvicorn \
    apps.main:app --host 0.0.0.0 --port 8000 --app-dir src/backend
```

**Frontend:** `npm run dev` → http://localhost:3000

`venv` nằm ở **gốc repo** (`./venv`), không phải `src/backend/.venv`. Script
`backend:dev` trong `package.json` trỏ đường dẫn Windows và **không chạy trên
mac**.

## Test

```bash
./venv/bin/python -m pytest -q            # 371 test — GỘP cả hai bộ
npm test                                  # 199 test — vitest, chạy từ GỐC repo
```

**`npm test` phải chạy ở gốc repo.** Script `test` khai trong `package.json` ở
gốc; `src/frontend/package.json` chỉ có `dev`/`build`/`start`/`lint`. Chạy
`npm test` trong `src/frontend` sẽ nhận `Missing script: "test"` — dễ bị hiểu
nhầm là frontend hỏng.

**Repo có HAI thư mục test.** `tests/` ở gốc (agent, pipeline, service của cây
`app/`) và `src/backend/tests/` (module đang chạy). Chạy pytest từ **gốc repo**
để gom cả hai — `conftest.py` ở gốc lo `sys.path` và nạp `.env`.

Test cần Supabase thật nằm ở `tests/integration/` và `tests/repositories/`, tự
bỏ qua trừ khi `RUN_INTEGRATION_TESTS=true`.

## Smoke test hệ thống thật

```bash
# cần backend đang chạy
./venv/bin/python src/backend/scripts/smoke_flows.py
BASE=https://... ./venv/bin/python src/backend/scripts/smoke_flows.py
```

35 phép kiểm HTTP qua 4 luồng SRS, **khẳng định kết quả chứ không chỉ mã trạng
thái**. Nó bắt được thứ pytest không thấy: sai tên cột, thiếu biến môi trường,
RPC chưa tạo, router rơi khỏi `main.py`. Đã hai lần tìm ra lỗi 500 mà toàn bộ
bộ test cho qua.

---

## Kiến trúc

### Hai cây code song song

| Cây | Vai trò |
|---|---|
| `src/backend/modules/*` | Kiến trúc hiện tại. `apps/main.py` nạp 9 router từ đây. |
| `src/backend/app/*` | 84 file của nhóm AI agent: LangGraph, MCP tool, pipeline xếp hạng. |

Cây thứ hai import bằng tiền tố `src.backend.app.*`, cần **gốc repo** trên
`sys.path`. App chạy với `PYTHONPATH=src:src/backend` nên tiền tố đó không phân
giải được — đó là lý do Flow B từng có mặt trên `main` mà không chạm được từ
HTTP.

**`modules/search/infra/legacy_bridge.py`** là chỗ DUY NHẤT vá `sys.path` để
nối hai cây. Đừng đổi import bên `app/` — nhóm khác đang làm việc trên đó và
một lần đổi hàng loạt sẽ va chạm với mọi nhánh của họ.

### Module backend

`admin` `auth` `catalog` `enrichment` `ingestion` `review` `scheduling`
`scoring` `search` `shared` — mỗi module theo lớp `adapters / application /
domain / infra`.

`catalog` sinh ra để thay việc trình duyệt hỏi thẳng PostgREST (xem RLS bên
dưới). `search` là adapter nối Flow B từ cây `app/`.

---

## Những cái bẫy đã tốn thời gian

Đọc phần này trước khi sửa code liên quan.

### ABAC so khớp theo TÊN FIELD

`modules/shared/infrastructure/abac.py` giữ whitelist các field mà `tech_lead`
được thấy, so khớp **đệ quy theo tên**, ở mọi độ sâu. Hệ quả:

- Đặt tên field lệch từ vựng của whitelist là **bị che nhầm** — và default-deny
  che theo KIỂU: số → `0`, list → `[]`, chuỗi → `"***"`.
- Từ vựng chuẩn: `candidate_uuid` (KHÔNG phải `candidate_id`), `title` (không
  phải `job_title`), `company`, `skills_matrix`.
- Đã hai lần phải đổi tên field trong response chỉ để nó đi qua được ABAC.

Thêm field vào whitelist là quyết định bảo mật, không phải sửa lỗi kỹ thuật —
ghi lý do vào comment.

### Tên cột trong Supabase

- `applications.candidate_uuid` — **KHÔNG phải** `candidate_id`
- `candidates.uuid` — không phải `id`
- `confirmed_slots.candidate_uuid`

`tests/test_review_repo_schema.py` ghi lại tên cột mà repo gửi đi, không cần
DB. Sai tên cột là lỗi chỉ lộ ra khi có người bấm vào màn hình.

### Hai biến khoá Supabase, tên gần giống nhau

`Settings` đòi `SUPABASE_SERVICE_ROLE_KEY` (khoá JWT `service_role` cũ), nhưng
client admin ở `modules/shared/infrastructure/supabase_client.py` đọc **thẳng
biến môi trường** `SUPABASE_SERVICE_KEY` (khoá `sb_secret_...` kiểu mới) và
không hề nhìn vào `Settings`.

Thiếu `SUPABASE_SERVICE_KEY` là kiểu hỏng khó chịu nhất: app khởi động bình
thường, `/health` xanh, nhưng mọi route dùng client admin — ingest, catalog,
search, scheduling, review — nhận `None`. Đã mất một vòng deploy vì chuyện này.
Môi trường nào cũng phải có **cả hai**.

### RLS đang BẬT

Anon key nằm trong bundle JavaScript công khai. RLS đã bật trên mọi bảng trừ
`jobs_posting` (policy: anon chỉ đọc tin `PUBLISHED`).

**Đừng thêm truy vấn `supabase.from(...)` mới vào màn hình đã đăng nhập.** Đi
qua `/api/catalog/*`. Backend dùng service-role key và tự quyết quyền bằng
`require_roles` + hội đồng + ABAC.

Ứng dụng **không dùng Supabase Auth** — JWT ký bằng `JWT_SECRET` riêng, nên
`auth.uid()` trong policy luôn NULL. Xem `docs/RLS_RUNBOOK.md`.

### Hội đồng chấm (V008)

Từ migration V008, hồ sơ chỉ đi tiếp khi tin tuyển dụng **có hội đồng Tech
Lead**. Tin chưa mời ai thì hồ sơ nằm im ở `waiting_for_tls`, tech lead mở hồ
sơ nhận **404**, và không có thông báo nào giải thích.

```bash
./venv/bin/python src/backend/scripts/assign_review_panels.py        # báo cáo
./venv/bin/python src/backend/scripts/assign_review_panels.py --all  # lấp
```

Ngưỡng 80% nằm ở **một chỗ duy nhất**: `modules/review/domain/policy.py`.
Backend tính sẵn `required_tl_approvals` và `panel_rule` rồi trả về trong
`ReviewStatus` — **frontend hiển thị con số nhận được, không tự nhân 0.8**.

### Cấu hình frontend nằm ở `src/frontend`, không phải gốc repo

`next.config.ts`, `tailwind.config.ts` và `postcss.config.mjs` đều nằm trong
`src/frontend/`. Đừng chuyển ngược lên gốc:

- Next đọc `next.config` từ **thư mục dự án** (tham số của `next build`), nên
  bản ở gốc trước đây chưa từng được nạp.
- PostCSS dò cấu hình theo **thư mục làm việc**. Mọi script build đều chạy
  `npm --prefix src/frontend`, tức cwd = `src/frontend` — giống hệt cách Vercel
  build với Root Directory = `src/frontend`.
- Đặt sai chỗ thì Tailwind không được nạp: build vẫn XANH, chỉ là trang mất
  sạch class tiện ích.

`src/frontend/package.json` là package Next.js thật (Vercel cần nó ở Root
Directory); `package.json` ở gốc điều phối và gọi vào đó. Thêm thư viện frontend
thì phải khai ở **cả hai** file.

### `.gitignore` từng nuốt file test

Luật `test_*.py` trước đây không neo gốc nên khớp ở mọi độ sâu — 4 file test đã
viết mà không bao giờ được commit. Đã sửa thành `/test_*.py`. Nếu thấy test
chạy ở máy mà CI không có, kiểm `git status --untracked-files=all`.

### Mô hình nhúng nặng

`multilingual-e5-base` chiếm **~1 GB RAM**, nạp mất **7 giây**, cache trong
tiến trình (singleton). `torch` 561 MB, tổng thư viện 1.6 GB.

Ba thứ này khiến backend **không chạy được trên serverless**: mô hình cache
trong tiến trình, WebSocket `/api/enrichment/ws/...`, và `BackgroundTasks` chạy
enrichment sau khi đã trả lời.

`torch` **không nâng được trên macOS Intel** — PyTorch ngừng phát hành wheel
cho x86_64 sau 2.2.2. 27 lỗ hổng còn lại là giới hạn nền tảng, không phải lựa
chọn.

---

## Quy ước

- **Comment giải thích VÌ SAO**, không phải cái gì. Nêu rõ cách hỏng mà đoạn
  code đang ngăn.
- **Không báo thành công cho việc chưa xảy ra.** Đã sửa nhiều chỗ vi phạm:
  metric hạ tầng bịa số, email trả `True` khi chưa cấu hình SMTP, cờ thông báo
  không ghi vào DB. Thà trả lỗi rõ ràng còn hơn xanh giả.
- **Lỗi nghiệp vụ ở tầng application** (`domain/errors.py`), adapter dịch sang
  mã HTTP. Service không import `HTTPException`.
- **Không lộ chi tiết hệ thống cho ứng viên.** Trang `/careers` chỉ hiện một
  câu chung khi hỏng; chi tiết ở lại log.
- **404 chứ không 403** khi tech_lead không được xem hồ sơ — 403 xác nhận ứng
  viên tồn tại, biến endpoint thành công cụ dò.
- Test đặt tên theo hành vi cần giữ, không theo tên hàm.

---

## Tài liệu

| File | Nội dung |
|---|---|
| `docs/RLS_RUNBOOK.md` | Bật RLS trên Supabase, từng bước |
| `docs/NOTIFICATIONS_SETUP.md` | Cấu hình Slack + SMTP |
| `docs/DEPLOY.md` | Triển khai backend lên Azure + frontend lên Vercel, từng bước |
| `docs/PRODUCTION_DEPLOYMENT.md` | Toàn bộ 10 dịch vụ ngoài, kèm lý do chọn |
| `docs/supabase_schema.md` | Bảng và cột trên Supabase |
| `docs/database_design.md`, `docs/schema_notes.md` | Ghi chú thiết kế dữ liệu |
| `docs/phases/*.pdf` | 4 tài liệu môn học (Proposal, SRS, Design, Testing) |

---

## Trạng thái hiện tại

**Chạy được:** cả 4 luồng SRS đều có route và thông. RLS đã bật. CI đã sửa
(trước đó job backend chưa từng pass). Smoke 35/35 trên DB thật.

**Còn tồn đọng:**

| Việc | Ghi chú |
|---|---|
| Chưa deploy | Xem `docs/DEPLOY.md`. Repo đã sẵn sàng (có `.dockerignore`, frontend tách được cho Vercel); phần dựng hạ tầng phải chạy tay. |
| `SMTP_*` chưa cấu hình | `send_room_details` trả 503 kèm lý do — cố ý, không phải lỗi |
| Chỉ có 1 tech lead | Ngưỡng 80% thành 1/1, không minh hoạ được cơ chế hội đồng |
| `RECRUITER_EMAIL_DOMAINS` rỗng | Đăng nhập Google **chỉ chạy cho `ADMIN_EMAILS`** |
| Đăng ký công khai tự chọn `hr` hoặc `tech_lead` | Giữ theo quyết định của chủ dự án. `admin` KHÔNG tự cấp được — `RegisterRequest.role` là Literal hai giá trị, và service kiểm lại lần nữa |
| `/ai-agent-prompt` là mockup tĩnh | Giữ theo quyết định của chủ dự án |
| 5 component frontend chết | Chưa xoá, cần hỏi người viết |

---

## Cách làm việc mà chủ dự án mong đợi

- **Kiểm chứng bằng cách chạy thật**, đừng suy đoán. Nhiều lỗi trong repo này
  chỉ lộ ra khi gọi API thật trên DB thật.
- **Không dùng công cụ trình duyệt** — kiểm qua `curl` / API ở terminal.
- **Nêu nguyên nhân + cách sửa, chờ duyệt** trước khi làm thay đổi lớn.
- **Không tự xoá dữ liệu** trong Supabase của họ. Script tự dọn dữ liệu nó tạo
  thì được; dữ liệu có sẵn thì đưa lệnh để họ tự chạy.
- Báo cáo trung thực: test hỏng thì nói hỏng, chưa kiểm được thì nói chưa kiểm
  được.
