# Bước 1: Dùng Image Python 3.12 bản nhỏ gọn (slim) làm nền
FROM python:3.12-slim

# Bước 2: Đặt thư mục làm việc bên trong container là /app
WORKDIR /app

# Bước 3: Cài đặt các thư viện hệ thống cần thiết (nếu có thư viện nào cần biên dịch)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Bước 4: Copy file requirements.txt từ máy thật vào container trước
COPY requirements.txt .

# Bước 5: Tiến hành cài đặt các thư viện Python
RUN pip install --no-cache-dir -r requirements.txt

# Bước 6: Copy toàn bộ code từ thư mục hiện tại ở máy thật vào trong /app của container
COPY . .

# Bước 7: Mở cổng 8000 của container để bên ngoài gọi vào được
EXPOSE 8000

# Bước 8: Lệnh mặc định để khởi chạy FastAPI bằng Uvicorn khi container bật lên
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]