from backend.app.repositories.resume_embedding_repository import ResumeEmbeddingRepository
from backend.app.schemas.requirement_analysis import RequirementAnalysis
from backend.app.services.llm_provider import GroqProvider
from backend.app.services.llm_service import LLMService
from backend.app.services.embedding_service import EmbeddingService
from backend.app.services.parser_service import ParserService
from backend.app.schemas.resume_analysis import ResumeAnalysis as ResumeAnalysisSchema
from backend.app.repositories.resume_analysis_repository import ResumeAnalysisRepository
from backend.app.repositories.resume_repository import ResumeRepository
from backend.app.models import Resume, ResumeAnalysis as ResumeAnalysisModel, ResumeEmbedding as ResumeEmbeddingModel
from sqlalchemy.ext.asyncio import AsyncSession

class ResumePipeline:
    def __init__(self):
        self.parser_service = ParserService()
        self.llm_service = LLMService(provider=GroqProvider()) 
        self.embedding_service = EmbeddingService()
        
    async def process(self, file_path: str, user_id: int, session: AsyncSession) -> ResumeAnalysisSchema:
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
        analysis_schema = ResumeAnalysisSchema(
            summary=summary,
            skills=skills,
            strengths=strengths,
            weaknesses=weaknesses,
            experience=experience,
)
        # Step 8: Generate embeddings for the resume
        embeddings = self.embedding_service.embed_resume(analysis)
        
        async with session.begin_nested(): # Tạo một sub-transaction
            # Lưu Resume trước để lấy ID
            new_resume = await resume_repo.create_resume(user_id, parsed_text, file_path)
            await session.flush() # Bắt buộc flush để có new_resume.id

            # Lưu Analysis
            analysis_model = ResumeAnalysisModel(
                resume_id=new_resume.id,
                model_name="groq",
                summary=summary,
                skills=skills,
                strengths=strengths,
                weaknesses=weaknesses,
                experience=experience,
            )
            session.add(analysis_model)

            # Lưu Embedding
            embedding_model = ResumeEmbeddingModel(
                resume_id=new_resume.id,
                summary_embedding=embeddings.summary_embedding,
                skills_embedding=embeddings.skills_embedding,
                experience_embedding=embeddings.experience_embedding,
                model_name="intfloat/multilingual-e5-base",
            )
            session.add(embedding_model)
        await session.commit()
        return new_resume
    
    def process_batch(self, file_paths: list[str], session: AsyncSession) -> list[ResumeAnalysisSchema]:
        results = []
        for file_path in file_paths:
            result = self.process(file_path, session)
            results.append(result)
        return results
    
    def process_requirement(self, requirement_text, session: AsyncSession) -> RequirementAnalysis:
        # Logic to process the requirement text
        # Step 1: Analyze the requirement text using LLM
        analysis = self.llm_service.analyze_requirement(requirement_text)
        # Step 2: Summarize the requirement
        summary = self.llm_service.summarize_requirement(analysis)
        # Step 3: Extract skills from the requirement
        skills = self.llm_service.extract_skills(analysis)
        # Step 4: Extract experience from the requirement
        experience = self.llm_service.extract_experience(analysis)
        # Return the results
        return RequirementAnalysis(
            summary=summary,
            skills=skills,
            experience=experience
        )