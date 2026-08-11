import uuid

from backend.app.repositories.embedding_repository import ResumeEmbeddingRepository
from src.backend.app.schemas.requirement_analysis import RequirementAnalysis
from src.backend.app.services.llm_provider import GroqProvider
from src.backend.app.services.llm_service import LLMService
from src.backend.app.services.embedding_service import EmbeddingService
from src.backend.app.services.parser_service import ParserService
from src.backend.app.schemas.resume_analysis import ResumeAnalysis
from backend.app.repositories.enrichment_repository import ResumeAnalysisRepository
from src.backend.app.repositories.resume_repository import ResumeRepository
from src.backend.app.models import Resume, ResumeAnalysis, ResumeEmbedding
from sqlalchemy.ext.asyncio import AsyncSession

class ResumePipeline:
    def __init__(self):
        self.parser_service = ParserService()
        self.llm_service = LLMService(provider=GroqProvider()) 
        self.embedding_service = EmbeddingService()
    
    # chỗ này sẽ nhận id của Job Posting
    async def process(self, file_path: str, user_id: int, job_posting_id: uuid.UUID, session: AsyncSession) -> ResumeAnalysis:
        resume_repo = ResumeRepository(session)
        analysis_repo = ResumeAnalysisRepository(session)
        embedding_repo = ResumeEmbeddingRepository(session)
        
        # RESUME ANALYSIS PIPELINE
        # Step 1: Parse the resume file
        parsed_text = self.parser_service.process(file_path)
        # Step 2: Analyze the parsed text using LLM
        analysis = self.llm_service.analyze_resume(parsed_text)
        # Step 3: Summarize the resume
        summary = self.llm_service.summarize_resume(analysis)
        # Step 4: Extract skills from the resume
        skills = self.llm_service.extract_skills(analysis)
        # Step 5: Extract experience from the resume
        experience = self.llm_service.extract_experience(analysis)
        # Step 6: Extract strengths and weaknesses from the resume
        strengths = self.llm_service.extract_strengths(analysis)
        # Step 7: Extract weaknesses from the resume
        weaknesses = self.llm_service.extract_weaknesses(analysis)
        # Step 8: Take information from GitHub and LinkedIn if available (this step is optional and depends on the availability of such data)
        # Step 9: Create a ResumeAnalysis object to store the results
        