---
name: ai-governance-eval
description: Enterprise AI governance framework — prompt versioning, structured LLM outputs, retry/fallback strategies, token cost logging, hallucination prevention, and model independence for SmartATS
version: 2.0.0
author: SmartATS AI Engineering Team
tech_stack:
  - Google Gemini 2.0 Flash
  - Pydantic Output Parsers
  - Structlog Token Tracking
when_to_use:
  - "design or update LLM prompts for CV parsing or skill analysis"
  - "enforce structured JSON schema outputs from Gemini or OpenAI"
  - "implement retry strategies with exponential backoff for LLM/Scraper rate limits"
  - "log LLM token usage and estimated API cost"
  - "configure local non-LLM fallback strategies when AI APIs are down"
---

# Enterprise AI Governance, Evaluation & LLM Operations

## 1. Overview & Model Independence

SmartATS leverages Large Language Models (LLMs) like **Google Gemini 2.0 Flash** for CV extraction and candidate profile analysis. 

To maintain enterprise reliability, the AI architecture MUST remain **Model-Independent** (compatible with Gemini, OpenAI GPT-4o, Claude, or local Ollama models) and robust against API outages, rate limits, and hallucinations.

---

## 2. Prompt Versioning & Template Standards

All prompts MUST be versioned, template-driven, and stored systematically rather than inline as arbitrary string fragments.

### 1. Resume Entity Extraction Prompt (`ingestion_service.py`)
```python
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
```

### 2. LinkedIn Profile Markdown Parser Prompt (`gemini_parser_service.py`)
```python
SYSTEM_PROMPT = """You are an advanced data structuring system for SmartATS software.
Your task is to read the provided Markdown text from a LinkedIn profile and extract exactly one JSON object with the following structure:
{
  "experiences": [
    {
      "company": "Company Name",
      "title": "Job Title/Position",
      "starts_at": "Start Month/Year or date format",
      "ends_at": "End Month/Year or 'Present'",
      "description": "Detailed work description and achievements"
    }
  ],
  "educations": [
    {
      "school": "School Name",
      "degree": "Degree/Field of Study",
      "starts_at": "Start Year",
      "ends_at": "End Year"
    }
  ],
  "certifications": ["Names of obtained certifications"]
}
"""
```

---

## 3. Structured Output Enforcement

Always use Pydantic models or native `response_mime_type="application/json"` to guarantee deterministic parsing.

```python
class ParsedResumeDTO(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    github_username: Optional[str] = None
    linkedin_url: Optional[str] = None

# Validate raw LLM json output
try:
    parsed_data = ParsedResumeDTO.model_validate_json(raw_llm_response)
except ValidationError as exc:
    logger.error("ai.parsing.validation_error", error=str(exc))
    # Trigger fallback strategy
```

---

## 4. Resilience: Retry & Fallback Architecture

```
[Resume PDF / Profile Text] ──► Primary LLM (Gemini 2.0 Flash) ──(Success)──► Structured Profile
                                      │
                                    (429 / 5xx Error or Timeout)
                                      ▼
                              Retry with Exponential Backoff (3 attempts: 2s, 4s, 8s)
                                      │
                                    (Failed 3x or Quota Exceeded)
                                      ▼
                              Local Rule-Based Keyword Parser (analyze_github_local_fallback)
                                      │
                                      ▼
                              Frontend `FallbackDataWizard.tsx` (Manual Review UI)
```

### Exponential Backoff Implementation (`linkedin_scraper.py`)
- Attempt 1: Immediate call.
- Attempt 2: Wait `(2^1) * 2s = 4s`.
- Attempt 3: Wait `(2^2) * 2s = 8s`.

---

## 5. Token Usage Logging & Cost Tracking

All LLM calls MUST log token consumption and estimated cost or structured logs:

```python
def log_llm_usage(
    user_id: str,
    model_name: str,
    prompt_tokens: int,
    completion_tokens: int,
    operation_type: str
):
    total_tokens = prompt_tokens + completion_tokens
    # Gemini 2.0 Flash cost estimation
    estimated_cost = (prompt_tokens * 0.0000001) + (completion_tokens * 0.0000004)
    
    logger.info(
        "llm.usage.logged",
        user_id=user_id,
        model_name=model_name,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        estimated_cost=estimated_cost,
        operation_type=operation_type
    )
```

---

## 6. AI Agent Guidelines for AI/LLM Code

### When Should AI Load This Skill?
Load this skill when editing `gemini_parser_service.py`, `ingestion_service.py`, creating new prompt templates, implementing AI retries, or tuning LLM parsers.

### Best Practices:
- **Never trust raw LLM output without Pydantic validation**.
- **Always provide a non-LLM fallback** (`analyze_github_local_fallback`) so the ATS can operate during cloud API outages.
- **Isolate prompt templates** into dedicated files or versioned constants.
- **Pass system instructions separately** from user input text to prevent prompt injection.

