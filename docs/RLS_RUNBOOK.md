# Bật Row Level Security trên Supabase — việc cần làm

Tài liệu này dành cho người có quyền vào Supabase Dashboard. Phần code đã xong;
phần còn lại **không làm được từ repo**.

---

## 1. Tại sao phải làm

Anon key của Supabase nằm trong bundle JavaScript công khai — đó là thiết kế
bình thường, vì RLS mới là thứ bảo vệ dữ liệu. **RLS đang tắt.** Kiểm chứng
bằng `curl` chỉ với anon key, không đăng nhập, 11 bảng đều trả về dữ liệu:

```
200 candidates   200 users      200 cv_reviews    200 applications
200 jobs_posting 200 resumes    200 abac_policies 200 confirmed_slots
200 linkedin_profiles  200 github_profiles  200 enrichment_profiles
```

Bảng `candidates` để lộ `race`, `gender_identity`, `disability_status`,
`military_status`, `age_group`, `phone`, `address`, `salary_expectation`,
`resume_text`. Bảng `users` để lộ `password_hash`.

## 2. Vì sao không bật được ngay (và code đã sửa gì)

Ứng dụng **không dùng Supabase Auth**. Backend ký JWT bằng `JWT_SECRET` riêng.
Đưa token đó cho Supabase:

```
HTTP 401  PGRST301 — "None of the keys was able to decode the JWT"
```

Nên với Postgres, mọi request từ trình duyệt đều là `anon`, kể cả khi người
dùng đã đăng nhập. Bật RLS + viết policy theo `auth.uid()` sẽ chặn **tất cả**.

Code đã xử lý: 24 truy vấn trực tiếp từ trình duyệt giảm còn 9, tất cả 9 đều ở
`/careers` — trang công khai, đúng ra phải chạy anon. Các màn hình đã đăng nhập
giờ đi qua backend (`/api/catalog/*`), nơi dùng **service-role key** (bỏ qua
RLS) và tự quyết quyền bằng `require_roles` + hội đồng + ABAC masking.

---

## 3. Các bước

### Bước 0 — Chạy migration V008 (BẮT BUỘC, làm trước)

Chưa chạy thì hội đồng Tech Lead không hoạt động và một số truy vấn lỗi
`column applications.review_panel_size does not exist`.

Supabase Dashboard → SQL Editor → dán toàn bộ nội dung
`src/backend/migrations/V008__review_panels.sql` → Run.

### Bước 1 — Làm trên STAGING trước

Đừng bật thẳng trên project đang chạy. Tạo project Supabase thứ hai, hoặc ít
nhất chọn giờ không ai dùng và chuẩn bị sẵn câu lệnh tắt lại
(`ALTER TABLE ... DISABLE ROW LEVEL SECURITY`).

### Bước 2 — Bật RLS, mặc định khoá hết

Bật RLS mà không có policy nào = **deny all** cho anon. Đó chính là điều ta
muốn cho hầu hết bảng, vì backend dùng service-role và không bị ảnh hưởng.

```sql
ALTER TABLE candidates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE cv_reviews           ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmed_slots      ENABLE ROW LEVEL SECURITY;
ALTER TABLE abac_policies        ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_posting_reviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_usage_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_rate_limits      ENABLE ROW LEVEL SECURITY;
```

Sau bước này, `curl` với anon key phải trả về `[]` cho mọi bảng trên.

### Bước 3 — Một bảng duy nhất mà `/careers` cần

Trang tuyển dụng công khai phải chạy được **không có tài khoản**. Nhưng nó chỉ
cần ĐỌC danh sách tin: việc nộp hồ sơ đã chuyển hết sang `POST /api/v1/ingest`,
nơi backend ghi `candidates` → `resumes` → `applications` bằng khoá
service-role trong cùng một lượt.

```sql
ALTER TABLE jobs_posting ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Ai cũng ĐỌC được tin đang tuyển. Chỉ tin PUBLISHED — bản nháp và tin đã
-- đóng không được lộ.
CREATE POLICY careers_read_published ON jobs_posting
  FOR SELECT TO anon
  USING (status = 'PUBLISHED');
```

**Không cần policy nào cho `candidates`, `resumes`, `applications`.** Bản trước
của tài liệu này đề xuất ba policy INSERT cho anon; giờ không cần nữa — và đó
là kết quả tốt hơn, vì một policy `WITH CHECK (true)` cho phép người lạ chèn
bao nhiêu dòng tuỳ thích vào bảng ứng viên.

> Nếu bạn đã tạo ba policy đó theo bản trước, hãy xoá đi:
> ```sql
> DROP POLICY IF EXISTS careers_submit_candidate   ON candidates;
> DROP POLICY IF EXISTS careers_submit_resume      ON resumes;
> DROP POLICY IF EXISTS careers_submit_application ON applications;
> ```

### Bước 4 — Kiểm chứng

```bash
# Nạp biến môi trường
set -a && . ./.env && set +a

# PHẢI trả về [] hoặc lỗi permission
for t in candidates users cv_reviews confirmed_slots abac_policies; do
  echo -n "$t: "
  curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/$t?select=*&limit=1" \
    -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
  echo
done

# PHẢI trả về tin PUBLISHED
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/jobs_posting?select=id,job_title&limit=1" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

Rồi thử tay:

| Việc | Kết quả mong đợi |
|---|---|
| Mở `/careers` khi chưa đăng nhập | Thấy danh sách tin |
| Nộp CV qua `/careers/<tin>` | Thành công, và bảng `applications` chỉ tăng **1** dòng |
| Quay lại `/careers/<tin>` trên cùng trình duyệt | Form điền sẵn câu trả lời cũ |
| Đăng nhập HR → Dashboard | Thấy ứng viên (qua `/api/catalog/dashboard`) |
| Đăng nhập Tech Lead → Dashboard | Chỉ thấy ứng viên thuộc hội đồng mình, tên bị che `***` |
| Sidebar, Analytics, Schedule, tạo tin | Chạy bình thường |

### Bước 5 — Việc chưa làm được và cần kiểm bằng tay

Mình **không kiểm được anon có GHI được không** — lệnh probe bị chặn trong
phiên làm việc. Bạn tự kiểm giúp, vì nếu ghi được thì đây không chỉ là lộ dữ
liệu mà là **chiếm quyền**:

- Anon `UPDATE` được `abac_policies` → tự mở khoá PII cho tech_lead
- Anon `UPDATE` được `users.role` → tự nâng mình lên admin

Sau Bước 2 thì cả hai đều bị chặn. Nhưng nên kiểm **trước** để biết hệ thống
đã bị phơi tới mức nào, và có cần đổi khoá / rà audit log hay không.

---

## 4. Sau khi bật

- **Đổi `SUPABASE_SERVICE_ROLE_KEY`.** Nó bỏ qua RLS hoàn toàn. Nếu key này
  từng lọt vào log, ảnh chụp màn hình hay commit thì mọi thứ ở trên vô nghĩa.
- **Đừng bao giờ đưa service-role key vào `NEXT_PUBLIC_*`.** Biến có tiền tố đó
  được nhúng thẳng vào bundle JavaScript.
- **Quy tắc cho code mới:** màn hình đã đăng nhập thì đọc qua `/api/catalog/*`.
  Thêm một truy vấn `supabase.from(...)` mới vào trang đã đăng nhập là mở lại
  đúng cái lỗ vừa vá — và sau Bước 2 nó sẽ trả về rỗng, nên lỗi lộ ra ngay.
