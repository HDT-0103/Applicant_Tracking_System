from backend.app.services.llm_provider import GroqProvider
from backend.app.services.llm_service import LLMService
from backend.app.services.parser_service import ParserService
from backend.app.pipelines.resume_pipeline import ResumePipeline

parser = ParserService()

provider = GroqProvider()

llm = LLMService(provider)

pipeline = ResumePipeline()

result = pipeline.process(
    "resume.pdf"
)

print(result)