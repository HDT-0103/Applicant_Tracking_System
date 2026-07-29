from pydantic import BaseModel

class RequirementEmbedding(BaseModel):
    summary_embedding: list[float]

    skills_embedding: list[float]

    experience_embedding: list[float]