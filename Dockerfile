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

# Bước 6: NẠP SẴN mô hình nhúng vào image.
#
# `SentenceTransformer("intfloat/multilingual-e5-base")` tải 1.1GB từ Hugging
# Face ở LẦN DÙNG ĐẦU TIÊN. Không nạp sẵn thì mỗi revision mới, mỗi lần
# container khởi động lại, đều tải lại từng đó — request tìm kiếm đầu tiên sau
# mỗi lần deploy treo hàng phút, và nếu Hugging Face chậm hay chặn thì tính
# năng đơn giản là không chạy.
#
# Đổi lại image nặng thêm ~1.1GB. Đó là đánh đổi đúng cho môi trường chạy thật:
# image tải một lần khi deploy, còn mô hình thì tải mỗi lần khởi động.
#
# Đặt ARG BAKE_MODEL=false khi build ở máy dev nếu muốn nhanh.
ARG BAKE_MODEL=true
ENV HF_HOME=/opt/hf-cache
RUN if [ "$BAKE_MODEL" = "true" ]; then \
        python -c "from sentence_transformers import SentenceTransformer; \
                   SentenceTransformer('intfloat/multilingual-e5-base')" ; \
    fi

# Bước 7: Copy toàn bộ code từ thư mục hiện tại ở máy thật vào trong /app của container
COPY . .

# Bước 8: Mở cổng 8000 của container để bên ngoài gọi vào được
EXPOSE 8000

# Bước 9: Lệnh mặc định để khởi chạy FastAPI bằng Uvicorn khi container bật lên
# Entrypoint là `apps.main:app` với --app-dir src/backend. Trước đây ghi
# `app.main:app` — module đó KHÔNG tồn tại, container build xong là chết ngay.
# Bỏ --reload: đó là cờ dành cho lúc dev, chạy production sẽ tự restart âm thầm
# và ăn thêm RAM cho tiến trình theo dõi file.
CMD ["uvicorn", "apps.main:app", "--host", "0.0.0.0", "--port", "8000", "--app-dir", "src/backend"]