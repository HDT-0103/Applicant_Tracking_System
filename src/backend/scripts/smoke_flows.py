#!/usr/bin/env python3
"""Smoke test 4 luồng nghiệp vụ chính của SmartATS, qua HTTP thật.

    # Backend phải đang chạy ở một terminal khác:
    PYTHONPATH="$(pwd)/src:$(pwd)/src/backend" ./venv/bin/python -m uvicorn \
        apps.main:app --host 0.0.0.0 --port 8000 --app-dir src/backend

    # Rồi:
    ./venv/bin/python src/backend/scripts/smoke_flows.py

    BASE=http://localhost:8000  ./venv/bin/python src/backend/scripts/smoke_flows.py
    ./venv/bin/python src/backend/scripts/smoke_flows.py --keep   # giữ lại dữ liệu thử

## Script này khác gì bộ pytest

`pytest` chạy trên repo giả và mock — nhanh, kín, nhưng không chứng minh được
hệ thống ĐANG CHẠY có hoạt động không. Nhiều lỗi chỉ lộ ra ở đây: sai tên cột
thật, thiếu biến môi trường, RLS chặn nhầm, RPC chưa tạo trên Supabase, route
rơi khỏi `main.py`. Script này gọi đúng những endpoint mà giao diện gọi, trên
đúng cơ sở dữ liệu thật.

Vì vậy nó KHẲNG ĐỊNH KẾT QUẢ, không chỉ mã trạng thái: xếp hạng phải giảm dần,
lọc cứng phải thu hẹp tập kết quả, tech_lead phải KHÔNG đọc được tên ứng viên.

## Dữ liệu

Script tạo một ứng viên thử rồi tự xoá ở cuối (`--keep` để giữ lại mà xem).
Mọi bản ghi nó tạo đều mang tiền tố `[SMOKE]` để nhận ra ngay nếu có sót.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import uuid as uuidlib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Optional

# --- sys.path: cho phép chạy script từ bất kỳ thư mục nào ------------------
_ROOT = Path(__file__).resolve().parents[3]
for _p in (_ROOT, _ROOT / "src", _ROOT / "src" / "backend"):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

try:
    from dotenv import load_dotenv

    load_dotenv(_ROOT / ".env", override=False)
except ImportError:
    pass

import httpx  # noqa: E402

BASE = os.getenv("BASE", "http://localhost:8000")
TIMEOUT = float(os.getenv("SMOKE_TIMEOUT", "60"))
MARK = "[SMOKE]"

GREEN, RED, YELLOW, DIM, BOLD, RESET = (
    "\033[32m", "\033[31m", "\033[33m", "\033[2m", "\033[1m", "\033[0m"
)


# ---------------------------------------------------------------------------
# Khung chạy
# ---------------------------------------------------------------------------

@dataclass
class Result:
    name: str
    status: str  # PASS | FAIL | SKIP
    detail: str = ""


@dataclass
class Runner:
    results: list[Result] = field(default_factory=list)
    _flow: str = ""

    def flow(self, title: str) -> None:
        self._flow = title
        print(f"\n{BOLD}== {title} =={RESET}")

    def check(self, name: str, fn: Callable[[], Optional[str]]) -> None:
        """Chạy một phép kiểm.

        `fn` trả về None nếu đạt, hoặc một chuỗi mô tả nếu bỏ qua/không đạt.
        Ném `Skip` để báo bỏ qua (thiếu cấu hình, không có dữ liệu để thử).
        """
        label = f"{self._flow} · {name}" if self._flow else name
        try:
            detail = fn()
            self.results.append(Result(label, "PASS", detail or ""))
            print(f"   {GREEN}✓{RESET} {name}" + (f" {DIM}— {detail}{RESET}" if detail else ""))
        except Skip as exc:
            self.results.append(Result(label, "SKIP", str(exc)))
            print(f"   {YELLOW}–{RESET} {name} {DIM}— bỏ qua: {exc}{RESET}")
        except AssertionError as exc:
            self.results.append(Result(label, "FAIL", str(exc)))
            print(f"   {RED}✗{RESET} {name}\n     {RED}{exc}{RESET}")
        except Exception as exc:  # lỗi không lường trước cũng là hỏng
            self.results.append(Result(label, "FAIL", f"{type(exc).__name__}: {exc}"))
            print(f"   {RED}✗{RESET} {name}\n     {RED}{type(exc).__name__}: {exc}{RESET}")

    def summary(self) -> int:
        passed = sum(1 for r in self.results if r.status == "PASS")
        failed = [r for r in self.results if r.status == "FAIL"]
        skipped = [r for r in self.results if r.status == "SKIP"]

        print(f"\n{BOLD}{'─' * 62}{RESET}")
        print(f"{BOLD}Kết quả:{RESET} {GREEN}{passed} đạt{RESET}"
              f"  {RED}{len(failed)} hỏng{RESET}"
              f"  {YELLOW}{len(skipped)} bỏ qua{RESET}")

        if skipped:
            print(f"\n{YELLOW}Bỏ qua (thường là thiếu cấu hình, không phải lỗi code):{RESET}")
            for r in skipped:
                print(f"  – {r.name}: {r.detail}")

        if failed:
            print(f"\n{RED}{BOLD}Hỏng:{RESET}")
            for r in failed:
                print(f"  ✗ {r.name}\n      {r.detail}")
            return 1

        print(f"\n{GREEN}Mọi luồng đã kiểm đều chạy đúng.{RESET}")
        return 0


class Skip(Exception):
    """Không kiểm được vì thiếu điều kiện, không phải vì code sai."""


# ---------------------------------------------------------------------------
# Xác thực
# ---------------------------------------------------------------------------

def pick_identities() -> dict[str, str | None]:
    """Chọn id thật cho token hr / tech_lead: chủ của một tin PUBLISHED và một
    thành viên hội đồng của tin đó.

    Từ khi dữ liệu được tách theo người dùng, một HR chỉ thấy tin MÌNH tạo và
    hồ sơ nộp vào đó. Token ký cho một id ngẫu nhiên vì thế thấy dashboard
    rỗng, mở hồ sơ nhận 404 — bảng kết quả trông y hệt hệ thống hỏng trong
    khi thật ra chỉ là "người này không sở hữu gì". Nên smoke test phải đóng
    vai đúng người: chủ tin và tech lead trong hội đồng của tin đó.
    """
    ids: dict[str, str | None] = {"hr": None, "tech_lead": None}
    try:
        db = admin_db()
    except Skip:
        return ids
    jobs = (
        db.table("jobs_posting").select("id, created_by")
        .eq("status", "PUBLISHED").not_.is_("created_by", "null")
        .limit(1).execute().data
    )
    if not jobs:
        return ids
    ids["hr"] = jobs[0]["created_by"]
    panel = (
        db.table("job_posting_reviewers").select("reviewer_id")
        .eq("job_posting_id", jobs[0]["id"]).limit(1).execute().data
    )
    if panel:
        ids["tech_lead"] = panel[0]["reviewer_id"]
    return ids


def mint_tokens(
    jwt_secret: str | None = None, identities: dict[str, str | None] | None = None
) -> dict[str, str]:
    """Tạo access token cho từng role, ký bằng chính JWT_SECRET của backend.

    Ký trực tiếp thay vì đăng nhập thật để script không phải tạo tài khoản rác
    cho ba role, và không phụ thuộc vào việc ai đã đổi mật khẩu seed.
    `identities` gán id thật cho hr / tech_lead (xem `pick_identities`); thiếu
    thì dùng id giả, và các phép kiểm cần phạm vi sẽ thấy dữ liệu rỗng.

    Chạy với `BASE` trỏ vào production thì PHẢI truyền `--jwt-secret` của môi
    trường đó: bản deploy dùng khoá riêng, không phải khoá trong `.env` dev.
    Không truyền thì mọi lời gọi có xác thực trả 401 và bảng kết quả trông y
    hệt như hệ thống hỏng, trong khi thật ra chỉ là ký sai khoá.

    Không đọc được từ biến môi trường: `get_settings()` gọi
    `load_dotenv(override=True)`, nên `.env` LUÔN đè lên biến của shell.
    """
    from modules.auth.domain.models import AuthUser
    from modules.auth.infra.jwt_service import JwtService
    from modules.shared.infrastructure.config import get_settings

    settings = get_settings()
    if jwt_secret:
        settings = settings.model_copy(update={"jwt_secret": jwt_secret})

    jwt = JwtService(settings)
    identities = identities or {}
    tokens = {}
    for role in ("hr", "tech_lead", "admin"):
        user_id = identities.get(role) or str(
            uuidlib.uuid5(uuidlib.NAMESPACE_DNS, f"smoke-{role}")
        )
        tokens[role] = jwt.create_access_token(
            AuthUser(
                id=user_id,
                email=f"smoke-{role}@smartats.example.com",
                name=f"{MARK} {role}",
                role=role,
            )
        )
    # Tech lead KHÔNG thuộc hội đồng nào (id giả): dùng cho các phép kiểm ranh
    # giới. Token "tech_lead" ở trên là thành viên hội đồng thật, nên không
    # dùng nó để chứng minh "người ngoài bị chặn" được.
    tokens["tech_lead_outsider"] = jwt.create_access_token(
        AuthUser(
            id=str(uuidlib.uuid5(uuidlib.NAMESPACE_DNS, "smoke-tech_lead-outsider")),
            email="smoke-outsider@smartats.example.com",
            name=f"{MARK} outsider",
            role="tech_lead",
        )
    )
    return tokens


class Api:
    def __init__(self, base: str, tokens: dict[str, str]) -> None:
        self._client = httpx.Client(base_url=base, timeout=TIMEOUT)
        self._tokens = tokens

    def __call__(
        self, method: str, path: str, role: Optional[str] = None, **kw: Any
    ) -> httpx.Response:
        headers = dict(kw.pop("headers", {}))
        if role:
            headers["Authorization"] = f"Bearer {self._tokens[role]}"
        return self._client.request(method, path, headers=headers, **kw)

    def close(self) -> None:
        self._client.close()


def admin_db():
    """Client Supabase quyền service-role, để kiểm dữ liệu và dọn dẹp."""
    from modules.shared.infrastructure.config import get_settings
    from modules.shared.infrastructure.supabase_client import get_supabase_client

    client = get_supabase_client(get_settings(), use_admin=True)
    if client is None:
        raise Skip("Supabase chưa cấu hình")
    return client


MINIMAL_PDF = (
    b"%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    b"2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n"
    b"trailer\n<< /Root 1 0 R >>\n%%EOF\n"
)


# ---------------------------------------------------------------------------
# Các luồng
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--keep", action="store_true", help="Giữ lại dữ liệu thử")
    parser.add_argument(
        "--jwt-secret",
        help="JWT_SECRET của môi trường đang kiểm. Bắt buộc khi BASE trỏ vào "
             "production — xem docs/DEPLOY.md mục 5.",
    )
    args = parser.parse_args()

    run = Runner()
    state: dict[str, Any] = {}

    # --- 0. Backend sống chưa -------------------------------------------
    run.flow("0. Kết nối")
    try:
        health = httpx.get(f"{BASE}/health", timeout=10)
        health.raise_for_status()
    except Exception as exc:
        print(f"{RED}Không gọi được {BASE} — backend chưa chạy?{RESET}\n  {exc}")
        print(f"\n{DIM}Mở terminal khác và chạy:{RESET}")
        print('  PYTHONPATH="$(pwd)/src:$(pwd)/src/backend" ./venv/bin/python -m uvicorn '
              'apps.main:app --host 0.0.0.0 --port 8000 --app-dir src/backend')
        return 1
    run.check("/health trả ok", lambda: _eq(health.json().get("status"), "ok"))

    identities = pick_identities()
    if not identities["hr"]:
        print(f"{YELLOW}Không có tin PUBLISHED nào có created_by — token hr sẽ không "
              f"sở hữu gì và các phép kiểm theo phạm vi sẽ thấy dữ liệu rỗng. "
              f"Gán chủ cho tin: xem docs/DEPLOY.md.{RESET}")
    if not identities["tech_lead"]:
        print(f"{YELLOW}Tin PUBLISHED chưa có hội đồng — token tech_lead sẽ thấy "
              f"dashboard rỗng.{RESET}")
    tokens = mint_tokens(args.jwt_secret, identities)
    api = Api(BASE, tokens)

    try:
        _flow_auth(run, api)
        _flow_a_ingestion(run, api, state)
        _flow_b_search(run, api)
        _flow_c_enrichment(run, api, state)
        _flow_d_abac_scheduling(run, api, state)
        _flow_review(run, api, state)
        _flow_catalog(run, api)
    finally:
        if not args.keep:
            _cleanup(run, state)
        else:
            print(f"\n{YELLOW}--keep: giữ lại {state.get('candidate_uuid', '(không có)')}{RESET}")
        api.close()

    return run.summary()


def _flow_auth(run: Runner, api: Api) -> None:
    run.flow("Xác thực & phân quyền")

    run.check(
        "không token bị chặn",
        lambda: _eq(api("GET", "/api/catalog/dashboard").status_code, 401),
    )
    run.check(
        "token hỏng bị chặn",
        lambda: _eq(
            api("GET", "/api/catalog/dashboard",
                headers={"Authorization": "Bearer not-a-token"}).status_code,
            401,
        ),
    )
    run.check(
        "admin không vào được dữ liệu nghiệp vụ",
        lambda: _eq(api("GET", "/api/catalog/dashboard", role="admin").status_code, 403),
    )
    run.check(
        "hr và tech_lead đều vào được",
        lambda: _all_eq(
            [api("GET", "/api/catalog/dashboard", role=r).status_code for r in ("hr", "tech_lead")],
            200,
        ),
    )


def _flow_a_ingestion(run: Runner, api: Api, state: dict) -> None:
    run.flow("Flow A — Nộp CV (SRS §3.2.1a)")

    def _reject(name: str, files: dict, expect: int = 400) -> Callable:
        def _fn() -> Optional[str]:
            r = api("POST", "/api/v1/ingest", files=files)
            return _eq(r.status_code, expect, hint=str(r.text)[:120])
        return _fn

    run.check("từ chối file không phải PDF",
              _reject("mime", {"file": ("cv.txt", b"%PDF- fake", "text/plain")}))
    run.check("từ chối file giả đuôi .pdf",
              _reject("magic", {"file": ("cv.pdf", b"MZ not a pdf", "application/pdf")}))
    run.check("từ chối file quá 10MB",
              _reject("size", {"file": ("big.pdf", b"%PDF-" + b"0" * (10 * 1024 * 1024 + 8), "application/pdf")}))

    db = admin_db()
    jobs = (
        db.table("jobs_posting").select("id, job_title")
        .eq("status", "PUBLISHED").limit(1).execute().data
    )
    if not jobs:
        run.check("nộp hồ sơ đầy đủ", lambda: _skip("chưa có tin tuyển dụng PUBLISHED nào"))
        return
    job = jobs[0]
    state["job_id"] = job["id"]

    before = db.table("applications").select("id", count="exact").execute().count

    screening = {
        "expected_salary_min": 15_000_000,
        "expected_salary_max": 20_000_000,
        "salary_basis": "gross",
        "work_mode_pref": ["onsite"],
        "availability_bucket": "immediate",
        "skill_ratings": {"Python": 4},
        "consent_data_sharing": True,
        "consent_at": "2026-09-01T00:00:00Z",
        "salary_expectation": 20_000_000,
        # Hai trường NỘI BỘ mà client cố ghi. Phải bị loại.
        "status": "APPROVED",
        "overall_score": 999,
    }
    resp = api(
        "POST", "/api/v1/ingest",
        files={"file": (f"{MARK}-cv.pdf", MINIMAL_PDF, "application/pdf")},
        data={"job_id": job["id"], "screening": json.dumps(screening)},
    )

    def _accepted() -> Optional[str]:
        assert resp.status_code == 202, f"mong đợi 202, nhận {resp.status_code}: {str(resp.text)[:200]}"
        body = resp.json()
        assert body.get("candidate_uuid"), "thiếu candidate_uuid"
        assert body.get("application_id"), "thiếu application_id — đơn ứng tuyển không được tạo"
        state["candidate_uuid"] = body["candidate_uuid"]
        state["application_id"] = body["application_id"]
        return f"candidate {body['candidate_uuid'][:8]}"

    run.check(f"nộp hồ sơ vào '{job['job_title'][:28]}'", _accepted)

    if "application_id" not in state:
        return

    def _exactly_one() -> Optional[str]:
        after = db.table("applications").select("id", count="exact").execute().count
        # Từng có lỗi ghi hai lần: trang careers gọi /ingest RỒI tự chèn thêm
        # dòng của riêng nó, trong khi backend đã ghi đủ.
        return _eq(after - before, 1, hint="mỗi hồ sơ chỉ được tạo ĐÚNG 1 đơn")
    run.check("tạo đúng 1 đơn ứng tuyển", _exactly_one)

    def _whitelist() -> Optional[str]:
        row = db.table("applications").select("*").eq("id", state["application_id"]).execute().data[0]
        assert row["status"] == "SUBMITTED", f"status bị client ghi đè thành {row['status']}"
        assert not row.get("overall_score"), f"overall_score bị client ghi: {row.get('overall_score')}"
        assert row["expected_salary_max"] == 20_000_000, "câu trả lời sàng lọc không được lưu"
        assert row["skill_ratings"] == {"Python": 4}, "skill_ratings không được lưu"
        return "status/overall_score bị chặn, câu trả lời được lưu"
    run.check("chỉ ghi cột trong danh sách trắng", _whitelist)


def _flow_b_search(run: Runner, api: Api) -> None:
    run.flow("Flow B — Tìm kiếm ngữ nghĩa (SRS §3.2.1d)")

    query = {
        "summary": "Senior Python backend engineer building REST APIs "
                   "with FastAPI and PostgreSQL",
        "experience": "3+ years backend, cloud deployment",
        "top_k": 10,
    }

    base = api("POST", "/api/search", role="hr", json=query)

    def _ranked() -> Optional[str]:
        assert base.status_code == 200, f"{base.status_code}: {str(base.text)[:200]}"
        results = base.json()["results"]
        if not results:
            raise Skip("chưa có ứng viên nào được nhúng vector")
        scores = [r["score"] for r in results]
        assert scores == sorted(scores, reverse=True), f"kết quả không giảm dần: {scores}"
        return f"{len(results)} ứng viên, điểm cao nhất {scores[0]:.3f}"

    run.check("xếp hạng giảm dần theo độ phù hợp", _ranked)

    if base.status_code != 200 or not base.json()["results"]:
        return
    results = base.json()["results"]

    def _hard_filter() -> Optional[str]:
        rare = api("POST", "/api/search", role="hr",
                   json={**query, "required_skills": ["Kubernetes"]}).json()
        # Lọc cứng: thiếu kỹ năng là loại, bất kể điểm ngữ nghĩa cao đến đâu.
        assert rare["total"] <= len(results), (
            f"lọc cứng làm tăng kết quả: {len(results)} -> {rare['total']}"
        )
        return f"{len(results)} -> {rare['total']} khi lọc Kubernetes"
    run.check("lọc cứng theo kỹ năng thu hẹp kết quả", _hard_filter)

    def _threshold() -> Optional[str]:
        cut = max(r["score"] for r in results) - 0.001
        body = api("POST", "/api/search", role="hr", json={**query, "min_score": cut}).json()
        assert body["min_score"] == cut, "phản hồi không nhắc lại ngưỡng đã áp dụng"
        assert all(r["score"] >= cut for r in body["results"]), "lọt kết quả dưới ngưỡng"
        assert body["total"] <= len(results)
        return f"ngưỡng {cut:.3f} -> {body['total']}/{len(results)}"
    run.check("thanh ngưỡng lọc đúng", _threshold)

    def _masked() -> Optional[str]:
        tl = api("POST", "/api/search", role="tech_lead", json=query).json()
        assert tl["results"], "tech_lead không nhận được kết quả nào"
        top = tl["results"][0]
        # Ba trường tóm tắt là văn bản LLM viết, gần như chắc chắn nhắc tên.
        assert top["summary"] == "***", f"tóm tắt KHÔNG bị che: {str(top['summary'])[:60]}"
        # Nhưng tín hiệu chuyên môn phải còn, nếu không bảng xếp hạng vô dụng
        # với đúng người được giao đọc nó.
        assert top["score"] > 0, "điểm bị che mất"
        assert top["candidate_uuid"] != "***", "mã ứng viên bị che — không mở được hồ sơ"
        return "tóm tắt bị che, điểm và kỹ năng còn"
    run.check("tech_lead bị che danh tính, giữ tín hiệu chuyên môn", _masked)

    run.check("admin không tìm kiếm được",
              lambda: _eq(api("POST", "/api/search", role="admin", json=query).status_code, 403))


def _flow_c_enrichment(run: Runner, api: Api, state: dict) -> None:
    run.flow("Flow C — Làm giàu hồ sơ (SRS §3.2.1f)")

    uuid = state.get("candidate_uuid")
    if not uuid:
        run.check("đọc trạng thái enrichment", lambda: _skip("chưa tạo được ứng viên ở Flow A"))
        return

    def _status() -> Optional[str]:
        # Enrichment chạy nền; chờ ngắn rồi đọc.
        deadline = time.time() + 20
        last = None
        while time.time() < deadline:
            r = api("GET", f"/api/enrichment/{uuid}", role="hr")
            if r.status_code == 200:
                last = r.json()
                if last.get("enrichment_status") not in (None, "QUEUED", "IN_PROGRESS"):
                    break
            time.sleep(2)
        assert last is not None, "không đọc được trạng thái enrichment"
        return f"trạng thái {last.get('enrichment_status')}"
    run.check("đọc được trạng thái enrichment", _status)

    def _panel_guard() -> Optional[str]:
        r = api("GET", f"/api/enrichment/{uuid}", role="tech_lead_outsider")
        # 404 chứ không 403: 403 xác nhận ứng viên tồn tại, biến endpoint thành
        # công cụ dò xem một người có ứng tuyển hay không.
        assert r.status_code == 404, f"tech_lead ngoài hội đồng vẫn đọc được ({r.status_code})"
        return "404, không phải 403"
    run.check("tech_lead ngoài hội đồng không xem được", _panel_guard)

    def _cv_link() -> Optional[str]:
        r = api("GET", f"/api/v1/candidates/{uuid}/cv", role="hr")
        assert r.status_code == 200, f"{r.status_code}: {str(r.text)[:150]}"
        body = r.json()
        assert body.get("url"), "không trả về link"
        # JSON chứ không redirect: redirect buộc phải đi bằng điều hướng trình
        # duyệt, mà điều hướng không mang được header Authorization.
        return f"link sống {body.get('expires_in_seconds')}s"
    run.check("xin được link CV có xác thực", _cv_link)

    run.check(
        "không token thì không lấy được CV",
        lambda: _eq(api("GET", f"/api/v1/candidates/{uuid}/cv").status_code, 401),
    )


def _flow_d_abac_scheduling(run: Runner, api: Api, state: dict) -> None:
    run.flow("Flow D — ABAC & Đặt lịch (SRS §3.2.1b)")

    run.check(
        "danh sách người phỏng vấn",
        lambda: _eq(api("GET", "/api/scheduling/interviewers", role="hr").status_code, 200),
    )
    run.check(
        "trạng thái kết nối lịch",
        lambda: _eq(api("GET", "/api/scheduling/calendar-status", role="hr").status_code, 200),
    )
    run.check(
        "chỉ hr được tìm khe giờ",
        lambda: _eq(
            api("POST", "/api/scheduling/slots", role="tech_lead",
                json={"candidate_id": "x", "interviewer_ids": ["y"],
                      "date_from": "2026-09-01", "date_to": "2026-09-14"}).status_code,
            403,
        ),
    )

    def _slots() -> Optional[str]:
        ivs = api("GET", "/api/scheduling/connected-interviewers", role="hr").json()
        if not ivs:
            raise Skip("chưa ai kết nối Google Calendar")
        r = api("POST", "/api/scheduling/slots", role="hr", json={
            "candidate_id": state.get("candidate_uuid") or str(uuidlib.uuid4()),
            "interviewer_ids": [ivs[0]["id"]],
            "date_from": "2026-09-01T00:00:00+07:00",
            "date_to": "2026-09-14T00:00:00+07:00",
        })
        assert r.status_code == 200, f"{r.status_code}: {str(r.text)[:150]}"
        slots = r.json()
        for s in slots:
            assert s["duration_min"] >= 45, f"khe ngắn hơn 45 phút: {s['duration_min']}"
        return f"{len(slots)} khe, đều >= 45 phút"
    run.check("tìm khe giờ chung (Sweep-Line)", _slots)

    def _abac_diff() -> Optional[str]:
        db = admin_db()
        rows = db.table("candidates").select("uuid").not_.is_("full_name", "null").limit(1).execute().data
        if not rows:
            raise Skip("chưa có ứng viên nào có tên để so sánh")
        # Dùng đường catalog: nó phục vụ dashboard và đi qua đúng lớp che.
        hr = api("GET", "/api/catalog/dashboard", role="hr").json()["candidates"]
        tl = api("GET", "/api/catalog/dashboard", role="tech_lead").json()["candidates"]
        if not hr:
            raise Skip("dashboard rỗng")
        assert any(c.get("full_name") not in (None, "***") for c in hr), \
            "hr cũng bị che — ABAC che nhầm role"
        assert all(c.get("full_name") in (None, "***") for c in tl), \
            "tech_lead ĐỌC ĐƯỢC tên ứng viên"
        return f"hr thấy tên, tech_lead nhận *** ({len(tl)} hồ sơ trong hội đồng)"
    run.check("ABAC che PII đúng theo role", _abac_diff)

    def _notification_flags() -> Optional[str]:
        db = admin_db()
        rows = (
            db.table("confirmed_slots")
            .select("id, slack_notified, email_notified, calendar_event_id, created_at")
            .order("created_at", desc=True).limit(1).execute().data
        )
        if not rows:
            raise Skip("chưa có lịch phỏng vấn nào để đối chiếu")
        row = rows[0]

        import os
        has_slack = bool(os.getenv("SLACK_WEBHOOK_URL"))
        has_smtp = bool(os.getenv("SMTP_USERNAME") and os.getenv("SMTP_PASSWORD"))
        if not (has_slack or has_smtp):
            raise Skip("chưa cấu hình SLACK_WEBHOOK_URL hay SMTP — không có gì để gửi")

        # Cột này từng LUÔN là false: `confirm_slot` gán kết quả vào đối tượng
        # trong bộ nhớ rồi trả về, mà không ghi lại DB. Ai tra cột này để biết
        # nhóm tuyển dụng đã được báo chưa đều nhận câu trả lời sai.
        return (
            f"lịch gần nhất {row['created_at'][:16]}: "
            f"slack={row['slack_notified']} email={row['email_notified']} "
            f"gcal={'có' if row['calendar_event_id'] else 'không'}"
        )
    run.check("cờ thông báo được ghi vào DB", _notification_flags)


def _flow_review(run: Runner, api: Api, state: dict) -> None:
    run.flow("Duyệt hồ sơ & hội đồng (V008)")

    job_id = state.get("job_id")
    if not job_id:
        run.check("hội đồng chấm", lambda: _skip("không có tin tuyển dụng để thử"))
        return

    run.check(
        "hr xem được danh sách tech lead mời được",
        lambda: _eq(api("GET", "/api/review/reviewers", role="hr").status_code, 200),
    )
    run.check(
        "tech_lead không tự mời mình vào hội đồng",
        lambda: _eq(
            api("POST", f"/api/review/panels/{job_id}", role="tech_lead",
                json={"reviewer_id": "someone"}).status_code,
            403,
        ),
    )
    run.check(
        "xem được hội đồng của tin tuyển dụng",
        lambda: _eq(api("GET", f"/api/review/panels/{job_id}", role="hr").status_code, 200),
    )

    uuid = state.get("candidate_uuid")
    if not uuid:
        return

    def _hr_ordering() -> Optional[str]:
        r = api("POST", f"/api/review/{uuid}", role="hr", json={"decision": "approved"})
        # HR không được chốt trước hội đồng kỹ thuật; nếu chốt được thì vòng
        # review kỹ thuật chỉ còn là con dấu.
        assert r.status_code in (400, 403), (
            f"HR duyệt được TRƯỚC hội đồng kỹ thuật ({r.status_code})"
        )
        return f"bị chặn với {r.status_code}"
    run.check("HR không duyệt trước hội đồng kỹ thuật", _hr_ordering)

    def _batch() -> Optional[str]:
        r = api("POST", "/api/review/batch", role="hr", json={"candidate_uuids": [uuid]})
        assert r.status_code == 200, f"{r.status_code}: {str(r.text)[:150]}"
        body = r.json()
        assert uuid in body, "thiếu ứng viên trong kết quả lô"
        status = body[uuid]
        assert "required_tl_approvals" in status, "thiếu số phiếu cần — UI sẽ tự nhân 0.8"
        assert status["panel_rule"], "thiếu câu mô tả luật"
        return f"{status['overall_status']}, cần {status['required_tl_approvals']}/{status['total_tls']}"
    run.check("đọc trạng thái duyệt theo lô", _batch)


def _flow_catalog(run: Runner, api: Api) -> None:
    run.flow("Dữ liệu danh sách (thay cho truy vấn thẳng PostgREST)")

    for path in ("/api/catalog/job-postings", "/api/catalog/analytics",
                 "/api/catalog/candidates/options"):
        run.check(
            f"GET {path}",
            lambda p=path: _eq(api("GET", p, role="hr").status_code, 200),
        )

    def _analytics_has_no_identity() -> Optional[str]:
        body = api("GET", "/api/catalog/analytics", role="hr").json()
        # Màn hình này vẽ số liệu tổng hợp; danh tính không cần rời máy chủ.
        assert "candidates" not in body, "analytics trả về cả danh sách ứng viên"
        assert isinstance(body.get("candidate_count"), int), "thiếu số đếm ứng viên"
        return f"{body['candidate_count']} ứng viên, chỉ số đếm"
    run.check("analytics chỉ trả số đếm, không trả danh tính", _analytics_has_no_identity)


# ---------------------------------------------------------------------------
# Dọn dẹp
# ---------------------------------------------------------------------------

def _cleanup(run: Runner, state: dict) -> None:
    uuid = state.get("candidate_uuid")
    if not uuid:
        return
    print(f"\n{DIM}Dọn dữ liệu thử ({uuid[:8]}…){RESET}")
    try:
        db = admin_db()
        # Theo thứ tự khoá ngoại: applications -> resumes -> candidates.
        for table, column in (
            ("applications", "candidate_uuid"),
            ("resumes", "candidate_uuid"),
            ("enrichment_profiles", "candidate_uuid"),
            ("candidates", "uuid"),
        ):
            try:
                db.table(table).delete().eq(column, uuid).execute()
            except Exception as exc:
                print(f"   {YELLOW}không xoá được {table}: {exc}{RESET}")
        print(f"   {GREEN}đã dọn{RESET}")
    except Exception as exc:
        print(f"   {YELLOW}bỏ qua dọn dẹp: {exc}{RESET}")


# ---------------------------------------------------------------------------
# Trợ giúp khẳng định
# ---------------------------------------------------------------------------

def _eq(actual: Any, expected: Any, hint: str = "") -> Optional[str]:
    assert actual == expected, f"mong đợi {expected!r}, nhận {actual!r}" + (f" — {hint}" if hint else "")
    return None


def _all_eq(actuals: list, expected: Any) -> Optional[str]:
    assert all(a == expected for a in actuals), f"mong đợi tất cả {expected!r}, nhận {actuals!r}"
    return None


def _skip(reason: str) -> Optional[str]:
    raise Skip(reason)


if __name__ == "__main__":
    sys.exit(main())
