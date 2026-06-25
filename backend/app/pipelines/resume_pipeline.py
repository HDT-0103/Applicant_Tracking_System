from backend.app.services.llm_provider import GroqProvider
from backend.app.services.llm_service import LLMService
from backend.app.services.parser_service import ParserService

class ResumePipeline:
    def __init__(self):
        self.parser_service = ParserService()
        self.llm_service = LLMService(provider=GroqProvider()) 

    def process(self, file_path: str):
        # Logic to process the resume file
        # Step 1: Parse the resume file
        parsed_text = self.parser_service.process(file_path)
        # Step 2: Analyze the parsed text using LLM
        analysis = self.llm_service.analyze_resume(parsed_text)
        # Step 3: Summarize the resume
        summary = self.llm_service.summarize_resume(analysis)
        # Step 4: Extract skills from the resume
        skills = self.llm_service.extract_skills(analysis)
        # Return the results
        return {
            "parsed_text": parsed_text,
            "analysis": analysis.model_dump(),
            "summary": summary,
            "skills": skills
        }
        