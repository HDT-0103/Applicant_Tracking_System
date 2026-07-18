from src.backend.app.services.embedding_service import EmbeddingService
from src.backend.app.services.ranking_service import RankingService


from src.backend.app.schemas.resume_analysis import ResumeAnalysis
from src.backend.app.schemas.requirement_analysis import RequirementAnalysis


requirement = RequirementAnalysis(
    summary="Backend Python developer",

    skills=[
        "Python",
        "FastAPI",
        "Docker"
    ],

    experience=["2 years backend development"]
)


resume_1 = ResumeAnalysis(
    summary="Backend developer with Python experience.",

    skills=[
        "Python",
        "FastAPI",
        "Docker"
    ],

    strengths=[],

    weaknesses=[],

    experience=[
        {
            "description":
            "Developed REST APIs using FastAPI."
        }
    ]
)
resume_2 = ResumeAnalysis(
    summary="Frontend developer.",

    skills=[
        "React",
        "JavaScript"
    ],

    strengths=[],

    weaknesses=[],

    experience=[
        {
            "description":
            "Built web interfaces."
        }
    ]
)

embedding_service = EmbeddingService()

ranking_service = RankingService()

resumes_list = [resume_1, resume_2]

embeddings = []
for resume in resumes_list:
    embedding = embedding_service.embed_resume(resume)
    embeddings.append(embedding)
    
embedded_requirement = embedding_service.embed_requirement(requirement)

# CHỖ THAY ĐỔI: Truyền thêm resumes_list vào cuối
scores = ranking_service.rank(embedded_requirement, embeddings, resumes_list)

print("\nKết quả Ranking:")
for item in scores:
    cv = item["resume_data"]
    score = item["final_score"]
    
    # Bạn biết chính xác CV này là của ai/nội dung gì mà không cần index!
    print(f"CV Summary: '{cv.summary}' -> Điểm: {score:.4f}")