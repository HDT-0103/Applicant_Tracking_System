# Script chạy tay

Thư mục này KHÔNG được pytest thu thập. Đây là chỗ dành cho script cần API key
thật, dịch vụ ngoài, hoặc người ngồi gõ tay — những thứ không đưa vào CI được.

Đặt tên không bắt đầu bằng `test_` là có chủ đích: một file tên `test_*.py`
nhưng không chứa hàm `test_` sẽ được pytest import rồi lặng lẽ bỏ qua. Nhìn vào
báo cáo thì tưởng đã chạy, thực tế chưa hề chạy dòng nào.

## `run_e2e_agent.py`

Chạy trọn vòng agent tìm ứng viên trên dữ liệu thật.

Cần: `GROQ_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` trong `.env`.
Dùng `CLIInteractionGateway` nên sẽ dừng lại hỏi và chờ bạn trả lời.

```bash
set -a; . ./.env; set +a
PYTHONPATH=src:src/backend ./venv/bin/python tests/manual/run_e2e_agent.py
```

Bản tự động, chạy hoàn toàn bằng mock và không tốn quota, nằm ở
`tests/agent/test_agent_flow.py` — chạy trong CI cùng các test khác.
