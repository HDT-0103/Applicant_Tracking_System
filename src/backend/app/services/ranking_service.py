from backend.app.models import RequirementEmbedding, ResumeEmbedding
from backend.app.schemas.resume_analysis import ResumeAnalysis
from backend.app.schemas.resume_score import ResumeScore
from sentence_transformers import util
class RankingService:
    def cosine(
        self,
        v1,
        v2
    ):
        return util.cos_sim(v1, v2).item()
    
    def rank_one(
        self,
        requirement: RequirementEmbedding,
        resume: ResumeEmbedding,
    ):

        skill_score = self.cosine(
            requirement.skills_embedding,
            resume.skills_embedding
        )

        summary_score = self.cosine(
            requirement.summary_embedding,
            resume.summary_embedding
        )

        experience_score = self.cosine(
            requirement.experience_embedding,
            resume.experience_embedding
        )

        final_score = (
            0.5 * skill_score +
            0.3 * experience_score +
            0.2 * summary_score
        )

        return ResumeScore(
            summary_score=summary_score,
            skills_score=skill_score,
            experience_score=experience_score,
            final_score=final_score
        )
        
    def rank(
        self,
        requirement: RequirementEmbedding,
        resumes: list[ResumeEmbedding],
        original_resumes: list[ResumeAnalysis]
    ):
        scores = []

        for resume_emb, resume_data in zip(resumes, original_resumes):
            skill_score = self.cosine(requirement.skills_embedding, resume_emb.skills_embedding)
            summary_score = self.cosine(requirement.summary_embedding, resume_emb.summary_embedding)
            experience_score = self.cosine(requirement.experience_embedding, resume_emb.experience_embedding)

            final_score = (0.5 * skill_score + 0.3 * experience_score + 0.2 * summary_score)

            # Gom tất cả vào một dict
            scores.append({
                "resume_data": resume_data,  # <--- Giữ lại toàn bộ thông tin CV ở đây!
                "final_score": final_score
            })

        scores.sort(
            key=lambda x: x["final_score"],
            reverse=True
        )

        return scores