#!/usr/bin/env bash
# Smoke test luồng Auth + Admin qua API (terminal, KHÔNG cần trình duyệt).
# YÊU CẦU: backend đang chạy (uvicorn port 8000) ở MỘT TERMINAL KHÁC.
#
#   bash src/backend/scripts/smoke_auth.sh              # chỉ đọc (không tạo user rác)
#   bash src/backend/scripts/smoke_auth.sh --register   # test luôn đăng ký 1 HR tạm
#
# Tuỳ biến:  BASE=http://localhost:8000 ADMIN_EMAIL=admin@smartats.com ADMIN_PASS=Admin@123
set -uo pipefail

BASE="${BASE:-http://localhost:8000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@smartats.com}"
ADMIN_PASS="${ADMIN_PASS:-Admin@123}"
jget() { python3 -c "import sys,json;print(json.load(sys.stdin)$1)" 2>/dev/null; }

echo "== 0) Kiểm tra backend đang chạy =="
if ! curl -s --max-time 5 -o /dev/null "$BASE/docs"; then
  echo "   ❌ Không gọi được $BASE — backend CHƯA chạy (hoặc sai port)."
  echo "      Mở terminal khác, chạy uvicorn (port 8000) trước, rồi chạy lại script này:"
  echo "      PYTHONPATH=\"\$(pwd)/src:\$(pwd)/src/backend\" ./venv/bin/python -m uvicorn apps.main:app --host 0.0.0.0 --port 8000 --app-dir src/backend"
  exit 1
fi
echo "   OK — backend đang chạy ở $BASE"

echo "== 1) Admin login ($ADMIN_EMAIL) =="
LOGIN=$(curl -s --max-time 20 -w $'\n%{http_code}' -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}") \
  || { echo "   ❌ curl login lỗi/timeout (DB Supabase treo? sai SSL/pooler?)"; exit 1; }
CODE=$(printf '%s' "$LOGIN" | tail -n1)
BODY=$(printf '%s' "$LOGIN" | sed '$d')
if [ "$CODE" != "200" ]; then
  echo "   ❌ Login trả HTTP $CODE — body: $BODY"
  echo "      (401 = sai mật khẩu / chưa seed admin;  500 = lỗi DB/schema)"
  exit 1
fi
TOKEN=$(printf '%s' "$BODY" | jget "['accessToken']")
ROLE=$(printf '%s' "$BODY" | jget "['user']['role']")
[ -n "$TOKEN" ] || { echo "   ❌ Không lấy được token — body: $BODY"; exit 1; }
echo "   OK -> role=$ROLE (mong đợi: admin)"

echo "== 2) Endpoint admin (mong đợi 200) =="
for ep in /api/admin/users /api/admin/abac/policies /api/admin/sessions \
          /api/admin/analytics/ai /api/admin/analytics/ai/timeseries \
          /api/admin/infrastructure/metrics /api/admin/audit-logs; do
  code=$(curl -s --max-time 20 -o /dev/null -w "%{http_code}" "$BASE$ep" -H "Authorization: Bearer $TOKEN")
  printf "   %-42s -> %s\n" "$ep" "$code"
done

echo "== 3) Đăng ký HR =="
if [ "${1:-}" = "--register" ]; then
  EMAIL="hr_smoke_$(date +%s)@company.com"
  REG=$(curl -s --max-time 20 -w $'\n%{http_code}' -X POST "$BASE/api/auth/register" \
    -H 'Content-Type: application/json' \
    -d "{\"name\":\"HR Smoke\",\"email\":\"$EMAIL\",\"password\":\"Secret123\"}") \
    || { echo "   ❌ curl register lỗi/timeout"; exit 1; }
  RCODE=$(printf '%s' "$REG" | tail -n1); RBODY=$(printf '%s' "$REG" | sed '$d')
  if [ "$RCODE" != "200" ]; then echo "   ❌ Register HTTP $RCODE: $RBODY"; exit 1; fi
  echo "   OK -> $EMAIL role=$(printf '%s' "$RBODY" | jget "['user']['role']") (mong đợi: recruiter)"
  echo "   (dọn thử nghiệm — Supabase SQL Editor: delete from users where email='$EMAIL';)"
else
  echo "   (bỏ qua — thêm cờ --register để test tạo HR)"
fi
echo "DONE ✅"
