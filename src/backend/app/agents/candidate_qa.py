"""Hỏi đáp về MỘT ứng viên đang mở — chế độ thứ hai của chatbot.

Đồ thị agent hiện có là "đi tìm ứng viên": planner coi mọi câu nhắn là một
nhiệm vụ tìm người, nên "ứng viên này có gì nổi bật" bị hỏi ngược "bạn tuyển
vị trí nào" dù người dùng đang đứng trên trang của ứng viên đó. Ở đây: nạp hồ
sơ của đúng người đó (CV, làm giàu, trạng thái duyệt, tin nộp vào), che PII
theo role như mọi endpoint khác, rồi hỏi LLM một lượt có kèm lịch sử phiên.
Không planner, không retrieval — nhanh và không hỏi ngược.
"""
from __future__ import annotations

import json
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from modules.shared.infrastructure.abac import apply_abac

#: Giới hạn ký tự từng khối dữ liệu đưa vào prompt; CV dài vẫn đủ ý ở phần đầu.
MAX_CV_CHARS = 7000
MAX_JSON_CHARS = 5000
MAX_HISTORY_TURNS = 8


class HistoryTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=6000)


class CandidateAnswer(BaseModel):
    """Câu trả lời + 2–3 gợi ý câu hỏi tiếp theo (cùng ngôn ngữ)."""

    answer: str
    suggestions: list[str] = Field(default_factory=list, max_length=3)


def _first(value: Any) -> Optional[dict]:
    if isinstance(value, list):
        return value[0] if value else None
    return value if isinstance(value, dict) else None


def _clip(text: Any, limit: int) -> str:
    s = text if isinstance(text, str) else json.dumps(text, ensure_ascii=False, default=str)
    return s if len(s) <= limit else s[:limit] + " …[cắt bớt]"


def load_candidate_context(client, candidate_uuid: str, role: str) -> dict:
    """Mọi thứ hệ thống biết về ứng viên, ĐÃ che PII theo role.

    Che ở đây chứ không tin vào prompt: nói với LLM "đừng nhắc tên" là không
    đủ, tech lead vẫn có thể hỏi khéo. Dữ liệu tech lead không được thấy thì
    không được rời khỏi máy chủ, kể cả đi vào prompt.
    """
    cand = _first(
        client.table("candidates")
        # Cố ý KHÔNG lấy cột EEO (gender_identity, race, age_group, disability,
        # military) và pronouns: dữ liệu báo cáo tổng hợp, không được vào chỗ
        # ra quyết định. Tên cột phải khớp docs/supabase_schema.md —
        # test_agent_candidate_qa.py đối chiếu, vì sai cột chỉ lộ khi có người bấm.
        .select("uuid, full_name, email, phone, current_company, current_location, "
                "github_username, linkedin_url, portfolio_url, university, faculty_program, "
                "graduation_year, education_level, status")
        .eq("uuid", candidate_uuid).limit(1).execute().data
    ) or {}
    resume = _first(
        client.table("resumes").select("filename, text_content, created_at")
        .eq("candidate_uuid", candidate_uuid).order("created_at", desc=True).limit(1).execute().data
    ) or {}
    enrichment = _first(
        client.table("enrichment_profiles")
        .select("enrichment_status, match_confidence_score, score_increase, semantic_tags, "
                "skill_matrix, skills, summary, experience")
        .eq("candidate_uuid", candidate_uuid).limit(1).execute().data
    ) or {}
    github = _first(
        client.table("github_profiles").select("public_repos_count, top_languages, readme_content")
        .eq("candidate_uuid", candidate_uuid).limit(1).execute().data
    ) or {}
    application = _first(
        client.table("applications")
        .select("job_posting_id, status, expected_salary_min, expected_salary_max, "
                "work_mode_pref, availability_bucket, experience_bucket, skill_ratings, "
                "proudest_project, motivation_reason, work_style, cover_letter, created_at")
        .eq("candidate_uuid", candidate_uuid).order("created_at", desc=True).limit(1).execute().data
    ) or {}
    job = {}
    if application.get("job_posting_id"):
        job = _first(
            client.table("jobs_posting")
            .select("job_title, department, seniority_level, description, requirements, "
                    "key_responsibilities, must_have_skills, nice_to_have_skills")
            .eq("id", application["job_posting_id"]).limit(1).execute().data
        ) or {}

    context = {
        "candidate_uuid": candidate_uuid,
        "candidate": {k: v for k, v in cand.items() if k != "uuid"},
        # CV thô chứa tên/email/điện thoại: tech lead không được đọc nó.
        "cv_text": resume.get("text_content") if role == "hr" else None,
        "cv_filename": resume.get("filename") if role == "hr" else None,
        # `skill_matrix` (tên cột) -> `skills_matrix` (từ vựng whitelist ABAC).
        "enrichment": {("skills_matrix" if k == "skill_matrix" else k): v for k, v in enrichment.items()},
        "github": github,
        "application": {k: v for k, v in application.items() if k not in ("job_posting_id",)},
        "job_posting": job,
    }
    return mask_context(context, role)


def mask_context(context: dict, role: str) -> dict:
    """Che PII theo role, TỪNG KHỐI một.

    Whitelist ABAC so khớp theo tên field ở mọi độ sâu; áp lên cả cây thì
    chính các key bao ngoài ("candidate", "enrichment", "application") bị che
    thành {} và tech lead không còn gì để đọc. Tin tuyển dụng không phải dữ
    liệu ứng viên nên không che — tech lead vốn thấy nó trên trang tin.
    """
    masked = dict(context)
    for block in ("candidate", "enrichment", "github", "application"):
        masked[block] = apply_abac(context.get(block) or {}, role)
    if role != "hr":
        masked["cv_text"] = None
        masked["cv_filename"] = None
    return masked


def build_system_prompt(context: dict, lang: str) -> str:
    language = "Vietnamese" if lang == "vi" else "English"
    short = context.get("candidate_uuid", "")[:8]
    blocks = [
        f"CANDIDATE PROFILE (id #{short}):\n{_clip(context.get('candidate') or {}, MAX_JSON_CHARS)}",
        f"JOB POSTING THEY APPLIED TO:\n{_clip(context.get('job_posting') or {}, MAX_JSON_CHARS)}",
        f"APPLICATION ANSWERS:\n{_clip(context.get('application') or {}, MAX_JSON_CHARS)}",
        f"ENRICHMENT (AI analysis, skill matrix):\n{_clip(context.get('enrichment') or {}, MAX_JSON_CHARS)}",
        f"GITHUB:\n{_clip(context.get('github') or {}, MAX_JSON_CHARS)}",
    ]
    cv = context.get("cv_text")
    if isinstance(cv, str) and cv.strip() and cv != "***":
        blocks.append(f"CV TEXT:\n{_clip(cv, MAX_CV_CHARS)}")
    data = "\n\n".join(blocks)
    return (
        "You are SmartATS, a recruiting assistant. You are helping a recruiter or tech lead "
        f"evaluate ONE specific candidate (id #{short}) whose data is below.\n"
        "Rules:\n"
        "- Answer ONLY from the data provided. If something is not in the data, say so plainly; never invent.\n"
        "- Values shown as \"***\" are hidden from this user on purpose; refer to the person as "
        f"'Candidate #{short}' and never guess the hidden value.\n"
        f"- Answer in {language}, even if earlier turns were in another language. "
        "Be concise and concrete: short paragraphs or bullet points, cite the evidence "
        "(e.g. which CV line, which repo, which skill-matrix entry).\n"
        "- Then propose 2–3 short follow-up questions the user might ask next, in the same language.\n"
        "Return JSON: {\"answer\": string (markdown allowed), \"suggestions\": [string, ...]}.\n\n"
        f"DATA:\n{data}"
    )


def build_conversation(history: list[HistoryTurn], message: str) -> str:
    turns = history[-MAX_HISTORY_TURNS:]
    lines = [f"{'User' if t.role == 'user' else 'Assistant'}: {t.content}" for t in turns]
    lines.append(f"User: {message}")
    return "\n".join(lines)


def answer_about_candidate(
    *,
    llm,
    context: dict,
    lang: str,
    message: str,
    history: list[HistoryTurn],
) -> CandidateAnswer:
    """Một lượt LLM có cấu trúc. Đồng bộ — route gọi qua asyncio.to_thread."""
    result = llm.invoke(
        build_system_prompt(context, lang),
        build_conversation(history, message),
        response_model=CandidateAnswer,
        temperature=0.2,
    )
    if isinstance(result, CandidateAnswer):
        return result
    return CandidateAnswer.model_validate(result)
