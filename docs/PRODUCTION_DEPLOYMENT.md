# Đưa SmartATS vào dùng thật

Tài liệu này dành cho việc chạy hệ thống cho người dùng thật, không phải demo.
Khác biệt chính so với demo: dữ liệu ứng viên là dữ liệu cá nhân có thật, mất
là không lấy lại được, và lộ là có hậu quả pháp lý.

Cần chuẩn bị: một tên miền, thẻ thanh toán, và khoảng nửa ngày.

> **Đọc trước:** [DEPLOY_AZURE.md](DEPLOY_AZURE.md) có lệnh dựng backend chi
> tiết. Tài liệu này bao quát toàn hệ thống và giải thích *vì sao* chọn từng
> nền tảng.

---

## Toàn cảnh

```
      Trình duyệt
           │
   ┌───────┴────────┐
   │                │
Vercel          Azure Container Apps
(Next.js)  ───▶  (FastAPI + mô hình nhúng)
                     │
      ┌──────────────┼──────────────┬─────────────┐
      ▼              ▼              ▼             ▼
  Supabase      Azure Blob      Google      Gemini / Groq
  (Postgres     (file CV)       Calendar    (bóc tách CV)
   + pgvector)                  + OAuth
                                              │
                        ┌─────────────────────┴──┐
                        ▼                        ▼
                    Apify                   GitHub API
                (LinkedIn)              (kho mã nguồn)
                        │
                   Slack + SMTP
                   (thông báo)
```

Mười dịch vụ ngoài. Bảng tóm tắt trước, lý giải sau.

| Thành phần | Nền tảng | Gói tối thiểu | ~USD/tháng |
|---|---|---|---|
| Frontend | Vercel | Hobby (cá nhân) / Pro | 0 – 20 |
| Backend | Azure Container Apps | 2 vCPU / 4 GiB, min 1 replica | 40 – 60 |
| Cơ sở dữ liệu | Supabase | **Pro** (bắt buộc, xem bên dưới) | 25 |
| File CV | Azure Blob Storage | Standard LRS | 1 – 5 |
| Bóc tách CV | Google Gemini API | trả theo lượt | 5 – 20 |
| Làm giàu LinkedIn | Apify | Starter | 0 – 49 |
| Email | **Resend / SendGrid** (KHÔNG dùng Gmail) | Free → Pro | 0 – 20 |
| Slack | Incoming Webhook | miễn phí | 0 |
| Google Calendar | OAuth (Workspace hoặc Cloud) | miễn phí | 0 |
| Tên miền + TLS | bất kỳ nhà cung cấp nào | | 1 – 2 |

**Tổng: khoảng 75 – 200 USD/tháng.**

---

## 1. Frontend — Vercel

**Vì sao.** Next.js do chính Vercel làm ra; App Router, streaming SSR và
`next/image` chạy đúng như tài liệu mà không phải cấu hình gì. Preview
deployment cho mỗi PR là thứ có giá trị thật khi nhiều người cùng sửa giao
diện. Frontend này không có state phía máy chủ nên không cần gì hơn.

**Vì sao không Netlify/Cloudflare Pages.** Chạy được, nhưng adapter Next.js của
họ luôn chậm hơn một nhịp so với bản Next mới. Không có lý do gì để nhận thêm
rủi ro đó.

### Biến môi trường

```
NEXT_PUBLIC_API_BASE_URL   = https://api.<tên-miền-của-bạn>
NEXT_PUBLIC_SUPABASE_URL   = https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = <anon key>
```

**Hai điều dễ sai và hậu quả nặng:**

1. **`NEXT_PUBLIC_*` được nhúng lúc BUILD, không phải lúc chạy.** Đổi giá trị
   xong phải build lại. Thiếu `NEXT_PUBLIC_API_BASE_URL` thì frontend gọi
   `http://localhost:8000` — tức là gọi vào máy của chính người dùng, và lỗi
   này chỉ lộ ra khi có người thật mở trang.

2. **Tuyệt đối không đặt `SUPABASE_SERVICE_ROLE_KEY` ở đây.** Nó bỏ qua toàn bộ
   RLS, và mọi biến `NEXT_PUBLIC_*` nằm trong gói JavaScript ai cũng tải được.
   Đặt nhầm một lần là phải xoay khoá và coi như toàn bộ dữ liệu đã bị lộ.

---

## 2. Backend — Azure Container Apps

**Vì sao không serverless.** Ba thứ trong mã nguồn loại bỏ Vercel Functions và
AWS Lambda:

| Ràng buộc | Đo được | Hệ quả |
|---|---|---|
| Mô hình nhúng cache trong tiến trình | **~1 GB RAM**, nạp mất **7 giây** | Cần tiến trình thường trú |
| WebSocket `/api/enrichment/ws/...` | — | Cần giữ kết nối |
| `BackgroundTasks` chạy enrichment sau khi trả lời | — | Tiến trình phải sống tiếp |

Thêm nữa: `torch` 561 MB, tổng thư viện 1.6 GB — vượt xa giới hạn gói 250 MB
của Lambda.

**Vì sao Azure.** File CV đã nằm trên Azure Blob và code sinh SAS URL từ đó.
Đặt backend cùng cloud thì lưu lượng blob không đi ra internet, độ trễ thấp
hơn, và chỉ có một hoá đơn. `AZURE_SERVICE_BUS_*` cũng đã khai sẵn trong config.

**Lựa chọn thay thế hợp lý:** Render (Standard 2 GB) hoặc Fly.io — cả hai đơn
giản hơn Azure đáng kể. Đổi lại lưu lượng tới Azure Blob đi qua internet công
cộng. Chấp nhận được, nhưng nếu không có lý do cụ thể thì cùng cloud vẫn hơn.

**Google Cloud Run** thì cân nhắc kỹ: hỗ trợ 4 GB và WebSocket, nhưng
scale-to-zero là mặc định — đặt `min-instances=1` để tránh nạp nguội thì mất
luôn lợi thế chi phí, mà vẫn phải trả tiền egress sang Azure.

### Ba tham số đừng đổi nếu chưa hiểu hệ quả

```bash
--min-replicas 1     # scale-to-zero = nạp lại mô hình 7s + đứt WebSocket đang mở
--memory 4Gi         # mô hình ăn 1 GB trước khi phục vụ request nào
--max-replicas 3     # mỗi replica giữ MỘT bản mô hình riêng
```

`--max-replicas` có một hệ quả ít ai để ý: bộ giới hạn tần suất
(`modules/shared/infrastructure/rate_limit.py`) đếm **theo từng tiến trình**.
Ba replica nghĩa là hạn mức thật **gấp ba** con số cấu hình — đăng nhập 10
lần/5 phút thành 30. Cần chính xác thì phải chuyển bộ đếm sang Redis.

Lệnh cụ thể: [DEPLOY_AZURE.md](DEPLOY_AZURE.md).

---

## 3. Cơ sở dữ liệu — Supabase **Pro**, không phải Free

Đây là chỗ duy nhất trong tài liệu này mà gói miễn phí **không được phép** dùng.

| | Free | Pro (25 USD) |
|---|---|---|
| Sao lưu | **không có** | tự động hằng ngày, giữ 7 ngày |
| Khôi phục theo thời điểm | không | có (thêm phí) |
| Tạm dừng khi không hoạt động | **sau 7 ngày** | không bao giờ |

Hai dòng đầu là lý do. Đây là dữ liệu cá nhân của ứng viên: CV, số điện thoại,
địa chỉ, mức lương mong muốn, và cả trường EEO (`race`, `gender_identity`,
`disability_status`). Một lệnh `DELETE` gõ nhầm trên gói Free là mất vĩnh viễn.

Dòng thứ ba là bẫy vận hành: dự án ít truy cập trong một tuần — hoàn toàn bình
thường với hệ thống tuyển dụng — là Supabase tạm dừng, và **toàn bộ hệ thống
chết** cho tới khi có người vào bật lại thủ công.

### Bắt buộc trước khi có người dùng thật

**1. Bật RLS trên mọi bảng.** Xem [RLS_RUNBOOK.md](RLS_RUNBOOK.md). Anon key
nằm trong gói JavaScript công khai; RLS là thứ duy nhất chặn người lạ đọc cả
bảng `candidates`.

**2. Xoay `SUPABASE_SERVICE_ROLE_KEY`** sau khi bật RLS, và chỉ đặt nó ở
backend.

**3. Kiểm anon có GHI được không** — quan trọng hơn cả quyền đọc:

```bash
# Phải trả về lỗi permission, KHÔNG phải 200/204
curl -X PATCH "$SUPABASE_URL/rest/v1/users?id=eq.00000000-0000-0000-0000-000000000000" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d '{"role":"admin"}'
```

Anon ghi được `users.role` nghĩa là bất kỳ ai cũng tự nâng mình lên admin.

---

## 4. File CV — Azure Blob Storage

**Vì sao giữ nguyên.** Code đã sinh SAS URL có hạn 15 phút
(`_build_sas_url` trong `azure_routes.py`). Đổi sang S3 hay Supabase Storage
phải viết lại phần ký URL mà không được lợi gì.

**Cấu hình cho production:**

- Container để **private** (mặc định) — chỉ vào được qua SAS URL
- Bật **soft delete** giữ 30 ngày: CV bị xoá nhầm còn khôi phục được
- Bật **versioning** nếu ngân sách cho phép
- Vòng đời: chuyển sang tầng Cool sau 90 ngày để giảm chi phí

CV là PDF vài trăm KB. Một nghìn ứng viên tốn chưa tới 1 USD/tháng — chi phí ở
đây không đáng lo, mất dữ liệu mới đáng.

---

## 5. Bóc tách CV — Google Gemini

**Vì sao Gemini.** Đã tích hợp sẵn (`gemini_parser_service.py`), và có gói miễn
phí rộng rãi. Đọc CV là bài toán dễ với mọi LLM hiện đại — không cần mô hình
đắt tiền.

**Cấu hình:** dùng khoá trả phí, không dùng khoá free tier. Free tier giới hạn
theo phút và sẽ trả lỗi 429 đúng lúc nhiều ứng viên nộp cùng lúc — mà đó chính
là lúc hệ thống cần chạy.

`GROQ_API_KEY` cũng đã có trong config, dùng cho luồng agent. Giữ cả hai.

---

## 6. Làm giàu LinkedIn — Apify

**Vì sao phải trả tiền và không có cách nào khác.** LinkedIn không có API công
khai cho dữ liệu hồ sơ. Apify (hoặc Proxycurl) là dịch vụ trung gian, và không
tự cào được — LinkedIn chặn theo IP rất nhanh.

**Cần biết trước:**

- Cào LinkedIn nằm ở vùng xám pháp lý và **vi phạm điều khoản dịch vụ của
  LinkedIn**. Với sản phẩm thương mại, nên hỏi ý kiến pháp lý.
- Đây là phần tốn kém nhất tính theo mỗi ứng viên.
- Hỏng thì hệ thống vẫn chạy: `enrichment_service` đánh dấu
  `NO_PROFILES_FOUND` và giữ nguyên phân tích từ CV.

**Có thể bỏ.** Không đặt `APIFY_API_TOKEN` thì phần làm giàu LinkedIn tắt, mọi
thứ khác vẫn hoạt động. Nếu ngân sách eo hẹp hoặc lo ngại pháp lý, đây là thứ
đầu tiên nên cắt.

---

## 7. Email — **đừng dùng Gmail**

Hiện `.env.example` gợi ý `smtp.gmail.com`. Chạy demo thì được, dùng thật thì
không, vì ba lý do:

1. **Giới hạn 500 thư/ngày** cho tài khoản cá nhân. Một đợt tuyển dụng lớn là
   chạm trần.
2. **Thư vào spam.** Gmail cá nhân gửi thư giao dịch không có SPF/DKIM cho tên
   miền của bạn — ứng viên sẽ không thấy thư mời phỏng vấn.
3. **Không có nhật ký gửi.** Ứng viên nói "tôi không nhận được gì" thì không có
   cách nào kiểm chứng.

**Dùng Resend** (miễn phí 3.000 thư/tháng, cấu hình đơn giản nhất) hoặc
**SendGrid**. Cả hai đều cho SMTP, nên **không phải sửa code** — chỉ đổi biến
môi trường:

```
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USERNAME=resend
SMTP_PASSWORD=<api key>
SMTP_FROM_EMAIL=tuyendung@<tên-miền-của-bạn>
```

**Bắt buộc: xác minh tên miền** (bản ghi SPF + DKIM). Bỏ qua bước này thì thư
vào spam, và đó là lỗi im lặng — hệ thống báo "đã gửi", ứng viên không bao giờ
thấy.

Chưa cấu hình SMTP thì `send_room_details` trả về `false` và API đáp 503 kèm lý
do — cố ý như vậy, để không báo "đã gửi" cho việc chưa xảy ra.

---

## 8. Slack — Incoming Webhook

Miễn phí, không cần bàn. Đặt `SLACK_WEBHOOK_URL`. Không đặt thì chốt lịch vẫn
chạy, cột `confirmed_slots.slack_notified` ghi `false`. Xem
[NOTIFICATIONS_SETUP.md](NOTIFICATIONS_SETUP.md).

---

## 9. Google Calendar OAuth

Không tốn tiền, nhưng có ba việc bắt buộc trước khi người ngoài dùng được:

1. **Redirect URI** trong Google Cloud Console phải khớp chính xác
   `GOOGLE_REDIRECT_URI`. Sai một dấu gạch chéo là hỏng.
2. **Xác minh ứng dụng.** Chưa xác minh thì Google chặn ở 100 người dùng và
   hiện màn hình cảnh báo "ứng dụng chưa được xác minh". Quá trình xác minh mất
   vài tuần — **bắt đầu sớm**.
3. **Phạm vi quyền:** chỉ xin `calendar.freebusy` và `calendar.events`. Xin rộng
   hơn thì quá trình xác minh lâu hơn và người dùng dễ từ chối.

---

## 10. Azure Service Bus — **chưa cần**

`AZURE_SERVICE_BUS_CONNECTION_STRING` có trong config, nhưng **không có
consumer nào trong repo đọc hàng đợi `cv-received-queue`**. Enrichment chạy qua
`BackgroundTasks` ngay trong tiến trình backend.

Không đặt biến này thì `publish_cv_received_event` ghi log cảnh báo rồi đi
tiếp. Bỏ tiền cho một hàng đợi không ai đọc là lãng phí.

**Khi nào thì cần:** khi enrichment bắt đầu chiếm quá nhiều thời gian của tiến
trình web, hoặc khi cần thử lại các lượt làm giàu thất bại. Lúc đó tách worker
riêng đọc hàng đợi. Chưa tới lúc đó thì đừng.

---

## Kiểm tra bắt buộc trước khi mở cho người thật

### Bảo mật

```bash
# 1. Anon key KHÔNG đọc được dữ liệu ứng viên
curl -s "$SUPABASE_URL/rest/v1/candidates?select=*&limit=1" -H "apikey: $ANON_KEY"
# Phải trả []  — nếu ra dữ liệu là RLS chưa bật

# 2. Anon key KHÔNG ghi được (quan trọng hơn quyền đọc)
curl -X PATCH "$SUPABASE_URL/rest/v1/users?id=eq.00000000-0000-0000-0000-000000000000" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d '{"role":"admin"}'
# Phải là lỗi permission

# 3. Service role key KHÔNG có trong gói JavaScript
curl -s https://<tên-miền>/_next/static/chunks/*.js | grep -c "$SERVICE_ROLE_KEY"
# Phải là 0
```

### Chức năng

```bash
BASE="https://api.<tên-miền>" ./venv/bin/python src/backend/scripts/smoke_flows.py
```

35 phép kiểm trên hệ thống thật: nộp CV, xếp hạng ngữ nghĩa, che PII, hội đồng
chấm, phân quyền. Nó tự tạo một ứng viên thử rồi dọn.

### Cấu hình dễ quên

| Biến | Nếu sai |
|---|---|
| `CORS_ORIGINS` | Trình duyệt chặn sạch mọi lời gọi từ Vercel |
| `JWT_SECRET` | Dùng lại giá trị dev = ai có nó cũng ký được token admin |
| `RECRUITER_EMAIL_DOMAINS` | **Chưa đặt thì đăng nhập Google CHỈ chạy cho email trong `ADMIN_EMAILS`** — mọi người khác bị từ chối |
| `APP_ENV=production` | Để `development` thì CORS nới lỏng cho mọi IP nội mạng |
| `GOOGLE_REDIRECT_URI` | Kết nối Google Calendar hỏng |

### Vận hành

- **Sao lưu:** Supabase Pro tự động hằng ngày. Thử khôi phục **một lần** trước
  khi có dữ liệu thật — bản sao lưu chưa từng khôi phục thử thì chưa phải là
  bản sao lưu.
- **Nhật ký:** `az containerapp logs show --follow`. Bật Application Insights
  nếu cần giữ lâu.
- **Cảnh báo:** ít nhất một cảnh báo khi `/health` không trả lời.

---

## Vấn đề đã biết, chưa xử lý

Nói thẳng, để người vận hành không phát hiện muộn:

| Vấn đề | Ảnh hưởng | Cách xử lý |
|---|---|---|
| Đăng ký công khai tự cấp quyền `hr` | Ai đăng ký cũng thấy PII ứng viên | Đổi `PUBLIC_SIGNUP_ROLE` sang `tech_lead` và bỏ tự động duyệt |
| Bộ giới hạn tần suất đếm theo tiến trình | N replica = hạn mức gấp N lần | Chuyển sang Redis khi cần nhiều replica |
| `torch` còn 22 lỗ hổng chưa vá | Chạy trên dữ liệu người ngoài tải lên | Nâng torch trên Linux (không bị chặn như macOS Intel), rồi chạy `POST /api/admin/vector/reindex` |
| Mô hình nhúng làm image nặng ~3 GB | Deploy chậm, RAM 4 GiB | Viết `EmbeddingProvider` gọi API — chỗ cắm đã có sẵn |
| Chưa có xoay khoá tự động | Khoá lộ phải xử lý tay | Azure Key Vault |

---

## Lộ trình đề xuất

**Tuần 1 — hạ tầng.** Supabase Pro + bật RLS + kiểm quyền ghi của anon. Azure
Container Apps + Blob. Vercel. Tên miền + TLS. Chạy smoke test.

**Tuần 2 — dịch vụ.** Xác minh tên miền email (Resend). Slack. Nộp hồ sơ xác
minh Google OAuth (mất vài tuần, nộp sớm). Gemini khoá trả phí.

**Tuần 3 — vận hành.** Thử khôi phục sao lưu. Cảnh báo. Sửa phần đăng ký tự
cấp quyền. Chạy thử với 5–10 người dùng thật trước khi mở rộng.

Đừng gộp ba tuần này lại. Mỗi bước đều có thứ chỉ lộ ra khi đã chạy thật, và
sửa lúc chưa có dữ liệu người dùng thì rẻ hơn nhiều.
