from backend.app.services.llm_provider import GroqProvider
from backend.app.services.llm_service import LLMService
from backend.app.services.parser_service import ParserService
from backend.app.pipelines.semantic_pipeline import SemanticPipeline

parser = ParserService()

provider = GroqProvider()

llm = LLMService(provider)

pipeline = SemanticPipeline()

result = pipeline.process(
    "resume.pdf"
)

print(result)