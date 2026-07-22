# Gemini Prompt Templates for SmartATS

## Overview

SmartATS uses **Google Gemini 2.0 Flash** for resume parsing and AI analysis (not LangChain directly). The prompts are sent via HTTP POST to the Gemini API in `modules/enrichment/application/gemini_parser_service.py`.

## Resume Parsing Prompt

### Actual Implementation (`gemini_parser_service.py`)

```python
import httpx

GEMINI_PARSE_PROMPT = """You are an expert HR recruiter and resume parser. 
Extract structured information from this CV PDF content.

Return STRICT JSON (no markdown, no code fences) with these fields:
{
  "full_name": "...",
  "email": "...",
  "phone": "...",
  "skills": ["skill1", "skill2", ...],
  "experience": [
    {
      "title": "...",
      "company": "...",
      "start_date": "...",
      "end_date": "...",
      "description": "..."
    }
  ],
  "education": [
    {
      "degree": "...",
      "institution": "...",
      "graduation_year": "..."
    }
  ],
  "projects": [
    {
      "name": "...",
      "description": "...",
      "technologies": ["..."]
    }
  ],
  "languages": ["..."],
  "certifications": ["..."],
  "seniority_level": "Junior|Mid-level|Senior|Lead|Principal",
  "total_years_experience": 0
}

Rules:
1. Return ONLY valid JSON, no markdown formatting
2. If a field is not found, use null or empty array
3. Extract skills from both explicit sections and project descriptions
4. Calculate seniority based on experience depth and role progression
5. Include all technical mentions, even if brief
"""

async def call_gemini_parse(api_key: str, model: str, pdf_text: str) -> dict:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload = {
        "contents": [{
            "parts": [{"text": GEMINI_PARSE_PROMPT + "\n\n---\n" + pdf_text[:30000]}]
        }],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 4096
        }
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=payload, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(text.strip().removeprefix("```json").removesuffix("```").strip())
```

## Skill Analysis Prompt (Local Fallback)

When Gemini fails, the system uses keyword-based scoring defined in `enrichment_service.py`:

```python
SKILL_GROUPS = {
    "frontend_development": {"keywords": ["react", "nextjs", "typescript", ...], "score": 0},
    "backend_development":  {"keywords": ["python", "golang", "java", ...], "score": 0},
    "devops_cloud":         {"keywords": ["docker", "kubernetes", "aws", ...], "score": 0},
    "infosec":              {"keywords": ["security", "oauth", "jwt", ...], "score": 0},
    "data_ai":              {"keywords": ["pytorch", "tensorflow", "pandas", ...], "score": 0},
}
```

Score formula: `25 + (keyword_hits × 12) + (language_bias_pct × 0.35)`

## Best Practices for Prompting Gemini

1. **Temperature**: Use `0.0-0.1` for parsing (deterministic), `0.3-0.5` for analysis
2. **Max tokens**: 4096 for CV parsing; adjust based on resume length
3. **Chunking**: Truncate PDF text to ~30,000 chars (Gemini 2.0 Flash context window)
4. **JSON cleaning**: Strip markdown code fences from Gemini output before `json.loads()`
5. **Retry**: Implement exponential backoff on 429/5xx errors (3 retries, 2s base delay)
6. **Fallback**: If Gemini fails, surface `FallbackDataWizard` UI for manual entry

## Cost Considerations

| Model | Input (per 1K tokens) | Output (per 1K tokens) | Context |
|-------|----------------------|-----------------------|---------|
| Gemini 2.0 Flash | $0.10 | $0.40 | 1M tokens |
| GPT-4o-mini (fallback) | $0.15 | $0.60 | 128K tokens |

**Tips**:
- Use Gemini 2.0 Flash for parsing (cheaper, faster)
- Resend only when parsing confidence is low
- Cache parsed results by PDF content hash to avoid re-processing
