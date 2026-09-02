# Deploy miễn phí để demo

Mục tiêu: hệ thống chạy trên internet thật, có link gửi cho thầy, **không tốn
đồng nào**. Không phải môi trường sản xuất — xem
[PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) nếu sau này cần dùng thật.

Khoảng 1–2 tiếng. Không cần thẻ tín dụng cho phần bắt buộc.

---

## Ràng buộc quyết định mọi lựa chọn

Backend cần **~1,04 GB RAM** chỉ để nạp mô hình nhúng `multilingual-e5-base`,
trước khi phục vụ request nào. Con số này (đã đo) loại sạch các gói free thông
dụng:

| Nền tảng | RAM gói free | Đủ không |
|---|---|---|
| Render Free | 512 MB | ✗ |
| Fly.io free machine | 256 MB | ✗ |
| Koyeb Free | 512 MB | ✗ |
| Vercel Functions | — | ✗ (không có tiến trình thường trú) |
| Hugging Face Spaces | 16 GB | ✗ — **đòi nạp credit cho SDK Docker** |

> **Cập nhật:** Hugging Face Spaces từng là lựa chọn tốt nhất ở đây, nhưng SDK
> Docker hiện yêu cầu nạp credit trước. Phần hướng dẫn HF bên dưới giữ lại
> phòng khi chính sách đổi, nhưng **không còn là phương án chính**.

## Phương án thực tế: Azure Container Apps bằng credit sinh viên

Các bạn **đã dùng Azure Blob** để lưu CV, nghĩa là đã có subscription. Azure for
Students cấp **100 USD credit không cần thẻ tín dụng** — đủ chạy 2 vCPU/4 GiB
liên tục khoảng hai tháng, thừa cho một kỳ bảo vệ.

Đây không phải "free tier vĩnh viễn", nhưng là **0 đồng tiền túi**, và nó chạy
được mô hình mà không phải sửa dòng code nào.

Lệnh cụ thể: [DEPLOY_AZURE.md](DEPLOY_AZURE.md). Nhớ `az containerapp delete`
sau khi bảo vệ xong để khỏi đốt credit.

### Nếu muốn free thật sự vĩnh viễn

Cách duy nhất là **bỏ mô hình nhúng chạy cục bộ** — xem mục cuối tài liệu này.
RAM tụt về ~256 MB và Render Free (512 MB) dùng được. Đổi lại phải viết một
provider mới và reindex toàn bộ vector.

Và ba thứ trong mã nguồn loại bỏ serverless hoàn toàn: mô hình cache trong tiến
trình, WebSocket `/api/enrichment/ws/...`, và `BackgroundTasks` chạy enrichment
*sau khi* đã trả lời.

## Chốt phương án

| Thành phần | Nền tảng | Giá |
|---|---|---|
| Frontend | Vercel Hobby | 0đ |
| Backend | **Azure Container Apps** (credit sinh viên) | 0đ tiền túi |
| Database | Supabase Free | 0đ |
| File CV | Azure Blob (credit sinh viên) | 0đ |
| Bóc tách CV | Gemini API free tier | 0đ |
| Slack | Incoming Webhook | 0đ |
| Email | Resend free | 0đ |
| LinkedIn | Apify — **bỏ qua** | 0đ |

---

## Vì sao Hugging Face Spaces

Nghe lạ cho một ứng dụng tuyển dụng, nhưng đây là lựa chọn đúng nhất:

1. **16 GB RAM miễn phí** — nơi duy nhất trong danh sách chứa nổi mô hình mà
   không phải sửa code.
2. **Không cần thẻ tín dụng.** Chỉ cần tài khoản GitHub hoặc email.
3. **Chạy thẳng `Dockerfile` đã có.**
4. **Mô hình tải nhanh.** `multilingual-e5-base` được tải *từ Hugging Face*, và
   Space đang chạy *bên trong hạ tầng Hugging Face*.
5. **HTTPS + tên miền sẵn**, hỗ trợ WebSocket.

**Nhược điểm phải biết:** Space free **tạm dừng sau 48 giờ không có ai truy
cập**. Lần đầu vào sau đó mất 1–2 phút để thức dậy.

> **Trước buổi bảo vệ: mở link Space trước 10 phút.** Đây là lỗi dễ mắc nhất —
> mở ra lúc đang thuyết trình thì thầy ngồi nhìn màn hình chờ.

---

## 1. Backend lên Hugging Face Spaces

### 1.1 Tạo Space

<https://huggingface.co/new-space>

- **Space name:** `smartats-backend`
- **License:** `mit`
- **SDK:** **Docker** → *Blank*
- **Hardware:** `CPU basic · 2 vCPU · 16 GB` (miễn phí)
- **Visibility:** Public *(Private cũng free, nhưng Public thì thầy mở link được ngay)*

### 1.2 Cấu hình cổng

Space chạy container ở cổng **7860**. Dockerfile đã đọc `$PORT` nên không cần
sửa gì — chỉ cần khai trong `README.md` của Space:

```yaml
---
title: SmartATS Backend
emoji: 📋
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
---
```

### 1.3 Đẩy code lên

Space là một git repo. Đẩy code hiện tại lên:

```bash
git remote add hf https://huggingface.co/spaces/<username>/smartats-backend
git push hf fix/integrate_code:main
```

Sẽ hỏi token — lấy ở <https://huggingface.co/settings/tokens> (quyền **write**).

### 1.4 Đặt secret

Space → **Settings** → **Variables and secrets**. Dùng **Secrets** (chữ đỏ) cho
mọi khoá, **Variables** cho phần còn lại:

**Secrets:**
```
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
JWT_SECRET, AZURE_STORAGE_CONNECTION_STRING,
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
GEMINI_API_KEY, GROQ_API_KEY, GITHUB_API_TOKEN,
SLACK_WEBHOOK_URL
```

**Variables:**
```
APP_ENV                 = production
APP_TIMEZONE            = Asia/Ho_Chi_Minh
PORT                    = 7860
CORS_ORIGINS            = https://<app>.vercel.app
GOOGLE_REDIRECT_URI     = https://<app>.vercel.app/schedule
RECRUITER_EMAIL_DOMAINS = gmail.com
ADMIN_EMAILS            = <email admin của bạn>
```

> **`JWT_SECRET` phải là giá trị MỚI**, đừng dùng lại giá trị trong `.env` trên
> máy: `openssl rand -hex 32`. Ai có nó thì ký được token cho mọi role.

> **`RECRUITER_EMAIL_DOMAINS` bắt buộc.** Bỏ trống thì đăng nhập Google **chỉ
> chạy cho email trong `ADMIN_EMAILS`** và từ chối mọi người khác — nhìn từ
> ngoài giống hệt "đăng nhập hỏng".

### 1.5 Đợi build và kiểm tra

Build lần đầu **10–20 phút** (cài `torch` + tải mô hình). Xem tiến độ ở tab
**Logs**.

```bash
curl https://<username>-smartats-backend.hf.space/health
# {"status":"ok","service":"SmartATS"}
```

---

## 2. Frontend lên Vercel

<https://vercel.com/new> → import repo GitHub.

| Cấu hình | Giá trị |
|---|---|
| Framework | Next.js |
| Root Directory | **để trống** (`package.json` ở gốc repo) |
| Build Command | mặc định |

**Environment Variables:**

```
NEXT_PUBLIC_API_BASE_URL      = https://<username>-smartats-backend.hf.space
NEXT_PUBLIC_SUPABASE_URL      = https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = <anon key>
```

**Ba điều dễ sai:**

1. **`NEXT_PUBLIC_*` nhúng lúc BUILD.** Đổi xong phải **Redeploy**. Thiếu
   `NEXT_PUBLIC_API_BASE_URL` thì frontend gọi `localhost:8000` — tức là gọi
   vào máy của chính thầy.
2. **Không đặt `SUPABASE_SERVICE_ROLE_KEY` ở đây.** Nó bỏ qua RLS và nằm trong
   gói JavaScript ai cũng tải được.
3. Có domain Vercel rồi thì **quay lại cập nhật `CORS_ORIGINS`** ở bước 1.4 —
   thiếu là trình duyệt chặn sạch mọi lời gọi.

---

## 3. Supabase Free — chấp nhận việc bị tạm dừng

Gói Free tạm dừng project sau **7 ngày không hoạt động**. Với demo thì chấp
nhận được, nhưng phải biết cách xử lý:

- **Bật lại:** vào <https://supabase.com/dashboard>, bấm **Restore project**.
  Mất 1–2 phút.
- **Trước buổi bảo vệ:** mở dashboard kiểm tra project còn "Active" không, và
  mở link Space cho nó thức dậy. **Làm trước 10 phút.**

Giữ project sống bằng cách vào dùng vài ngày một lần trong tuần trước khi bảo
vệ là đủ.

**Vẫn phải bật RLS**, kể cả demo: anon key nằm trong gói JavaScript công khai,
và dữ liệu ứng viên là dữ liệu thật. Xem [RLS_RUNBOOK.md](RLS_RUNBOOK.md).

---

## 4. Các dịch vụ còn lại

| Dịch vụ | Làm gì |
|---|---|
| **Azure Blob** | Giữ nguyên `AZURE_STORAGE_CONNECTION_STRING` đang có. Credit sinh viên thừa sức cho vài trăm CV. |
| **Gemini** | Free tier đủ cho demo. Nhiều người nộp cùng lúc có thể dính 429 — không sao với demo. |
| **Slack** | Webhook miễn phí. Xem [NOTIFICATIONS_SETUP.md](NOTIFICATIONS_SETUP.md). |
| **Email** | [Resend](https://resend.com) free 3.000 thư/tháng. Chưa có tên miền thì dùng `onboarding@resend.dev` làm `SMTP_FROM_EMAIL` — đủ để demo. |
| **Apify** | **Bỏ qua.** Không đặt `APIFY_API_TOKEN` thì phần làm giàu LinkedIn tắt, mọi thứ khác chạy bình thường (`NO_PROFILES_FOUND`). |
| **Service Bus** | **Bỏ qua.** Không có consumer nào đọc hàng đợi; enrichment chạy trong tiến trình. |

---

## 5. Kiểm tra sau khi deploy

```bash
BASE="https://<username>-smartats-backend.hf.space" \
  ./venv/bin/python src/backend/scripts/smoke_flows.py
```

35 phép kiểm trên hệ thống thật: nộp CV, xếp hạng ngữ nghĩa, che PII, hội đồng
chấm, phân quyền. Tự tạo ứng viên thử rồi dọn.

**Đây là cách duy nhất biết bản deploy thật sự hoạt động**, chứ không chỉ có
`/health` trả lời.

---

## Checklist trước buổi bảo vệ

Làm **trước 10 phút**, theo thứ tự:

- [ ] Mở Supabase dashboard — project còn Active? Nếu paused thì Restore.
- [ ] Mở link Hugging Face Space cho container thức dậy.
- [ ] `curl https://<space>.hf.space/health` → `{"status":"ok"}`
- [ ] Mở link Vercel, đăng nhập thử một lần.
- [ ] Đặt thử một lịch phỏng vấn → kiểm Slack có nhận tin không.
- [ ] Có ít nhất **3 tech lead** và đã mời vào hội đồng
      (`assign_review_panels.py --all`) — hội đồng 1 người thì ngưỡng 80%
      thành 1/1, không cho thấy được cơ chế.
- [ ] Có sẵn 5–10 ứng viên trong DB để bảng xếp hạng có gì mà xếp.

---

## Nếu Hugging Face Spaces không dùng được

Cách duy nhất để lọt vào gói free 512 MB là **bỏ mô hình nhúng chạy cục bộ**.
Chỗ để cắm đã có sẵn trong `modules/scoring/application/embedding_service.py`:

```python
def get_embedding_provider(settings: Settings) -> EmbeddingProvider:
    provider_name = getattr(settings, "embedding_provider", "local-e5")
    if provider_name == "local-e5":
        return LocalE5Provider()
    raise ValueError(...)
```

Viết thêm một provider gọi Gemini embedding API:

| | Hiện tại | Nếu đổi |
|---|---|---|
| RAM | ~1 GB | ~256 MB |
| Image | ~3 GB | ~200 MB |
| Khởi động | 7 giây | tức thì |
| Chạy được trên | HF Spaces | Render/Fly/Koyeb free |

Đổi lại phải chạy `POST /api/admin/vector/reindex` vì vector cũ thuộc không
gian của mô hình cũ.

**Đừng làm trước buổi bảo vệ** — nó chạm vào lõi Flow B đang chạy tốt, và
reindex trên dữ liệu thật là rủi ro không cần thiết lúc này.
