"""Bỏ qua cả thư mục này trừ khi bật RUN_INTEGRATION_TESTS.

Những test ở đây gọi Supabase THẬT: RPC vector, insert/update trên bảng thật.
Chúng có giá trị — đó là nơi duy nhất kiểm được rằng RPC tồn tại và trả về
đúng hình dạng — nhưng không chạy được trên CI, nơi không có (và không nên có)
khoá vào cơ sở dữ liệu sản xuất.

Theo đúng quy ước đã dùng ở `tests/services/test_github_retrieval_service.py`:
một biến môi trường bật/tắt, để cả repo chỉ có một cách diễn đạt "test này
cần DB".

    RUN_INTEGRATION_TESTS=true ./venv/bin/python -m pytest tests/integration

Dùng `collect_ignore_glob` chứ KHÔNG dùng `pytest_collection_modifyitems`:
hook đó nhận danh sách item của TOÀN BỘ phiên chạy, không riêng thư mục này,
nên đánh dấu skip trong đó sẽ tắt sạch mọi test của repo.
"""
import os

RUN_INTEGRATION = os.getenv("RUN_INTEGRATION_TESTS", "false").lower() == "true"

collect_ignore_glob = [] if RUN_INTEGRATION else ["*"]
