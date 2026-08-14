from sentence_transformers import SentenceTransformer

from src.backend.app.schemas.resume_analysis import ResumeAnalysis
from src.backend.app.schemas.requirement_analysis import RequirementAnalysis

from src.backend.app.schemas.resume_embedding import ResumeEmbedding
from src.backend.app.schemas.requirement_embedding import RequirementEmbedding
class EmbeddingService:
    def __init__(self, model_name = 'intfloat/multilingual-e5-base'):
        self.model_name = model_name
        self.model = SentenceTransformer(model_name)
        
    def embed_text(
        self,
        text: str
    ) -> list[float]:

        embedding = self.model.encode(
            text
        )

        return embedding.tolist()
    
    def embed_resume(
        self,
        analysis: ResumeAnalysis
    ) -> ResumeEmbedding:

        skills_text = " ".join(
            analysis.skills
        )

        experience_text = " ".join(
            exp["description"]
            for exp in analysis.experience
        )

        summary_embedding = self.embed_text(
            f"passage: {analysis.summary}"
        )

        skills_embedding = self.embed_text(
            f"passage: {skills_text}"
        )

        experience_embedding = self.embed_text(
            f"passage: {experience_text}"
        )

        return ResumeEmbedding(
            summary_embedding=summary_embedding,
            skills_embedding=skills_embedding,
            experience_embedding=experience_embedding,
            model_name=self.model_name
        )
        
    def embed_requirement(
        self,
        requirement: RequirementAnalysis
    ) -> RequirementEmbedding:

        skills_text = " ".join(
            requirement.skills
        )

        experience_text = " ".join(
            requirement.experience
        )
        
        summary_embedding = self.embed_text(
            f"query: {requirement.summary}"
        )

        skills_embedding = self.embed_text(
            f"query: {skills_text}"
        )

        experience_embedding = self.embed_text(
            f"query: {experience_text}"
        )

        return RequirementEmbedding(
            model_name=self.model_name,
            summary_embedding=summary_embedding,
            skills_embedding=skills_embedding,
            experience_embedding=experience_embedding
        )