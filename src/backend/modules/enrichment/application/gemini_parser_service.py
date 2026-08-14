import json
import structlog

try:
    import google.genai as genai
except ImportError:
    import google.generativeai as genai

from modules.shared.infrastructure.config import Settings

logger = structlog.get_logger(__name__)


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


class GeminiParserService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client = None
        self.model = None
        if hasattr(genai, 'Client'):
            self.client = genai.Client(api_key=settings.gemini_api_key)
        else:
            genai.configure(api_key=settings.gemini_api_key)
            self.model = genai.GenerativeModel(
                "gemini-2.0-flash",
                system_instruction=SYSTEM_PROMPT,
            )

    async def parse_markdown(self, markdown_text: str) -> dict | None:
        if not self.settings.gemini_api_key:
            logger.warning("gemini.api_key.missing")
            return None

        try:
            logger.info("gemini.parser.start", markdown_length=len(markdown_text))

            if self.client:
                response = await self.client.aio.generate_content(
                    model="gemini-2.0-flash",
                    contents=markdown_text,
                    config={
                        "response_mime_type": "application/json",
                        "system_instruction": SYSTEM_PROMPT
                    }
                )
                raw = response.text.strip()
            else:
                response = await self.model.generate_content_async(
                    markdown_text,
                    generation_config={
                        "response_mime_type": "application/json",
                    },
                )
                raw = response.text.strip()

            if raw.startswith("```json"):
                raw = raw.removeprefix("```json").removesuffix("```").strip()
            elif raw.startswith("```"):
                raw = raw.removeprefix("```").removesuffix("```").strip()

            parsed = json.loads(raw)

            if not isinstance(parsed, dict):
                logger.error("gemini.parser.not_dict", type=type(parsed).__name__)
                return None

            logger.info("gemini.parser.success", experiences=len(parsed.get("experiences", [])),
                        educations=len(parsed.get("educations", [])))
            return parsed

        except json.JSONDecodeError as e:
            logger.error("gemini.parser.json_error", error=str(e), raw_preview=raw[:500])
            return None
        except Exception as e:
            logger.error("gemini.parser.error", error=str(e))
            return None
