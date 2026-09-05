# Triển khai SmartATS

Tài liệu dành cho thành viên trong nhóm, viết theo thứ tự **việc hay làm nhất
đứng trước**. Sửa code xong và muốn đưa bản mới lên production thì đọc phần 1
là đủ.

| Thành phần | Nơi chạy | Địa chỉ |
|---|---|---|
| Frontend (Next.js) | Vercel Hobby | `smartats.tech` · `applicant-tracking-system-alpha.vercel.app` |
| Backend (FastAPI + mô hình nhúng) | Azure Container Apps, vùng **Korea Central** | `https://smartats-backend.purpleforest-518acad7.koreacentral.azurecontainerapps.io` |
| Cơ sở dữ liệu | Supabase Free | — |
| File CV | Azure Blob Storage | — |

Chi phí tiền túi: 0đ. Backend chạy bằng credit Azure for Students.

---

## 1. Deploy một bản mới

### 1.0 Trước khi deploy

```bash
./venv/bin/python -m pytest -q     # backend
npm test                           # frontend
npm run build                      # đúng thứ Vercel sẽ chạy
```

CI cũng chạy đúng ba lệnh này. Đỏ ở máy thì đỏ ở đó, đừng deploy tiếp.

### 1.1 Frontend: không phải làm gì

Vercel tự build lại mỗi khi có commit mới trên nhánh production (mặc định
`main`). Merge PR xong là xong.

**Trừ một trường hợp:** nếu bạn đổi biến `NEXT_PUBLIC_*` thì phải vào Vercel →
**Deployments → ⋯ → Redeploy**. Những biến đó được nhúng vào bundle **lúc
build**, không phải lúc chạy — restart không có tác dụng.

### 1.2 Backend: build image rồi đổi image của Container App

Backend **không** tự deploy (trừ khi nhóm đã bật GitHub Actions, xem 4.3). Cần
Docker Desktop đang chạy và `az` đã đăng nhập.

```bash
# Điền theo hạ tầng của nhóm — hỏi người dựng nếu chưa biết
export RG=smartats-rg
export APP_NAME=smartats-backend
export ACR_NAME=<tên-registry>

az login
az acr login --name $ACR_NAME
```

```bash
# LUÔN dùng tag mới. Vì sao: xem ô cảnh báo bên dưới.
export TAG=v3

docker build -t $ACR_NAME.azurecr.io/smartats-backend:$TAG .
docker push  $ACR_NAME.azurecr.io/smartats-backend:$TAG

az containerapp update --name $APP_NAME --resource-group $RG \
  --image $ACR_NAME.azurecr.io/smartats-backend:$TAG
```

> **Đừng đẩy đè lên một tag đã dùng.** Đẩy đè rồi `update` với đúng tag cũ thì
> Azure thấy image "không đổi" và **không tạo revision mới**: code mới nằm im
> trong registry, container vẫn chạy bản cũ, và không có lỗi nào báo.

Vài điều đã biết trước, để không phải tự phát hiện lại:

- **Lần build đầu trên một máy mới mất 20–30 phút** (torch 561 MB + mô hình
  nhúng 1,1 GB nạp sẵn vào image). Những lần sau chỉ vài phút: các layer nặng
  không đổi nên Docker và ACR dùng lại, chỉ layer `COPY . .` là mới — trừ khi
  bạn sửa `requirements.txt`, lúc đó layer `pip install` phải làm lại.
- **Máy Apple Silicon phải thêm `--platform linux/amd64`.** Không có nó thì
  image build ra là arm64 và container chết ngay với `exec format error`.
- **`az acr build` (build trên hạ tầng Azure) là dịch vụ tính phí.** Nhóm build
  ở máy vì lý do đó. Nếu subscription của bạn cho phép thì
  `az acr build --registry $ACR_NAME --image smartats-backend:$TAG .` thay được
  cả `docker build` lẫn `docker push`.

### 1.3 Nếu bạn thêm hoặc đổi biến môi trường

Đừng gõ tay 13 khoá vào cổng Azure. Sửa `.env` ở máy rồi chạy:

```bash
./venv/bin/python src/backend/scripts/push_env_to_azure.py \
    --app $APP_NAME --resource-group $RG \
    --frontend-url "https://smartats.tech,https://www.smartats.tech,https://applicant-tracking-system-alpha.vercel.app"
```

Script đọc `.env` bằng dotenv, đẩy khoá lên dạng **secret** (đặt thẳng thì giá
trị hiện trong `az containerapp show` và trong cổng Azure), rồi trỏ biến môi
trường vào các secret đó. Nó in tên biến kèm trạng thái, **không in giá trị**.
Thêm `--dry-run` để xem trước.

Ba điều script lo giúp, đừng tự làm tay:

- **`JWT_SECRET` được giữ nguyên** giữa các lần chạy. Sinh lại là đá văng mọi
  phiên đăng nhập đang mở.
- **`CORS_ORIGINS` nhận nhiều domain**, ngăn bằng dấu phẩy. Thiếu domain nào
  thì mở app từ domain đó ra trang trắng kèm lỗi CORS trong console.
- **`GOOGLE_REDIRECT_URI` lấy domain đầu tiên** — nó chỉ nhận đúng MỘT giá trị,
  nên `smartats.tech` phải đứng đầu danh sách.

Thêm biến mới thì nhớ khai vào cả `.env.example`, nếu không
`tests/test_env_contract.py` sẽ đỏ — cố ý như vậy.

### 1.3b Migration chưa chạy thì đừng deploy

Migration nằm ở `src/backend/migrations/V00x__*.sql`, chạy tay trong Supabase →
**SQL Editor**. Code đọc/ghi cột mới ngay khi lên, nên thứ tự là **migration
trước, deploy sau**. Gần nhất:

- `V009__user_company.sql` — đăng ký ghi `users.company_name`; thiếu cột là
  đăng ký trả 500.
- `V010__reindex_embeddings.sql` — RPC cho nút "Vector re-index" ở admin.
  Chưa chạy thì nút trả 503 kèm lý do (không làm hỏng gì khác).

Sau khi deploy bản có pipeline CV, chạy một lần để tin cũ có vector (tin
tạo/sửa/đăng từ giờ tự nhúng ở nền; hồ sơ nộp vào tin chưa có vector cũng tự
lấp, nhưng backfill trước thì CV đầu tiên không phải chờ):

```bash
./venv/bin/python src/backend/scripts/backfill_job_embeddings.py
```

### 1.4 Kiểm chứng — đừng tin màu xanh

```bash
FQDN=$(az containerapp show --name $APP_NAME --resource-group $RG \
       --query properties.configuration.ingress.fqdn -o tsv)
curl -s "https://$FQDN/health"
```

`/health` trả lời **không** có nghĩa là bản deploy chạy được: nó không chạm tới
cơ sở dữ liệu, không chạm tới Supabase, không chạm tới mô hình nhúng. Chạy
smoke test:

```bash
JWT=$(az containerapp secret show --name $APP_NAME --resource-group $RG \
      --secret-name jwt-secret --query value -o tsv)

BASE="https://$FQDN" ./venv/bin/python src/backend/scripts/smoke_flows.py --jwt-secret "$JWT"
```

35 phép kiểm HTTP qua 4 luồng SRS, **khẳng định kết quả chứ không chỉ mã trạng
thái**: xếp hạng phải giảm dần, lọc cứng phải thu hẹp tập kết quả, `tech_lead`
phải KHÔNG đọc được tên ứng viên. Script tự tạo một ứng viên `[SMOKE]` rồi tự
dọn (`--keep` nếu muốn giữ lại mà xem).

**`--jwt-secret` là bắt buộc khi `BASE` trỏ ra production.** Script tự ký token
cho ba role; production dùng khoá riêng, không phải khoá trong `.env` dev.
Thiếu cờ này thì 16/24 phép kiểm trả 401 và bảng kết quả trông y hệt như hệ
thống hỏng. Lệnh `secret show` in khoá ra màn hình — dọn lịch sử shell sau khi
dùng xong.

Cuối cùng mở `https://smartats.tech` bấm thử: đăng nhập, tạo tin tuyển dụng,
nộp CV ở `/careers`.

### 1.5 Quay lui

Revision cũ vẫn còn nguyên, quay về chỉ là đổi lại image:

```bash
az containerapp revision list --name $APP_NAME --resource-group $RG -o table
az containerapp update --name $APP_NAME --resource-group $RG \
  --image $ACR_NAME.azurecr.io/smartats-backend:<tag-cũ>
```

Frontend thì Vercel → **Deployments** → chọn bản chạy tốt → **Promote to
Production**.

---

## 2. Khi hỏng

```bash
az containerapp logs show --name $APP_NAME --resource-group $RG --follow
az containerapp revision list --name $APP_NAME --resource-group $RG -o table
```

| Triệu chứng | Nguyên nhân hay gặp |
|---|---|
| Đổi code rồi mà production vẫn như cũ | Đẩy đè lên tag cũ → không có revision mới. Build lại với tag khác (1.2) |
| `/health` không trả lời, log có `ValidationError` | Thiếu 1 trong 4 biến bắt buộc — chạy lại 1.3 |
| `/health` xanh nhưng nộp CV không ra `application_id`, tìm kiếm trả `503 ... database is not configured` | Thiếu **`SUPABASE_SERVICE_KEY`** — biến này KHÁC `SUPABASE_SERVICE_ROLE_KEY`, xem 5.1 |
| Smoke test: hàng loạt `mong đợi 200, nhận 401` | Quên `--jwt-secret` (1.4) |
| Container OOM, restart liên tục | `--memory` dưới 4Gi — mô hình nhúng chiếm ~1 GB khi chưa phục vụ gì |
| Trình duyệt báo lỗi CORS | Domain chưa có trong `CORS_ORIGINS`, hoặc ghi kèm dấu `/` ở cuối |
| Frontend gọi vào `localhost:8000` | Thiếu `NEXT_PUBLIC_API_BASE_URL` **lúc build** → Redeploy trên Vercel |
| Giao diện mất sạch layout | Vercel Root Directory không phải `src/frontend` → Tailwind không được nạp |
| `redirect_uri_mismatch` khi bấm đăng nhập Google | Domain chưa khai trong Google Cloud Console (4.2) |
| `exec format error` trong log | Image build trên máy Apple Silicon mà thiếu `--platform linux/amd64` |
| Trang trắng, console báo lỗi Supabase | Project Supabase bị tạm dừng (gói Free ngủ sau 7 ngày) → dashboard bấm **Restore** |
| Hồ sơ kẹt ở `waiting_for_tls`, tech lead mở nhận 404 | Tin tuyển dụng chưa có hội đồng chấm → `scripts/assign_review_panels.py --all` |
| HR đăng nhập thấy dashboard và danh sách tin **rỗng**, admin vẫn thấy | Tin có `jobs_posting.created_by = NULL` (tạo trước khi tách dữ liệu theo người dùng). Gán chủ: `UPDATE jobs_posting SET created_by = (SELECT id FROM users WHERE email = '<email HR>') WHERE created_by IS NULL;` |
| Smoke test: hàng loạt phép kiểm theo phạm vi thấy rỗng / 404 | Không có tin PUBLISHED nào có `created_by` → script không đóng vai chủ tin được. Gán chủ như dòng trên |

---

## 3. Dựng hạ tầng lần đầu

> **Vùng:** Supabase của nhóm ở Seoul, nên backend đặt ở `koreacentral`. Đặt ở
> Singapore thì mỗi truy vấn PostgREST mất ~160 ms (đã đo), mọi màn hình chậm
> theo số truy vấn. Azure for Students chỉ cho **một** Container App
> Environment mỗi subscription — muốn đổi vùng là phải xoá cái cũ rồi tạo cái
> mới (backend ngừng ~10–20 phút); sao lưu secret trước bằng
> `az containerapp secret show` từng cái, vì `JWT_SECRET` phải giữ nguyên.

Chỉ đọc phần này nếu phải dựng lại từ số không — ví dụ credit Azure hết hạn và
nhóm chuyển sang subscription khác.

### 3.1 Tạo tài nguyên

```bash
export RG=smartats-rg
export LOCATION=koreacentral   # cùng vùng với Supabase (Seoul): mỗi truy vấn ~15 ms thay vì ~160 ms từ Singapore
export ENV_NAME=smartats-env-kr
export APP_NAME=smartats-backend
export ACR_NAME=smartatsacr$RANDOM && echo "ACR_NAME=$ACR_NAME"   # GHI LẠI dòng này
```

```bash
az group create --name $RG --location $LOCATION

az extension add --name containerapp --upgrade
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.OperationalInsights --wait

az acr create --resource-group $RG --name $ACR_NAME --sku Basic --admin-enabled true
az containerapp env create --name $ENV_NAME --resource-group $RG --location $LOCATION
```

Hai dòng `az provider register` hay bị bỏ qua. Trên subscription mới tinh,
`containerapp env create` chết với `MissingSubscriptionRegistration` mà không
nói rõ phải đăng ký cái gì.

### 3.2 Tạo Container App

Build và đẩy image theo 1.2 trước, rồi:

```bash
ACR_PASS=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv)

az containerapp create \
  --name $APP_NAME --resource-group $RG --environment $ENV_NAME \
  --image $ACR_NAME.azurecr.io/smartats-backend:v1 \
  --registry-server $ACR_NAME.azurecr.io \
  --registry-username $ACR_NAME --registry-password "$ACR_PASS" \
  --target-port 8000 --ingress external \
  --cpu 2 --memory 4Gi --min-replicas 1 --max-replicas 1
```

Ba tham số đừng đổi nếu chưa hiểu hệ quả:

- **`--min-replicas 1`** — không để 0. Mỗi lần thức dậy phải nạp lại mô hình
  1 GB: request đầu tiên treo hàng chục giây và WebSocket đang mở thì đứt.
- **`--memory 4Gi`** — mô hình chiếm ~1 GB ngay khi nạp, chưa phục vụ gì.
- **`--max-replicas 1`** — mỗi replica giữ một bản mô hình riêng, nhân replica
  là nhân RAM lẫn tiền. Bộ giới hạn tần suất cũng đếm theo TỪNG tiến trình
  (`modules/shared/infrastructure/rate_limit.py`), nên nhiều replica nghĩa là
  hạn mức thật bị nhân lên.

**Revision đầu tiên sẽ chết** — chưa có biến môi trường nào. Chạy 1.3 rồi đợi
1–2 phút.

### 3.3 Frontend trên Vercel

<https://vercel.com/new> → Import repo. Sửa đúng **một** thứ:

| Ô | Giá trị |
|---|---|
| **Root Directory** | `src/frontend` |
| Framework Preset | Next.js *(tự nhận)* |
| Build / Install / Output | để nguyên mặc định |

**Root Directory bắt buộc là `src/frontend`.** `next build` đẻ ra `.next` ngay
tại thư mục dự án và Vercel chỉ tìm `.next` ở Root Directory; trỏ vào gốc repo
thì hỏng với *"No Output Directory named .next found"*. `next.config.ts`,
`tailwind.config.ts`, `postcss.config.mjs`, `.eslintrc.json` đều nằm trong
`src/frontend` vì lý do đó — PostCSS dò cấu hình theo **thư mục làm việc**, để
ở gốc repo thì trên Vercel Tailwind không được nạp và trang mất sạch class
tiện ích, mà build vẫn XANH.

Biến môi trường (Settings → Environment Variables), đúng 4 biến:

```
NEXT_PUBLIC_API_BASE_URL      = https://<FQDN backend>
NEXT_PUBLIC_SUPABASE_URL      = <SUPABASE_URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY = <SUPABASE_ANON_KEY>
NEXT_PUBLIC_GOOGLE_CLIENT_ID  = <GOOGLE_CLIENT_ID>
```

**Không bao giờ đưa `SUPABASE_SERVICE_ROLE_KEY` hay `SUPABASE_SERVICE_KEY` lên
Vercel.** Chúng bỏ qua RLS, còn mọi biến `NEXT_PUBLIC_*` đều nằm trong bundle
JavaScript ai cũng đọc được.

WebSocket không có biến riêng: frontend suy ra `wss://` từ chính
`NEXT_PUBLIC_API_BASE_URL`.

---

## 4. Domain, tài khoản ngoài, tự động hoá

### 4.1 Domain riêng

**Frontend** — Vercel → **Settings → Domains → Add** → nhập `smartats.tech`.
Dùng đúng bản ghi DNS mà Vercel hiện ra (thường `A @ → 76.76.21.21` và
`CNAME www → cname.vercel-dns.com`), đừng chép từ tài liệu cũ. HTTPS được cấp
tự động sau khi DNS trỏ đúng.

**Backend** *(tuỳ chọn)* — Container Apps cấp chứng chỉ miễn phí:

```bash
az containerapp show --name $APP_NAME --resource-group $RG \
  --query properties.customDomainVerificationId -o tsv
```

Thêm `CNAME api → $FQDN` và `TXT asuid.api → <mã vừa lấy>`, rồi:

```bash
az containerapp hostname add  --hostname api.smartats.tech --name $APP_NAME --resource-group $RG
az containerapp hostname bind --hostname api.smartats.tech --name $APP_NAME --resource-group $RG \
  --environment $ENV_NAME --validation-method CNAME
```

Xong thì đổi `NEXT_PUBLIC_API_BASE_URL` và **Redeploy** frontend.

### 4.2 Google Cloud Console

OAuth client do một thành viên tạo. Mỗi domain mới phải khai thêm ở
**APIs & Services → Credentials → OAuth 2.0 Client ID**:

- **Authorized JavaScript origins:** `https://smartats.tech`,
  `https://www.smartats.tech`, `https://applicant-tracking-system-alpha.vercel.app`
- **Authorized redirect URIs:** `https://smartats.tech/schedule`,
  `https://applicant-tracking-system-alpha.vercel.app/schedule`

Backend chỉ gửi được **một** giá trị `redirect_uri` khi đổi authorization code
lấy token (`modules/scheduling/adapters/routes.py`), nên luồng **kết nối Google
Calendar** chỉ chạy từ domain chính. Domain khác vẫn mở app và đăng nhập bình
thường.

### 4.3 Tự động deploy khi merge vào `main` *(tuỳ chọn)*

`.github/workflows/ci-cd.yml` đã có sẵn job `deploy`; thiếu secret thì job tự
bỏ qua chứ không đỏ. Job này build image **trên runner của GitHub**, không dùng
ACR Tasks — nên phần tính phí ở 1.2 không liên quan.

```bash
SUB=$(az account show --query id -o tsv)
az ad sp create-for-rbac --name "smartats-github-deploy" \
  --role contributor --scopes /subscriptions/$SUB/resourceGroups/$RG --json-auth
```

Copy toàn bộ khối JSON, vào GitHub → **Settings → Secrets and variables →
Actions**, thêm `AZURE_CREDENTIALS` (khối JSON), `ACR_NAME`,
`AZURE_RESOURCE_GROUP`, `AZURE_CONTAINER_APP`.

> Tài khoản sinh viên của trường thường **bị chặn tạo service principal**
> (`Insufficient privileges to complete the operation`). Gặp lỗi đó thì bỏ qua
> phần này và deploy tay theo 1.2 — không có cách vòng nào từ phía bạn.

Job `docker-build` (chạy trên mọi nhánh) build với `--build-arg
BAKE_MODEL=false`: nó chỉ cần chứng minh image build được và container khởi
động được. Job `deploy` build lại với mặc định `BAKE_MODEL=true` nên bản lên
production vẫn có mô hình nằm sẵn trong image.

CI đợi `/health` của revision mới trả lời rồi mới báo xanh — `az containerapp
update` trả về ngay khi Azure **nhận** yêu cầu, không phải khi bản mới đã phục
vụ được.

### 4.4 Giữ credit

2 vCPU / 4 GiB chạy liên tục tốn khoảng **40–60 USD/tháng**; credit sinh viên
100 USD đủ khoảng hai tháng.

Giữa các buổi demo, hạ về 0 replica:

```bash
az containerapp update --name $APP_NAME --resource-group $RG --min-replicas 0
```

Đổi lại request đầu tiên sau khi ngủ mất **30–60 giây**. Mở link trước buổi bảo
vệ 10 phút, và trả về `--min-replicas 1` trước khi demo.

Xoá sạch khi không dùng nữa:

```bash
az group delete --name $RG --yes --no-wait
```

Lệnh này xoá Container App, ACR và môi trường Container Apps. Kiểm tra bằng
`az storage account list -o table` xem storage account chứa CV có nằm trong
resource group này không, trước khi chạy.

---

## 5. Những cái bẫy đã tốn thời gian của nhóm

### 5.1 Hai biến khoá Supabase, tên gần giống nhau

`Settings` đòi `SUPABASE_SERVICE_ROLE_KEY` (khoá JWT `service_role`), nhưng
client admin ở `modules/shared/infrastructure/supabase_client.py` đọc **thẳng
biến môi trường** `SUPABASE_SERVICE_KEY` (khoá `sb_secret_...`) và không nhìn
vào `Settings`.

Thiếu cái sau là kiểu hỏng khó chịu nhất: app khởi động bình thường, `/health`
xanh, nhưng mọi route dùng client admin — ingest, catalog, search, scheduling,
review — nhận `None` và trả 503 hoặc rỗng. Môi trường nào cũng phải có **cả
hai**.

### 5.2 `.env` không được lọt vào image

`Dockerfile` dùng `COPY . .`. `.dockerignore` loại `venv/`, `node_modules/`,
`src/frontend/` và `.env` — thiếu nó thì service-role key nằm trong layer của
image, ai kéo được image là đọc được khoá bỏ qua RLS.

### 5.3 Đừng `source .env`

Chuỗi kết nối Azure Blob chứa dấu `;` và không được đặt trong nháy, nên shell
cắt nó thành nhiều lệnh và biến vào tiến trình sai mà không có lỗi nào báo.
Dùng `push_env_to_azure.py` (1.3), hoặc để `config.py` tự nạp bằng dotenv như
`start_backend.sh` đang làm.

### 5.4 Backend không chạy được trên serverless

Mô hình nhúng cache trong tiến trình, WebSocket `/api/enrichment/ws/...`, và
`BackgroundTasks` chạy enrichment **sau khi** đã trả lời — cả ba đều cần một
tiến trình sống lâu. Cộng thêm thư viện 1,6 GB, vượt xa giới hạn 250 MB của
Lambda.

Muốn rẻ hơn thật sự thì phải bỏ mô hình nhúng chạy cục bộ: viết một
`EmbeddingProvider` gọi API (chỗ cắm có sẵn trong
`modules/scoring/application/embedding_service.py`). RAM tụt về ~256 MB, image
từ ~3 GB xuống ~200 MB. Đổi lại phải chạy `POST /api/admin/vector/reindex` vì
vector cũ thuộc không gian của mô hình cũ.

### 5.5 Cái gì KHÔNG chạy sau khi deploy — và vì sao

Ghi ra đây để không ai tưởng là hỏng:

| Không chạy | Lý do | Cách bật |
|---|---|---|
| Gửi email phòng phỏng vấn | `SMTP_*` rỗng; `send_room_details` trả **503 kèm lý do** thay vì giả vờ thành công | Đặt `SMTP_HOST/PORT/USERNAME/PASSWORD/FROM_EMAIL` rồi chạy lại 1.3 |
| Sự kiện Google Calendar khi xác nhận lịch | Interviewer chưa kết nối OAuth → `calendar_event_id` **NULL** (trước đây ghi uuid giả và báo "đã tạo") | Mỗi interviewer bấm kết nối Google ở trang lịch (`/api/scheduling/auth/google/*`) |
| Nút "Vector re-index" ở admin | RPC `reindex_embeddings` chưa có → **503 kèm lý do** | Chạy `V010__reindex_embeddings.sql` |
| Điểm khớp / xếp hạng cho đơn nộp TRƯỚC bản này | Pipeline CV chỉ chạy khi hồ sơ nộp vào; đơn cũ giữ `overall_score` NULL, tab Xếp hạng hiện "Chưa chấm" | Không có script chấm lại hàng loạt; nộp lại CV nếu cần |
| Đăng nhập bằng email công ty | `RECRUITER_EMAIL_DOMAINS` rỗng → chỉ `ADMIN_EMAILS` vào được | Đặt biến đó |
| Hội đồng chấm đúng nghĩa | DB chỉ có 1 tech lead → ngưỡng 80% thành 1/1 | Mời thêm tech lead |
| Làm giàu hồ sơ từ LinkedIn | Apify tốn tiền, nhóm chủ động bỏ qua | — |
| `/ai-agent-prompt` | Mockup tĩnh theo quyết định của chủ dự án | — |
