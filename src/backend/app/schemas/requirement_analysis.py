from pydantic import BaseModel

class RequirementAnalysis(BaseModel):
    summary: str
    skills: list[str]
    experience: list[str]