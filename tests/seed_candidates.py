import asyncio
import os
from pathlib import Path
import sys
from uuid import uuid4

# 1. Thêm root dir vào sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.extend([str(ROOT_DIR), str(ROOT_DIR / "src")])

try:
    from dotenv import load_dotenv
    load_dotenv(ROOT_DIR / ".env")
except ImportError:
    pass

from supabase import create_client, Client

from src.backend.app.models.enums import (
    CandidateStatus,
    EnrichmentStatus,
    EmbeddingSource,
)
from src.backend.app.schemas.embedding import EmbeddingCreate
from src.backend.app.repositories.enrichment_repository import EnrichmentRepository
from src.backend.app.repositories.embedding_repository import EmbeddingRepository
from src.backend.app.services.embedding_service import EmbeddingService


DUMMY_CANDIDATES = [
    {
        "full_name": "Nguyễn Văn Anh",
        "email": "anh.nguyen.senior@example.com",
        "status": CandidateStatus.ACTIVE.value,
        "skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "Redis"],
        "summary": "Senior Backend Engineer với 5 năm kinh nghiệm thiết kế Microservices bằng Python và FastAPI. Tối ưu hóa truy vấn PostgreSQL chịu tải lớn.",
        "experience": "5 năm làm Backend Developer tại công ty Fintech TP.HCM. Xây dựng API tốc độ cao với FastAPI và quản trị PostgreSQL."
    },
    {
        "full_name": "Trần Thị Bích",
        "email": "bich.tran.lead@example.com",
        "status": CandidateStatus.ACTIVE.value,
        "skills": ["Python", "FastAPI", "PostgreSQL", "Kubernetes", "gRPC"],
        "summary": "Lead Python Developer tại TP.HCM. Thành thạo FastAPI, PostgreSQL và kiến trúc hệ thống phân tán.",
        "experience": "6 năm lập trình Backend Python. Lập trình RESTful API bằng FastAPI, tối ưu hóa CSDL PostgreSQL và triển khai CI/CD."
    },
    {
        "full_name": "Lê Hoàng Cường",
        "email": "cuong.le.hanoi@example.com",
        "status": CandidateStatus.ACTIVE.value,
        "skills": ["Python", "FastAPI", "PostgreSQL", "AWS"],
        "summary": "Senior Backend Developer làm việc tại Hà Nội. Chuyên môn sâu về Python, FastAPI và PostgreSQL.",
        "experience": "4 năm phát triển hệ thống Cloud Backend tại Hà Nội sử dụng Python và FastAPI."
    },
    {
        "full_name": "Phạm Minh Dung",
        "email": "dung.pham.django@example.com",
        "status": CandidateStatus.ACTIVE.value,
        "skills": ["Python", "Django", "PostgreSQL", "Celery"],
        "summary": "Backend Python Developer tại TP.HCM. Kinh nghiệm phong phú với Django REST Framework và PostgreSQL.",
        "experience": "4 năm phát triển ứng dụng Web tại TP.HCM bằng Python và Django."
    },
    {
        "full_name": "Vũ Anh Tuấn",
        "email": "tuan.vu.frontend@example.com",
        "status": CandidateStatus.ACTIVE.value,
        "skills": ["React", "TypeScript", "TailwindCSS", "Next.js"],
        "summary": "Frontend Engineer tại TP.HCM chuyên xây dựng giao diện người dùng bằng ReactJS và TypeScript.",
        "experience": "3 năm kinh nghiệm phát triển Frontend Web App."
    }
]


def get_service_role_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    service_key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_SERVICE_KEY")
    )
    if not url or not service_key:
        raise ValueError("❌ THIẾU SUPABASE_SERVICE_ROLE_KEY trong file .env!")
    
    print(f"🔑 Admin Client đã load thành công Service Role Key ({service_key[:8]}...)")
    return create_client(url, service_key)


async def seed_database():
    print("🚀 Bắt đầu quá trình nạp Candidate Data mẫu...")

    # Khởi tạo Service Role Client
    admin_client = get_service_role_client()
    embedding_service = EmbeddingService()

    # Truyền Admin Client vào Repositories (giờ đây BaseRepository đã tôn trọng session này!)
    enrichment_repo = EnrichmentRepository(session=admin_client)
    embedding_repo = EmbeddingRepository(session=admin_client)

    # Dọn dẹp dữ liệu cũ theo danh sách emails mẫu để đảm bảo tính Idempotent
    target_emails = [c["email"] for c in DUMMY_CANDIDATES]
    print(f"🧹 Đang dọn dẹp các ứng viên thử nghiệm cũ ({len(target_emails)} emails)...")
    admin_client.table("candidates").delete().in_("email", target_emails).execute()

    for idx, data in enumerate(DUMMY_CANDIDATES, 1):
        candidate_uuid = str(uuid4())
        print(f"\n[{idx}/{len(DUMMY_CANDIDATES)}] Đang xử lý: {data['full_name']} ({data['email']})")

        # 1. Thêm vào bảng candidates
        admin_client.table("candidates").insert({
            "uuid": candidate_uuid,
            "full_name": data["full_name"],
            "email": data["email"],
            "status": data["status"]
        }).execute()
        print("  ├─ ✅ Đã chèn vào bảng 'candidates'")

        # 2. Thêm vào bảng enrichment_profiles
        profile = await enrichment_repo.create_profile(
            candidate_uuid=candidate_uuid,
            skills=data["skills"],
            summary=data["summary"],
            experience=data["experience"],
            enrichment_status=EnrichmentStatus.ENRICHED
        )
        profile_id = profile.id
        print(f"  ├─ ✅ Đã tạo 'enrichment_profiles' (ID: {profile_id})")

        # 3. Embed text với tiền tố passage:
        summary_vec = embedding_service.embed_text(f"passage: {data['summary']}")
        experience_vec = embedding_service.embed_text(f"passage: {data['experience']}")

        # 4. Lưu embeddings (SUMMARY & EXPERIENCE)
        embeddings_payload = [
            EmbeddingCreate(
                enrichment_profile_id=profile_id,
                source_type=EmbeddingSource.SUMMARY,
                text_content=data["summary"],
                embedding=summary_vec
            ),
            EmbeddingCreate(
                enrichment_profile_id=profile_id,
                source_type=EmbeddingSource.EXPERIENCE,
                text_content=data["experience"],
                embedding=experience_vec
            ),
        ]

        await embedding_repo.create_embeddings(embeddings_payload)
        print("  └─ ✅ Đã lưu 2 vector (SUMMARY & EXPERIENCE) vào 'embeddings'")

    print("\n🎉 HOÀN TẤT SEED DATA THÀNH CÔNG!")


if __name__ == "__main__":
    asyncio.run(seed_database())