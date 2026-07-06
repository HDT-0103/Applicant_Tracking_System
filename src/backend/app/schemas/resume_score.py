from pydantic import BaseModel


class ResumeScore(BaseModel):

    summary_score: float

    skills_score: float

    experience_score: float

    final_score: float