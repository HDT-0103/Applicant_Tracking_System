# Triển khai SmartATS

Tài liệu này thay cho `DEPLOY_AZURE.md` và `DEPLOY_FREE.md` cũ. Làm theo từ
trên xuống là ra một hệ thống chạy trên internet thật.

| Thành phần | Nơi chạy | Tiền túi |
|---|---|---|
| Backend (FastAPI + mô hình nhúng) | Azure Container Apps | 0đ — credit Azure for Students |
| Frontend (Next.js) | Vercel Hobby | 0đ |
| Cơ sở dữ liệu | Supabase Free (đang dùng) | 0đ |
| File CV | Azure Blob (đang dùng) | 0đ |

Thời gian: khoảng 1–2 tiếng, trong đó **20–30 phút chỉ ngồi chờ build image**.

---

## 0. Vì sao không phải Vercel Functions / Render Free / Lambda

Ba thứ nằm trong chính mã nguồn loại bỏ serverless, không phải sở thích:

| Ràng buộc | Hệ quả |
|---|---|
| `multilingual-e5-base` chiếm **~1 GB RAM**, cache trong tiến trình | Cần tiến trình thường trú; nạp nguội ~7 giây |
| WebSocket `/api/enrichment/ws/v1/analysis/{uuid}` | Cần kết nối giữ lâu |
| `BackgroundTasks` chạy enrichment **sau khi** đã trả lời | Tiến trình phải sống tiếp sau response |

Cộng thêm `torch` 561 MB, tổng thư viện 1,6 GB — vượt giới hạn gói 250 MB của
Lambda, và vượt RAM 512 MB của Render/Koyeb free. Hugging Face Spaces từng đủ
RAM nhưng SDK Docker nay đòi nạp credit.

Muốn thật sự free vĩnh viễn thì cách duy nhất là **bỏ mô hình nhúng chạy cục
bộ**: viết một `EmbeddingProvider` gọi API (chỗ cắm đã có trong
`modules/scoring/application/embedding_service.py`), RAM tụt về ~256 MB, image
từ ~3 GB xuống ~200 MB. Đổi lại phải chạy `POST /api/admin/vector/reindex` vì
vector cũ thuộc không gian của mô hình cũ. Đó là một việc riêng, không nằm
trong tài liệu này.

---

## 1. Việc bạn phải tự tay làm TRƯỚC

Không việc nào trong đây script làm thay được.

### 1.1 Azure — bạn đã có Azure for Students

Cài CLI và đăng nhập:

```bash
brew install azure-cli
```

```bash
az login
```

Kiểm tra đang đứng đúng subscription (nếu tài khoản có nhiều):

```bash
az account show --query "{name:name, id:id, state:state}" -o table
```

Không cần Docker Desktop — image sẽ được build **trên Azure** bằng `az acr
build`, máy bạn chỉ upload mã nguồn.

### 1.2 Tài khoản Vercel

Đăng ký ở <https://vercel.com/signup>, chọn **Continue with GitHub** bằng chính
tài khoản có quyền đọc repo `HDT-0103/Applicant_Tracking_System`. Gói Hobby,
không cần thẻ.

### 1.3 Khoá của các thành viên khác — bạn KHÔNG cần xin lại

Backend chỉ **bắt buộc 4 biến** để khởi động
(`modules/shared/infrastructure/config.py`): `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`. Mọi biến còn
lại có giá trị mặc định rỗng — thiếu thì app vẫn chạy, chỉ tính năng tương ứng
tắt.

File `.env` ở máy bạn **đã có sẵn** khoá Gemini, Groq, GitHub, Apify, Azure
Blob, Google OAuth và Slack. Script ở bước 2.4 đọc thẳng từ đó và đẩy lên
Azure. Bạn không phải mở khoá của ai ra xem, cũng không phải copy-paste.

Riêng `JWT_SECRET` thì **không** lấy từ `.env`: script sinh giá trị mới. Ai cầm
được nó thì ký được token cho bất kỳ role nào, kể cả `admin`, mà bản `.env` dev
đã nằm trên máy nhiều người.

### 1.4 Google Cloud Console — việc DUY NHẤT có thể phải nhờ người khác

Đăng nhập Google và đặt lịch phỏng vấn dùng OAuth client do một thành viên
khác tạo. Sau khi có domain Vercel (bước 3), phải vào Google Cloud Console →
**APIs & Services → Credentials → OAuth 2.0 Client ID** và thêm:

- **Authorized JavaScript origins:** `https://<domain>.vercel.app`
- **Authorized redirect URIs:** `https://<domain>.vercel.app/schedule`

Nếu bạn không có quyền vào project đó, nhờ người tạo client làm — mất 2 phút.
**Chưa làm thì mọi thứ khác vẫn chạy, chỉ nút đăng nhập Google báo lỗi
`redirect_uri_mismatch`.**

### 1.5 Supabase — không phải đổi gì

RLS đã bật, backend dùng service-role key nên không bị chặn. Nếu Supabase báo
project bị tạm dừng vì không hoạt động (gói Free tạm dừng sau 7 ngày), vào
dashboard bấm **Restore** trước khi demo.

---

## 2. Backend lên Azure Container Apps

### 2.1 Đặt biến cho phiên làm việc

```bash
export RG=smartats-rg
export LOCATION=southeastasia
export ENV_NAME=smartats-env
export APP_NAME=smartats-backend
export ACR_NAME=smartatsacr$RANDOM && echo "ACR_NAME=$ACR_NAME"
```

**Ghi lại dòng `ACR_NAME` vừa in ra.** Tên registry phải duy nhất toàn cầu nên
có `$RANDOM`; mở terminal mới là mất, và mọi lệnh sau đều cần nó.

### 2.2 Dựng hạ tầng (làm một lần)

```bash
az group create --name $RG --location $LOCATION

az extension add --name containerapp --upgrade
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.OperationalInsights --wait

az acr create --resource-group $RG --name $ACR_NAME --sku Basic --admin-enabled true
az containerapp env create --name $ENV_NAME --resource-group $RG --location $LOCATION
```

Hai dòng `az provider register` hay bị bỏ qua. Trên subscription mới tinh,
`containerapp env create` sẽ chết với `MissingSubscriptionRegistration` mà
không nói rõ phải đăng ký cái gì.

### 2.3 Build image trên Azure

```bash
cd /đường/dẫn/tới/repo
az acr build --registry $ACR_NAME --image smartats-backend:v1 --file Dockerfile .
```

**Mất 20–30 phút.** Image nặng ~3 GB vì `Dockerfile` nạp sẵn mô hình nhúng 1,1
GB vào image (`ARG BAKE_MODEL=true`). Đó là chủ ý: không nạp sẵn thì mỗi lần
container khởi động lại phải tải mô hình từ Hugging Face, và request tìm kiếm
đầu tiên sau mỗi lần deploy treo hàng phút.

`az acr build` build trên hạ tầng Azure, bạn chỉ upload mã nguồn. Nhờ
`.dockerignore` (mới thêm), phần upload chỉ vài MB thay vì 3 GB — và quan trọng
hơn, `.env` **không** bị đóng vào image.

### 2.4 Tạo Container App

```bash
ACR_PASS=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv)

az containerapp create \
  --name $APP_NAME \
  --resource-group $RG \
  --environment $ENV_NAME \
  --image $ACR_NAME.azurecr.io/smartats-backend:v1 \
  --registry-server $ACR_NAME.azurecr.io \
  --registry-username $ACR_NAME \
  --registry-password "$ACR_PASS" \
  --target-port 8000 \
  --ingress external \
  --cpu 2 --memory 4Gi \
  --min-replicas 1 --max-replicas 1
```

Ba tham số đừng đổi nếu chưa hiểu hệ quả:

- **`--min-replicas 1`** — không để 0. Mỗi lần thức dậy phải nạp lại mô hình 1
  GB: request đầu tiên treo hàng chục giây và WebSocket đang mở thì đứt.
- **`--memory 4Gi`** — mô hình chiếm ~1 GB ngay khi nạp, chưa phục vụ gì.
- **`--max-replicas 1`** — mỗi replica giữ một bản mô hình riêng, nên nhân
  replica là nhân RAM lẫn tiền. Bộ giới hạn tần suất cũng đếm theo TỪNG tiến
  trình (`modules/shared/infrastructure/rate_limit.py`), nên nhiều replica
  nghĩa là hạn mức thật bị nhân lên.

> **Revision đầu tiên sẽ CHẾT, đúng như dự kiến.** Chưa có biến môi trường nào
> nên `Settings` không khởi tạo được. Bước tiếp theo sửa việc đó.

### 2.5 Đẩy cấu hình từ `.env` lên

```bash
./venv/bin/python src/backend/scripts/push_env_to_azure.py \
    --app $APP_NAME --resource-group $RG
```

Script đọc `.env`, đưa 12 khoá lên dạng **secret** (không phải biến thường —
giá trị đặt thẳng sẽ hiện trong `az containerapp show` và trong cổng Azure),
sinh `JWT_SECRET` mới, rồi đặt biến môi trường trỏ vào các secret đó. Nó in tên
biến kèm trạng thái, **không in giá trị**.

Muốn xem trước khi gọi Azure: thêm `--dry-run`.

Biến nào rỗng trong `.env` sẽ được báo `BỎ QUA` — đó là thông tin, không phải
lỗi. Xem mục 6 để biết mất tính năng gì.

Chờ khoảng 1–2 phút rồi kiểm tra:

```bash
FQDN=$(az containerapp show --name $APP_NAME --resource-group $RG \
       --query properties.configuration.ingress.fqdn -o tsv) && echo "https://$FQDN"
curl -s "https://$FQDN/health"
```

Phải ra `{"status":"ok",...}`. Chưa ra thì xem mục 7.

---

## 3. Frontend lên Vercel

### 3.1 Tạo project

<https://vercel.com/new> → **Import** repo `Applicant_Tracking_System`.

Trong màn hình cấu hình, sửa đúng **một** thứ:

| Ô | Giá trị |
|---|---|
| **Root Directory** | `src/frontend` |
| Framework Preset | Next.js *(tự nhận)* |
| Build / Install / Output | để nguyên mặc định |

**Root Directory bắt buộc là `src/frontend`.** `next build` đẻ ra `.next` ngay
tại thư mục dự án, và Vercel chỉ tìm `.next` ở Root Directory. Trỏ vào gốc repo
thì build xanh nhưng deploy hỏng với *"No Output Directory named .next found"*.
Cấu hình Tailwind và PostCSS cũng đã được chuyển vào `src/frontend` để chúng
được nạp đúng — PostCSS dò file cấu hình theo **thư mục làm việc**, không phải
theo thư mục dự án.

### 3.2 Biến môi trường

Vẫn ở màn hình đó, mở **Environment Variables** và thêm đúng 4 biến (lấy giá
trị từ `.env` ở máy):

```
NEXT_PUBLIC_API_BASE_URL      = https://<FQDN lấy ở bước 2.5>
NEXT_PUBLIC_SUPABASE_URL      = <SUPABASE_URL trong .env>
NEXT_PUBLIC_SUPABASE_ANON_KEY = <SUPABASE_ANON_KEY trong .env>
NEXT_PUBLIC_GOOGLE_CLIENT_ID  = <GOOGLE_CLIENT_ID trong .env>
```

Hai điều dễ sai:

1. **`NEXT_PUBLIC_*` được nhúng lúc BUILD, không phải lúc chạy.** Đổi biến sau
   là phải **Redeploy**, không phải restart. Thiếu `NEXT_PUBLIC_API_BASE_URL`
   thì frontend gọi vào `http://localhost:8000` — tức là gọi vào máy của chính
   người dùng, và không có lỗi nào nói vì sao.
2. **TUYỆT ĐỐI không đưa `SUPABASE_SERVICE_ROLE_KEY` lên Vercel.** Key đó bỏ
   qua RLS, còn mọi biến `NEXT_PUBLIC_*` đều nằm trong bundle JavaScript ai
   cũng đọc được. Nó chỉ thuộc về backend.

Bấm **Deploy**. Xong sẽ có domain dạng `https://<tên>.vercel.app`.

### 3.3 Nếu chưa merge vào `main`

Vercel mặc định coi `main` là nhánh production. Đang muốn demo từ
`fix/integrate_code` thì vào **Settings → Git → Production Branch**, đổi thành
`fix/integrate_code`. Sau khi PR được merge thì đổi lại.

---

## 4. Nối hai đầu

Backend chưa biết domain Vercel, nên trình duyệt vẫn bị CORS chặn. Chạy lại
script kèm domain vừa có:

```bash
./venv/bin/python src/backend/scripts/push_env_to_azure.py \
    --app $APP_NAME --resource-group $RG \
    --frontend-url https://<tên>.vercel.app
```

Lệnh này đặt `CORS_ORIGINS` và `GOOGLE_REDIRECT_URI`, đồng thời **giữ nguyên**
`JWT_SECRET` đã sinh lần trước (sinh lại sẽ đăng xuất mọi phiên đang mở).

`CORS_ORIGINS` là bắt buộc: mặc định chỉ cho `http://localhost:3000`, và phần
nới lỏng cho localhost chỉ bật khi `APP_ENV=development`.

Rồi quay lại **mục 1.4** thêm domain đó vào Google Cloud Console.

---

## 5. Kiểm chứng — đừng tin màu xanh

```bash
curl -s "https://$FQDN/health"

BASE="https://$FQDN" ./venv/bin/python src/backend/scripts/smoke_flows.py
```

35 phép kiểm HTTP qua 4 luồng SRS, **khẳng định kết quả chứ không chỉ mã trạng
thái**: xếp hạng phải giảm dần, lọc cứng phải thu hẹp tập kết quả, `tech_lead`
phải KHÔNG đọc được tên ứng viên. Script tự tạo dữ liệu thử rồi tự dọn.

Đây là thứ bắt được lỗi mà pytest không thấy: sai tên cột, thiếu biến môi
trường, RPC chưa tạo, router rơi khỏi `main.py`. Đã hai lần tìm ra lỗi 500 mà
toàn bộ bộ test cho qua.

Sau đó mở domain Vercel và thử tay: đăng nhập bằng tài khoản trong
`ADMIN_EMAILS`, tạo tin tuyển dụng, nộp CV ở `/careers`.

---

## 6. Sau khi deploy, cái gì KHÔNG chạy — và vì sao

Ghi ra đây để không ai tưởng là hỏng:

| Không chạy | Lý do | Cách bật |
|---|---|---|
| Gửi email phòng phỏng vấn | `SMTP_*` rỗng trong `.env`; `send_room_details` trả **503 kèm lý do** thay vì giả vờ thành công | Đặt `SMTP_HOST/PORT/USERNAME/PASSWORD/FROM_EMAIL` rồi chạy lại script mục 2.5 |
| Đăng nhập Google | Chưa thêm domain Vercel vào Google Cloud Console | Mục 1.4 |
| Đăng nhập bằng email công ty | `RECRUITER_EMAIL_DOMAINS` rỗng → chỉ `ADMIN_EMAILS` vào được | Đặt biến đó nếu muốn |
| Hội đồng chấm đúng nghĩa | DB chỉ có 1 tech lead → ngưỡng 80% thành 1/1 | Mời thêm tech lead, xem `scripts/assign_review_panels.py` |
| Làm giàu hồ sơ từ LinkedIn | Apify tốn tiền, nhóm chủ động bỏ qua | — |
| `/ai-agent-prompt` | Là mockup tĩnh theo quyết định của chủ dự án | — |

Nếu tin tuyển dụng **chưa có hội đồng Tech Lead**, hồ sơ sẽ nằm im ở
`waiting_for_tls` và tech lead mở hồ sơ nhận 404 — không có thông báo nào giải
thích. Kiểm tra trên DB production:

```bash
./venv/bin/python src/backend/scripts/assign_review_panels.py         # báo cáo
./venv/bin/python src/backend/scripts/assign_review_panels.py --all   # lấp chỗ trống
```

---

## 7. Khi hỏng

```bash
az containerapp logs show --name $APP_NAME --resource-group $RG --follow
az containerapp revision list --name $APP_NAME --resource-group $RG -o table
```

| Triệu chứng | Nguyên nhân hay gặp |
|---|---|
| `/health` không trả lời, log có `ValidationError` | Thiếu 1 trong 4 biến bắt buộc — chạy lại mục 2.5 |
| Container bị OOM, restart liên tục | `--memory` dưới 4Gi |
| Trình duyệt báo lỗi CORS | Chưa chạy mục 4, hoặc domain có dấu `/` ở cuối |
| Frontend gọi `localhost:8000` | Thiếu `NEXT_PUBLIC_API_BASE_URL` lúc **build** — Redeploy trên Vercel |
| Giao diện mất sạch layout | Build không nạp được Tailwind — kiểm tra Root Directory đúng `src/frontend` chưa |
| `redirect_uri_mismatch` | Mục 1.4 |
| Trang trắng, console báo lỗi Supabase | Project Supabase đang bị tạm dừng — vào dashboard Restore |

---

## 8. Deploy lần sau

Sửa code xong, hai lệnh:

```bash
az acr build --registry $ACR_NAME --image smartats-backend:v2 --file Dockerfile .
az containerapp update --name $APP_NAME --resource-group $RG \
  --image $ACR_NAME.azurecr.io/smartats-backend:v2
```

Frontend thì Vercel tự build lại mỗi khi có commit mới trên nhánh production.

### Tự động hoá bằng GitHub Actions (tuỳ chọn)

`.github/workflows/ci-cd.yml` đã có sẵn job `deploy`, chạy khi push vào `main`
**và** đã cấu hình đủ secret; thiếu secret thì job bỏ qua chứ không đỏ.

```bash
SUB=$(az account show --query id -o tsv)
az ad sp create-for-rbac --name "smartats-github-deploy" \
  --role contributor --scopes /subscriptions/$SUB/resourceGroups/$RG --json-auth
```

Copy toàn bộ khối JSON, vào GitHub → **Settings → Secrets and variables →
Actions** thêm `AZURE_CREDENTIALS` (khối JSON), `ACR_NAME`,
`AZURE_RESOURCE_GROUP`, `AZURE_CONTAINER_APP`.

Rồi cho Container App quyền kéo image bằng identity thay vì mật khẩu admin:

```bash
az containerapp identity assign --name $APP_NAME --resource-group $RG --system-assigned
PRINCIPAL=$(az containerapp show --name $APP_NAME --resource-group $RG --query identity.principalId -o tsv)
ACR_ID=$(az acr show --name $ACR_NAME --query id -o tsv)
az role assignment create --assignee $PRINCIPAL --role AcrPull --scope $ACR_ID
```

> Tài khoản sinh viên của trường thường **bị chặn tạo service principal**
> (`Insufficient privileges to complete the operation`). Gặp lỗi đó thì bỏ qua
> phần này và deploy tay như trên — không có cách vòng nào khác từ phía bạn.

CI đợi `/health` của revision mới trả lời rồi mới báo xanh. Bước chờ đó quan
trọng: `az containerapp update` trả về ngay khi Azure **nhận** yêu cầu, không
phải khi bản mới đã phục vụ được.

---

## 9. Giữ credit

2 vCPU / 4 GiB chạy liên tục tốn khoảng **40–60 USD/tháng**; credit sinh viên
100 USD đủ khoảng hai tháng.

Giữa các buổi demo, hạ về 0 replica:

```bash
az containerapp update --name $APP_NAME --resource-group $RG --min-replicas 0
```

Đổi lại request đầu tiên sau khi ngủ mất **30–60 giây** (khởi động container +
nạp mô hình). Nhớ mở link trước buổi bảo vệ 10 phút, và trả về `--min-replicas
1` trước khi demo.

Bảo vệ xong thì xoá sạch:

```bash
az group delete --name $RG --yes --no-wait
```

Lệnh này xoá Container App, ACR và môi trường Container Apps. **Không** đụng
tới Azure Blob chứa CV nếu storage account nằm ở resource group khác — kiểm tra
trước bằng `az storage account list -o table`.

---

## Phụ lục: những gì trong repo đã đổi để deploy được

| File | Vì sao |
|---|---|
| `.dockerignore` *(mới)* | `Dockerfile` dùng `COPY . .`, trước đây nuốt cả `venv/` (1,6 GB), `node_modules/` (955 MB) và **`.env` chứa service-role key** vào image |
| `src/frontend/package.json` *(mới)* | Vercel cần một package Next.js thật tại Root Directory; `package.json` ở gốc repo giữ vai trò điều phối và gọi vào đây bằng `npm --prefix` |
| `next.config.ts` → `src/frontend/` | Next đọc config từ **thư mục dự án**, nên bản ở gốc chưa từng được nạp — cảnh báo chọn nhầm workspace root vẫn còn nguyên dù đã có `outputFileTracingRoot` |
| `tailwind.config.ts`, `postcss.config.mjs` → `src/frontend/` | PostCSS dò cấu hình theo **thư mục làm việc**. Để ở gốc thì khi Vercel build với cwd = `src/frontend`, Tailwind không được nạp và trang mất sạch class tiện ích — mà build vẫn xanh |
| `src/backend/scripts/push_env_to_azure.py` *(mới)* | 12 khoá phải lên Azure, trong đó chuỗi kết nối Blob chứa `;` nên `source .env` sẽ đứt giữa chừng |

Cách chạy ở máy local **không đổi**: `npm run dev`, `npm run build`, `npm test`
vẫn gõ ở gốc repo như cũ.
