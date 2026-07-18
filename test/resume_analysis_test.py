from src.backend.app.services.llm_provider import GroqProvider
from src.backend.app.services.llm_service import LLMService
from src.backend.app.services.parser_service import ParserService
from src.backend.app.pipelines.resumeUploading_pipeline import ResumePipeline

parser = ParserService()

provider = GroqProvider()

llm = LLMService(provider)

pipeline = ResumePipeline()

result = pipeline.process(
    "resume.pdf"
)

print(result)