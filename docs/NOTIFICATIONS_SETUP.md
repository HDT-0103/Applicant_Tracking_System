# Bật thông báo Slack cho lịch phỏng vấn

SRS (Template1 §3.2.1b — *Automated Interview Confirmation Notification*) yêu
cầu hệ thống đẩy thông báo vào kênh Slack khi HR chốt lịch. **Code đã xong và
có test**; chỉ còn thiếu một biến môi trường.

## Hiện trạng

```
SLACK_WEBHOOK_URL=        <- rỗng trong .env
```

Khi rỗng, `SlackNotifier.notify` ghi log `scheduling.slack.no_webhook_url` ở
mức **warning**, trả về `False`, và cột `confirmed_slots.slack_notified` lưu
`false`. Lịch vẫn được đặt, sự kiện Google Calendar vẫn tạo, email vẫn gửi —
Slack là kênh phụ, không phải điều kiện để đặt lịch thành công.

Nói cách khác: **không bật cũng không sao, nhưng bật thì chứng minh được luồng
chạy end-to-end**, và đó là thứ hội đồng chấm sẽ hỏi.

## Cách bật (khoảng 3 phút)

1. Vào <https://api.slack.com/apps> → **Create New App** → *From scratch*
2. Đặt tên (ví dụ `SmartATS`), chọn workspace của nhóm
3. Menu trái → **Incoming Webhooks** → bật **Activate Incoming Webhooks**
4. **Add New Webhook to Workspace** → chọn kênh (ví dụ `#tuyen-dung`) → **Allow**
5. Copy URL dạng `https://hooks.slack.com/services/T…/B…/…`
6. Dán vào `.env` ở gốc repo:

```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000/B00000/XXXXXXXX
```

7. Khởi động lại backend.

## Kiểm chứng

Gửi thử một tin, không cần chạy cả hệ thống:

```bash
set -a && . ./.env && set +a && curl -s -X POST "$SLACK_WEBHOOK_URL" -H 'Content-Type: application/json' -d '{"text":"SmartATS webhook test"}'
```

Trả về `ok` và tin hiện trong kênh là xong.

Sau đó chạy luồng thật: HR vào `/schedule`, chọn ứng viên và hội đồng, chốt một
khe giờ. Kênh Slack phải nhận được tin dạng:

```
Interview scheduled: *Trần Bảo* with An, Bảo on *Sep 01 at 09:30 AM (+07)* (45 min)
```

Và kiểm trong DB:

```bash
set -a && . ./.env && set +a && curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/confirmed_slots?select=id,slack_notified&order=created_at.desc&limit=1" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

`slack_notified: true` nghĩa là webhook đã nhận.

## Lưu ý về múi giờ

Giờ trong tin Slack theo `APP_TIMEZONE` (mặc định `Asia/Ho_Chi_Minh`), **cùng
múi giờ với email**. Trước đây Slack dán cứng nhãn `GMT+7` và bỏ qua cấu hình,
nên đổi `APP_TIMEZONE` sẽ khiến hai thông báo về cùng một cuộc phỏng vấn ghi
hai giờ khác nhau. Nhãn giờ bây giờ lấy từ múi giờ thật (`%Z`), không dán cứng.

## Email — đã bật chưa?

Email dùng SMTP, cấu hình riêng:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=          <- Gmail cần App Password, không dùng mật khẩu thường
SMTP_FROM_EMAIL=
```

Kiểm nhanh xem đã đủ chưa:

```bash
set -a && . ./.env && set +a && python3 -c "import os;[print(f'{k}: {\"SET\" if os.getenv(k) else \"CHƯA ĐẶT\"}') for k in ['SMTP_HOST','SMTP_USERNAME','SMTP_PASSWORD','SMTP_FROM_EMAIL','SLACK_WEBHOOK_URL','AZURE_SERVICE_BUS_CONNECTION_STRING']]"
```
