from backend.app.schemas.requirement_analysis import RequirementAnalysis
from backend.app.services.llm_provider import GroqProvider
from backend.app.services.llm_service import LLMService
from backend.app.services.parser_service import ParserService
from backend.app.schemas.resume_analysis import ResumeAnalysis
class SemanticPipeline:
    def __init__(self):
        self.parser_service = ParserService()
        self.llm_service = LLMService(provider=GroqProvider()) 

    def process(self, file_path: str) -> ResumeAnalysis:
        # Logic to process the resume file
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
        # Return the results
        return ResumeAnalysis(
            summary=summary,
            skills=skills,
            strengths=strengths,
            weaknesses=weaknesses,
            experience=experience
        )
    
    def process_batch(self, file_paths: list[str]) -> list[ResumeAnalysis]:
        results = []
        for file_path in file_paths:
            result = self.process(file_path)
            results.append(result)
        return results
    
    def process_requirement(self, requirement_text) -> RequirementAnalysis:
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