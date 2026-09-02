# Triển khai backend lên Azure Container Apps

Frontend đi Vercel, backend đi Azure Container Apps. Tài liệu này gồm phần dựng
hạ tầng **làm một lần** (chạy tay), rồi sau đó mỗi lần push vào `main` là CI tự
deploy.

## Vì sao là Container Apps chứ không phải serverless

Backend này **không** chạy được trên Vercel Functions hay AWS Lambda, vì ba lý
do nằm trong chính mã nguồn:

| Ràng buộc | Hệ quả |
|---|---|
| Mô hình nhúng `multilingual-e5-base` chiếm **~1 GB RAM**, cache trong tiến trình | Cần tiến trình thường trú; nạp nguội mất ~7 giây |
| WebSocket `/api/enrichment/ws/v1/analysis/{uuid}` | Cần kết nối giữ lâu |
| `BackgroundTasks` chạy enrichment **sau khi** đã trả lời | Tiến trình phải sống tiếp sau response |

Cộng thêm `torch` 561 MB, tổng thư viện 1.6 GB — vượt xa giới hạn gói 250 MB
của Lambda.

Chọn Azure vì hạ tầng đã ở đó: CV lưu trên Azure Blob, `AZURE_SERVICE_BUS_*`
đã khai sẵn. Cùng một cloud thì SAS URL, mạng và hoá đơn nằm một chỗ.

---

## 1. Dựng hạ tầng (làm một lần)

Cần [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli).

```bash
az login

# Đổi cho phù hợp. ACR_NAME phải DUY NHẤT toàn cầu và chỉ gồm chữ+số.
export RG=smartats-rg
export LOCATION=southeastasia          # gần VN nhất
export ACR_NAME=smartatsacr$RANDOM
export ENV_NAME=smartats-env
export APP_NAME=smartats-backend

az group create --name $RG --location $LOCATION

# Container Registry — nơi chứa image
az acr create --resource-group $RG --name $ACR_NAME --sku Basic --admin-enabled true

# Môi trường Container Apps
az extension add --name containerapp --upgrade
az provider register --namespace Microsoft.App --wait
az containerapp env create --name $ENV_NAME --resource-group $RG --location $LOCATION
```

## 2. Tạo Container App

```bash
az containerapp create \
  --name $APP_NAME \
  --resource-group $RG \
  --environment $ENV_NAME \
  --image mcr.microsoft.com/k8se/quickstart:latest \
  --target-port 8000 \
  --ingress external \
  --registry-server $ACR_NAME.azurecr.io \
  --registry-identity system \
  --cpu 2 --memory 4Gi \
  --min-replicas 1 --max-replicas 3
```

Ba tham số quan trọng, đừng đổi nếu chưa hiểu hệ quả:

- **`--min-replicas 1`** — KHÔNG để 0. Scale-to-zero nghe hấp dẫn, nhưng mỗi
  lần thức dậy phải nạp lại mô hình 1 GB: request tìm kiếm đầu tiên treo ~7
  giây, và WebSocket đang mở thì đứt.
- **`--memory 4Gi`** — mô hình chiếm ~1 GB ngay khi nạp, chưa phục vụ gì. 2 GB
  chạy được nhưng không còn chỗ xoay xở.
- **`--max-replicas 3`** — mỗi replica giữ một bản mô hình riêng, nên nhân
  replica là nhân RAM. Bộ giới hạn tần suất cũng đếm theo TỪNG tiến trình
  (xem `modules/shared/infrastructure/rate_limit.py`), nên 3 replica nghĩa là
  hạn mức thật gấp 3 lần con số cấu hình.

## 3. Đặt biến môi trường và secret

Bí mật đặt bằng `secretref`, không đặt thẳng vào biến — giá trị thẳng sẽ hiện
trong `az containerapp show` và trong cổng Azure.

```bash
az containerapp secret set --name $APP_NAME --resource-group $RG --secrets \
  supabase-url="https://xxx.supabase.co" \
  supabase-anon-key="..." \
  supabase-service-role-key="..." \
  jwt-secret="$(openssl rand -hex 32)" \
  azure-storage="DefaultEndpointsProtocol=..." \
  google-client-id="..." \
  google-client-secret="..." \
  gemini-api-key="..." \
  groq-api-key="..." \
  slack-webhook="https://hooks.slack.com/services/..." \
  smtp-username="..." \
  smtp-password="..."

az containerapp update --name $APP_NAME --resource-group $RG \
  --set-env-vars \
    APP_ENV=production \
    APP_TIMEZONE=Asia/Ho_Chi_Minh \
    CORS_ORIGINS="https://<app>.vercel.app" \
    GOOGLE_REDIRECT_URI="https://<app>.vercel.app/schedule" \
    SMTP_HOST=smtp.gmail.com \
    SMTP_PORT=587 \
    SMTP_FROM_EMAIL="tuyendung@example.com" \
    SUPABASE_URL=secretref:supabase-url \
    SUPABASE_ANON_KEY=secretref:supabase-anon-key \
    SUPABASE_SERVICE_ROLE_KEY=secretref:supabase-service-role-key \
    JWT_SECRET=secretref:jwt-secret \
    AZURE_STORAGE_CONNECTION_STRING=secretref:azure-storage \
    GOOGLE_CLIENT_ID=secretref:google-client-id \
    GOOGLE_CLIENT_SECRET=secretref:google-client-secret \
    GEMINI_API_KEY=secretref:gemini-api-key \
    GROQ_API_KEY=secretref:groq-api-key \
    SLACK_WEBHOOK_URL=secretref:slack-webhook \
    SMTP_USERNAME=secretref:smtp-username \
    SMTP_PASSWORD=secretref:smtp-password
```

> **`JWT_SECRET` phải là giá trị MỚI**, không dùng lại giá trị trong `.env` trên
> máy dev. Ai có nó thì ký được token cho bất kỳ role nào, kể cả `admin`.

> **`CORS_ORIGINS` bắt buộc.** Mặc định chỉ cho `http://localhost:3000`, và
> phần nới lỏng cho localhost chỉ bật khi `APP_ENV=development`. Thiếu biến này
> là trình duyệt chặn sạch mọi lời gọi từ Vercel.

## 4. Cho GitHub quyền deploy

```bash
SUB=$(az account show --query id -o tsv)

az ad sp create-for-rbac \
  --name "smartats-github-deploy" \
  --role contributor \
  --scopes /subscriptions/$SUB/resourceGroups/$RG \
  --sdk-auth
```

Copy TOÀN BỘ khối JSON in ra. Vào GitHub → **Settings → Secrets and variables →
Actions**, thêm:

| Secret | Giá trị |
|---|---|
| `AZURE_CREDENTIALS` | khối JSON vừa copy |
| `ACR_NAME` | giá trị `$ACR_NAME` |
| `AZURE_RESOURCE_GROUP` | giá trị `$RG` |
| `AZURE_CONTAINER_APP` | giá trị `$APP_NAME` |

Cho Container App quyền kéo image:

```bash
az containerapp identity assign --name $APP_NAME --resource-group $RG --system-assigned
PRINCIPAL=$(az containerapp show --name $APP_NAME --resource-group $RG --query identity.principalId -o tsv)
ACR_ID=$(az acr show --name $ACR_NAME --query id -o tsv)
az role assignment create --assignee $PRINCIPAL --role AcrPull --scope $ACR_ID
```

## 5. Deploy

Push vào `main`. CI chạy test → build image → đẩy lên ACR → cập nhật Container
App → **chờ `/health` trả lời** rồi mới báo xanh.

Bước chờ đó quan trọng: `az containerapp update` trả về ngay khi Azure NHẬN yêu
cầu, không phải khi bản mới đã phục vụ được. Không chờ thì CI xanh trong khi
container có thể đang crash-loop.

Lấy địa chỉ:

```bash
az containerapp show --name $APP_NAME --resource-group $RG \
  --query properties.configuration.ingress.fqdn -o tsv
```

## 6. Frontend trên Vercel

Trong Vercel → **Settings → Environment Variables**:

```
NEXT_PUBLIC_API_BASE_URL = https://<fqdn-vừa-lấy>
NEXT_PUBLIC_SUPABASE_URL = https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = <anon key>
```

Hai điều dễ sai:

1. **`NEXT_PUBLIC_*` được nhúng lúc BUILD, không phải lúc chạy.** Đặt biến
   trước khi build; đổi sau phải build lại. Thiếu `NEXT_PUBLIC_API_BASE_URL`
   thì frontend gọi vào `http://localhost:8000` — tức là gọi vào máy của chính
   người dùng.
2. **TUYỆT ĐỐI không đưa `SUPABASE_SERVICE_ROLE_KEY` vào Vercel.** Key đó bỏ
   qua RLS, và mọi biến `NEXT_PUBLIC_*` đều nằm trong bundle JavaScript ai cũng
   đọc được. Nó chỉ thuộc về backend.

Sau khi có domain Vercel, quay lại cập nhật `CORS_ORIGINS` và
`GOOGLE_REDIRECT_URI` ở bước 3, đồng thời thêm redirect URI đó vào Google Cloud
Console → OAuth 2.0 Client.

---

## Kiểm tra sau khi deploy

```bash
FQDN=$(az containerapp show --name $APP_NAME --resource-group $RG --query properties.configuration.ingress.fqdn -o tsv)
curl -s "https://$FQDN/health"                       # {"status":"ok",...}
BASE="https://$FQDN" ./venv/bin/python src/backend/scripts/smoke_flows.py
```

Script smoke chạy được với `BASE` trỏ vào production — nó tự tạo một ứng viên
thử rồi dọn. Đây là cách nhanh nhất để biết bản deploy có thật sự hoạt động,
chứ không chỉ có `/health` trả lời.

## Xem log

```bash
az containerapp logs show --name $APP_NAME --resource-group $RG --follow
```

## Chi phí

2 vCPU / 4 GiB với `min-replicas 1` chạy liên tục khoảng **40–60 USD/tháng**.
Azure for Students cấp 100 USD credit — đủ cho một học kỳ.

Muốn rẻ hơn thì cách duy nhất đáng kể là bỏ mô hình nhúng chạy cục bộ: viết một
`EmbeddingProvider` gọi API (chỗ để cắm đã có sẵn trong
`modules/scoring/application/embedding_service.py`). RAM tụt về ~256 MB và
image từ ~3 GB xuống ~200 MB. Đổi lại phải chạy `POST /api/admin/vector/reindex`
vì vector cũ thuộc không gian của mô hình cũ.
