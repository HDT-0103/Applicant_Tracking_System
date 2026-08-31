from pydantic import BaseModel
class GitHubProjectDTO(BaseModel):
    name: str
    language: str | None = None
    description: str | None = None
    topics: list[str] = []
    lexical_score: float