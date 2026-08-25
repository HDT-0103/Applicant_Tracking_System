import json
import structlog
from typing import Optional

import pypdf
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

from modules.shared.infrastructure.config import Settings
from modules.ingestion.domain.models import CandidateRecord
from modules.ingestion.domain.candidate_repository import save_candidate

logger = structlog.get_logger(__name__)

CV_PARSE_PROMPT = """Bạn là hệ thống trích xuất thông tin ứng viên từ CV (Resume) cho phần mềm SmartATS.

Dưới đây là nội dung CV dạng văn bản. Hãy phân tích và trả về JSON duy nhất với cấu trúc sau:

{
  "full_name": "Họ tên đầy đủ của ứng viên",
  "github_username": "GitHub username nếu có trong CV (ví dụ: octocat), nếu không có thì để null",
  "linkedin_url": "LinkedIn profile URL nếu có trong CV (ví dụ: https://linkedin.com/in/username), nếu không có thì để null",
  "email": "Email nếu có",
  "phone": "Số điện thoại nếu có"
}

Chỉ trả về JSON, không thêm giải thích hay markdown."""


def _extract_embedded_links(page: pypdf._page.PageObject) -> list[str]:
    """Extract hidden hyperlink URLs from PDF annotations (/Annots -> /Link -> /A -> /URI)."""
    urls: list[str] = []
    try:
        annots = page.get("/Annots")
        if not annots:
            return urls
        for ref in annots:
            try:
                annot = ref.get_object()
                if annot.get("/Subtype") != "/Link":
                    continue
                action = annot.get("/A")
                if action and "/URI" in action:
                    url = str(action["/URI"]).strip()
                    if url:
                        urls.append(url)
            except Exception:
                continue
    except Exception:
        pass
    return urls


def extract_text_and_links_from_pdf(pdf_path: str) -> tuple[str | None, list[str]]:
    try:
        reader = pypdf.PdfReader(pdf_path)
        pages = []
        all_links = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages.append(text)
            embedded = _extract_embedded_links(page)
            if embedded:
                pages.append("--- EMBEDDED SOCIAL LINKS ---")
                pages.extend(embedded)
                all_links.extend(embedded)
        full_text = "\n\n".join(pages) if pages else None
        logger.info("ingestion.pdf.extracted", path=pdf_path, chars=len(full_text) if full_text else 0, embedded_links=len(all_links))
        return full_text, all_links
    except Exception as e:
        logger.error("ingestion.pdf.extract_failed", error=str(e), path=pdf_path)
        return None, []


def parse_github_and_linkedin_from_links(links: list[str]) -> tuple[str | None, str | None]:
    github_username = None
    linkedin_url = None
    
    for link in links:
        # Parse GitHub URL to get username
        if "github.com" in link:
            try:
                # Remove trailing slashes, split by /
                parts = link.rstrip("/").split("/")
                # Find the part after github.com - should be username
                if len(parts) >= 2:
                    for i, part in enumerate(parts):
                        if part in ("github.com", "www.github.com") and i + 1 < len(parts):
                            candidate = parts[i+1]
                            # Skip if it's "orgs" or "sponsors" etc.
                            if candidate and candidate not in ("orgs", "sponsors", "features", "marketplace", "about", "contact", "pricing", "login", "signup"):
                                github_username = candidate
                                break
            except Exception as e:
                logger.warning("ingestion.parse.github_failed", url=link, error=str(e))
        
        # Keep LinkedIn URL as-is
        if "linkedin.com" in link:
            linkedin_url = link
    
    return github_username, linkedin_url


def _clean(value) -> str | None:
    """Gemini can answer with null, "null" or an empty string — all mean 'absent'."""
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    if not stripped or stripped.lower() in {"null", "none", "n/a"}:
        return None
    return stripped


async def parse_cv_with_gemini(resume_text: str, settings: Settings) -> dict | None:
    if not settings.gemini_api_key:
        logger.warning("ingestion.gemini.api_key_missing")
        return None

    try:
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(
            settings.gemini_model,
            generation_config={
                "response_mime_type": "application/json",
                "temperature": 0.1,
            },
            safety_settings={
                HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
            },
        )

        logger.info("ingestion.gemini.parse.start", resume_length=len(resume_text))
        response = await model.generate_content_async(
            f"{CV_PARSE_PROMPT}\n\n--- CV TEXT ---\n{resume_text}"
        )

        raw = response.text.strip()
        if raw.startswith("```json"):
            raw = raw.removeprefix("```json").removesuffix("```").strip()
        elif raw.startswith("```"):
            raw = raw.removeprefix("```").removesuffix("```").strip()

        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            logger.error("ingestion.gemini.parse.not_dict", type=type(parsed).__name__)
            return None

        logger.info(
            "ingestion.gemini.parse.success",
            full_name=parsed.get("full_name"),
            github_username=parsed.get("github_username"),
            linkedin_url=parsed.get("linkedin_url"),
        )
        return parsed

    except json.JSONDecodeError as e:
        logger.error("ingestion.gemini.parse.json_error", error=str(e), raw_preview=raw[:500])
        return None
    except Exception as e:
        logger.error("ingestion.gemini.parse.error", error=str(e))
        return None


async def process_cv_resume(
    candidate_uuid: str,
    pdf_path: str,
    settings: Settings,
    cv_file_path: Optional[str] = None,
    full_name: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    linkedin_url: Optional[str] = None,
    github_username: Optional[str] = None,
    job_id: Optional[str] = None,
) -> CandidateRecord:
    logger.info("ingestion.process.start", uuid=candidate_uuid, path=pdf_path, cv_file_path=cv_file_path)

    resume_text, embedded_links = extract_text_and_links_from_pdf(pdf_path)

    # Use form fields if provided, otherwise parse from PDF
    parsed_github_username, parsed_linkedin_url = parse_github_and_linkedin_from_links(embedded_links)
    
    # Prioritize form fields over parsed values
    if not github_username:
        github_username = parsed_github_username
    if not linkedin_url:
        linkedin_url = parsed_linkedin_url
    
    # The public application form deliberately does not ask for name/email/phone —
    # they are read off the CV instead. Anything a caller did supply still wins;
    # the LLM only fills the gaps. A failure here (quota, bad JSON) returns None
    # and the application still goes through.
    if resume_text and not (full_name and email and phone):
        parsed = await parse_cv_with_gemini(resume_text, settings)
        if parsed:
            full_name = full_name or _clean(parsed.get("full_name"))
            email = email or _clean(parsed.get("email"))
            phone = phone or _clean(parsed.get("phone"))
            github_username = github_username or _clean(parsed.get("github_username"))
            linkedin_url = linkedin_url or _clean(parsed.get("linkedin_url"))

    if not (full_name and email):
        logger.warning(
            "ingestion.contact_details_incomplete",
            uuid=candidate_uuid,
            has_full_name=bool(full_name),
            has_email=bool(email),
            has_phone=bool(phone),
        )

    candidate = CandidateRecord(
        uuid=candidate_uuid,
        full_name=full_name,
        email=email,
        phone=phone,
        github_username=github_username,
        linkedin_url=linkedin_url,
        resume_text=resume_text,
        cv_file_path=cv_file_path,  # Azure Blob Storage URL
        job_id=job_id,
        status="PARSED" if github_username or linkedin_url else "CREATED",
    )

    save_candidate(candidate)

    logger.info(
        "ingestion.process.complete",
        uuid=candidate.uuid,
        full_name=candidate.full_name,
        github_username=candidate.github_username,
        linkedin_url=candidate.linkedin_url,
        cv_file_path=candidate.cv_file_path,
        status=candidate.status,
    )

    return candidate
