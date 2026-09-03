#!/bin/bash
# Chạy backend FastAPI trên macOS/Linux.
#
# KHÔNG export .env ở đây. Bản trước dùng
#     export $(grep -v '^#' .env | xargs)
# và nó hỏng ngay với những giá trị đời thật: chuỗi kết nối Azure Blob chứa
# dấu `;` nên shell cắt nó thành nhiều lệnh, còn giá trị có khoảng trắng thì bị
# tách làm đôi. Kết quả là biến vào tiến trình sai mà không có lỗi nào báo.
#
# Không cần export: `modules/shared/infrastructure/config.py` tự nạp `.env`
# (dotenv hiểu đúng dấu nháy và ký tự đặc biệt) ngay khi import.
export PYTHONPATH=src:src/backend
./venv/bin/python -m uvicorn apps.main:app --reload --host 0.0.0.0 --port 8000 --app-dir src/backend
