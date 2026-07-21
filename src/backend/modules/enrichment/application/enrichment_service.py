import asyncio
import structlog
from typing import Annotated, Dict, List, Optional

import httpx
from fastapi import Depends

from modules.enrichment.domain.models import (
    CandidateEnrichment,
    CandidateSocialLinks,
    EnrichedProfile,
    EnrichmentStatus,
    GitHubProfile,
    GitHubRepo,
    LinkedInCertification,
    LinkedInEducation,
    LinkedInExperience,
    LinkedInProfile,
    MockAnalytics,
    TechnicalSkillMatrix,
)
from modules.shared.infrastructure.config import Settings, get_settings
from modules.shared.infrastructure.supabase_client import get_supabase_client
from modules.enrichment.application.supabase_candidate_service import SupabaseCandidateService
from modules.enrichment.application.github_ingestion_service import GitHubIngestionService
from modules.enrichment.application.linkedin_ingestion_service import LinkedInIngestionService
from modules.ingestion.domain.candidate_repository import get_candidate

logger = structlog.get_logger(__name__)

# In-memory storage (simulating database for now)
candidate_enrichments: Dict[str, CandidateEnrichment] = {}
active_websockets: Dict[str, List] = {}






def get_candidate_social_links(candidate_uuid: str) -> CandidateSocialLinks:
    candidate = get_candidate(candidate_uuid)
    if candidate and (candidate.github_username or candidate.linkedin_url):
        logger.info(
            "enrichment.social_links.found_in_store",
            uuid=candidate_uuid,
            github_username=candidate.github_username,
            linkedin_url=candidate.linkedin_url,
        )
        return CandidateSocialLinks(
            github_username=candidate.github_username,
            linkedin_url=candidate.linkedin_url,
        )

    logger.warning(
        "enrichment.social_links.not_found",
        uuid=candidate_uuid,
        candidate_exists=candidate is not None,
    )
    return CandidateSocialLinks(github_username=None, linkedin_url=None)


async def fetch_github_profile(
    github_username: str,
    settings: Annotated[Settings, Depends(get_settings)]
) -> GitHubProfile:
    """Fetch GitHub profile from GitHub API - no local caching"""
    try:
        headers = {}
        if settings.github_api_token:
            headers["Authorization"] = f"token {settings.github_api_token}"
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            repos_response = await client.get(
                f"https://api.github.com/users/{github_username}/repos",
                headers=headers,
                params={"per_page": 100, "sort": "updated"}
            )
            repos_response.raise_for_status()
            repos_data = repos_response.json()
            
            repos = [
                GitHubRepo(
                    name=repo["name"],
                    language=repo.get("language"),
                    size=repo["size"]
                )
                for repo in repos_data
            ]
            
            language_totals: Dict[str, int] = {}
            total_size = 0
            for repo in repos:
                if repo.language:
                    lang = repo.language
                    size = repo.size
                    language_totals[lang] = language_totals.get(lang, 0) + size
                    total_size += size
            
            top_languages = {}
            if total_size > 0:
                sorted_languages = sorted(language_totals.items(), key=lambda x: -x[1])[:3]
                for lang, size in sorted_languages:
                    top_languages[lang] = round((size / total_size) * 100, 1)
            
            readme_chunks: list[str] = []
            if repos:
                import base64

                # Pull README from several most recently updated repos
                for repo in repos[:5]:
                    try:
                        readme_response = await client.get(
                            f"https://api.github.com/repos/{github_username}/{repo.name}/readme",
                            headers=headers
                        )
                        if readme_response.status_code != 200:
                            continue
                        readme_data = readme_response.json()
                        content = base64.b64decode(readme_data["content"]).decode("utf-8", errors="ignore")
                        if content.strip():
                            readme_chunks.append(content[:3000])
                    except Exception:
                        continue

            readme_content = "\n\n".join(readme_chunks) if readme_chunks else None
            
            profile = GitHubProfile(
                public_repos_count=len(repos),
                top_languages=top_languages,
                readme_content=readme_content,
                repos=repos
            )
            
            logger.info("github.fetch.success", username=github_username, repos_count=len(repos))
            return profile
            
    except Exception as e:
        logger.error("github.fetch.failed", error=str(e), github_username=github_username)
        raise RuntimeError(f"Failed to fetch GitHub profile for {github_username}: {str(e)}")


async def fetch_linkedin_profile(
    linkedin_url: str,
    candidate_uuid: str,
    settings: Annotated[Settings, Depends(get_settings)]
) -> LinkedInProfile:
    """Fetch LinkedIn profile using ApifyClientAsync - no local caching"""
    logger.info("linkedin.fetch_apify.start", url=linkedin_url, candidate_uuid=candidate_uuid)
    
    try:
        if not settings.apify_api_token:
            raise ValueError("Missing APIFY_API_TOKEN in .env file.")
        
        from apify_client import ApifyClientAsync
        
        # Khởi tạo Async Client
        client = ApifyClientAsync(token=settings.apify_api_token)
        
        # --- Logic chuẩn hóa URL LinkedIn ---
        cleaned_url = linkedin_url.strip()
        
        # Chỉ chuẩn hóa phần domain, giữ nguyên chữ Hoa/Thường của username
        if "linkedin.com" in cleaned_url.lower():
            if "://linkedin.com" in cleaned_url:
                cleaned_url = cleaned_url.replace("://linkedin.com", "://www.linkedin.com")
        
        # Đảm bảo có dấu gạch chéo ở cuối
        if not cleaned_url.endswith("/"):
            cleaned_url += "/"
            
        logger.info("linkedin.fetch_apify.normalized_url", original=linkedin_url, cleaned=cleaned_url)
        # ---------------------------------------------
        
        # Extract username from URL for Actor validation
        username = cleaned_url.strip("/").split("/")[-1]
        
        # Setup input cho Actor với URL đã làm sạch và Proxy
        actor_input = {
            "profileUrls": [cleaned_url],
            "usernames": [username],  # Truyền đúng username để thoả mãn điều kiện của Actor
            "proxyConfiguration": {
                "useApifyProxy": True
            },
            "includeEmail": False
        }
        
        # Gọi Actor (ID: GOvL4O4RwFqsdIqXF)
        run = await client.actor("GOvL4O4RwFqsdIqXF").call(run_input=actor_input)
        
        # Lấy dữ liệu từ Dataset
        dataset_client = client.dataset(run.default_dataset_id)
        list_items_page = await dataset_client.list_items()
        items = list_items_page.items
        
        if not items or len(items) == 0:
            raise ValueError("Apify Actor returned empty dataset.")
        
        # Lấy item đầu tiên
        raw_data = items[0]
        
        # Log raw data structure for debugging
        logger.info("linkedin.fetch_apify.raw_data", raw_data_keys=list(raw_data.keys()))
        
        # Apify trả về dữ liệu trực tiếp trong raw_data, không có key "data"
        # Cấu trúc: { "basic_info": {...}, "experience": [...], "education": [...], ... }
        data = raw_data
        logger.info("linkedin.fetch_apify.data_keys", data_keys=list(data.keys()))
        
        basic_info = data.get("basic_info", {})
        logger.info("linkedin.fetch_apify.basic_info", basic_info_keys=list(basic_info.keys()) if basic_info else None)
        
        # Mapping dữ liệu từ Apify JSON sang LinkedInProfile
        full_name = basic_info.get("fullname", "LinkedIn Candidate")
        headline = basic_info.get("headline", "")
        avatar_url = basic_info.get("profile_picture_url", "")
        
        # Trích xuất kinh nghiệm công việc
        experiences = []
        experiences_data = data.get("experience", [])
        if experiences_data and isinstance(experiences_data, list):
            for exp in experiences_data:
                start_date_obj = exp.get("start_date", {})
                end_date_obj = exp.get("end_date", {})
                start_date = f"{start_date_obj.get('month', '')} {start_date_obj.get('year', '')}".strip() if start_date_obj else ""
                end_date = f"{end_date_obj.get('month', '')} {end_date_obj.get('year', '')}".strip() if end_date_obj else ""
                
                experiences.append(
                    LinkedInExperience(
                        title=exp.get("title", ""),
                        company=exp.get("company", ""),
                        start_date=start_date,
                        end_date=end_date,
                        description=exp.get("description", "")
                    )
                )
        
        # Trích xuất học vấn
        educations = []
        educations_data = data.get("education", [])
        if educations_data and isinstance(educations_data, list):
            for edu in educations_data:
                start_date_obj = edu.get("start_date", {})
                end_date_obj = edu.get("end_date", {})
                start_date = f"{start_date_obj.get('month', '')} {start_date_obj.get('year', '')}".strip() if start_date_obj else ""
                end_date = f"{end_date_obj.get('month', '')} {end_date_obj.get('year', '')}".strip() if end_date_obj else ""
                
                educations.append(
                    LinkedInEducation(
                        school=edu.get("school", ""),
                        degree=edu.get("degree", ""),
                        field_of_study=edu.get("field_of_study", ""),
                        start_date=start_date,
                        end_date=end_date
                    )
                )

        logger.info("linkedin.fetch_apify.success", candidate_uuid=candidate_uuid, experiences_count=len(experiences))
        
        profile = LinkedInProfile(
            full_name=full_name,
            headline=headline,
            profile_url=linkedin_url,
            avatar_url=avatar_url,
            experiences=experiences,
            educations=educations,
            certifications=[]
        )
        
        return profile

    except Exception as e:
        logger.error("linkedin.fetch_apify.failed", error=str(e), url=linkedin_url, candidate_uuid=candidate_uuid)
        raise RuntimeError(f"Failed to fetch LinkedIn profile for {linkedin_url}: {str(e)}")


# Keyword groups for local fallback analysis (matches frontend's 5 radar chart skills)
SKILL_GROUPS = {
    "frontend_development": {
        "keywords": ["react", "nextjs", "typescript", "javascript", "tailwind", "css", "html"],
        "score": 0
    },
    "backend_development": {
        "keywords": ["python", "golang", "java", "nodejs", "express", "fastapi", "postgresql", "mongodb", "redis", "sql", "graphql"],
        "score": 0
    },
    "devops_cloud": {
        "keywords": ["docker", "kubernetes", "k8s", "aws", "azure", "cicd", "ci/cd", "github actions", "terraform", "nginx"],
        "score": 0
    },
    "infosec": {
        "keywords": ["security", "oauth", "jwt", "encryption", "ssl", "tls", "authentication", "authorization", "penetration", "pentest"],
        "score": 0
    },
    "data_ai": {
        "keywords": ["pytorch", "tensorflow", "pandas", "numpy", "machine learning", "ai", "data analysis", "spark"],
        "score": 0
    }
}

SKILL_MAP = {
    "react": ("Frontend", 8),
    "nextjs": ("Frontend", 8),
    "typescript": ("Frontend", 7),
    "javascript": ("Frontend", 7),
    "tailwind": ("Frontend", 5),
    "css": ("Frontend", 5),
    "html": ("Frontend", 5),
    "python": ("Backend", 8),
    "golang": ("Backend", 7),
    "java": ("Backend", 7),
    "nodejs": ("Backend", 7),
    "express": ("Backend", 6),
    "fastapi": ("Backend", 6),
    "postgresql": ("Backend", 6),
    "mongodb": ("Backend", 6),
    "redis": ("Backend", 5),
    "sql": ("Backend", 5),
    "graphql": ("Backend", 6),
    "docker": ("Cloud Dev", 8),
    "kubernetes": ("Cloud Dev", 8),
    "k8s": ("Cloud Dev", 8),
    "aws": ("Cloud Dev", 7),
    "azure": ("Cloud Dev", 7),
    "cicd": ("Cloud Dev", 6),
    "ci/cd": ("Cloud Dev", 6),
    "github actions": ("Cloud Dev", 6),
    "terraform": ("Cloud Dev", 7),
    "nginx": ("Cloud Dev", 5),
    "security": ("InfoSec", 8),
    "oauth": ("InfoSec", 7),
    "jwt": ("InfoSec", 7),
    "encryption": ("InfoSec", 7),
    "ssl": ("InfoSec", 6),
    "tls": ("InfoSec", 6),
    "authentication": ("InfoSec", 7),
    "authorization": ("InfoSec", 7),
    "penetration": ("InfoSec", 6),
    "pentest": ("InfoSec", 6),
    "pytorch": ("ML / AI", 8),
    "tensorflow": ("ML / AI", 8),
    "pandas": ("ML / AI", 7),
    "numpy": ("ML / AI", 7),
    "machine learning": ("ML / AI", 8),
    "ai": ("ML / AI", 7),
    "data analysis": ("ML / AI", 7),
    "spark": ("ML / AI", 6),
}


def analyze_github_local_fallback(github_profile: GitHubProfile) -> dict:
    """Local keyword-based analysis as fallback when Gemini fails."""
    logger.info("github.analysis.using_local_fallback")
    
    group_scores = {group_name: 0 for group_name in SKILL_GROUPS.keys()}

    group_language_bias = {
        "frontend_development": {"JavaScript", "TypeScript", "HTML", "CSS"},
        "backend_development": {"Python", "Go", "Java", "C#", "Rust", "Shell"},
        "devops_cloud": {"Dockerfile", "HCL", "YAML"},
        "infosec": set(),
        "data_ai": {"Jupyter Notebook", "Python", "R"},
    }
    
    all_text = ""
    for repo in github_profile.repos:
        all_text += " " + repo.name.lower()
    for lang in github_profile.top_languages.keys():
        all_text += " " + lang.lower()
    if github_profile.readme_content:
        all_text += " " + github_profile.readme_content.lower()
    
    for group_name, group_data in SKILL_GROUPS.items():
        keyword_hits = 0
        for keyword in group_data["keywords"]:
            keyword_hits += all_text.count(keyword.lower())

        language_bonus = 0.0
        if github_profile.top_languages:
            for language, pct in github_profile.top_languages.items():
                if language in group_language_bias[group_name]:
                    language_bonus += float(pct) * 0.35

        score = 25.0 + (keyword_hits * 12.0) + language_bonus
        group_scores[group_name] = int(max(0.0, min(100.0, round(score))))
    
    semantic_tags = []
    for lang in github_profile.top_languages.keys():
        tag = f"#{lang.lower()}"
        if tag not in semantic_tags:
            semantic_tags.append(tag)
    for group_name, group_data in SKILL_GROUPS.items():
        for keyword in group_data["keywords"]:
            tag = f"#{keyword.replace(' ', '-')}"
            if keyword.lower() in all_text and tag not in semantic_tags and len(semantic_tags) < 8:
                semantic_tags.append(tag)
    
    technical_skills = {}
    skill_names = {
        "backend_development": "Backend",
        "frontend_development": "Frontend",
        "devops_cloud": "Cloud Dev",
        "infosec": "InfoSec",
        "data_ai": "ML / AI"
    }
    for group_name, score in group_scores.items():
        technical_skills[skill_names.get(group_name, group_name)] = score
    
    return {
        "semantic_tags": semantic_tags[:8],
        "technical_skills": technical_skills
    }


def generate_analytics(
    readme_content: str | None = None,
    linkedin_profile: LinkedInProfile | None = None,
    local_github_analysis: dict | None = None  # Đổi tên parameter cho rõ nghĩa
) -> MockAnalytics:
    selected_tags: list[str] = []
    skill_set: dict[str, float] = {}
    visited_tags: set[str] = set()

    def _ingest(text: str | None):
        if not text:
            return
        text_lower = text.lower()
        for kw, (skill_name, weight) in SKILL_MAP.items():
            tag = f"#{kw}"
            if kw in text_lower:
                if tag not in visited_tags:
                    selected_tags.append(tag)
                    visited_tags.add(tag)
                skill_set[skill_name] = max(skill_set.get(skill_name, 0), weight * 10)

    if readme_content:
        _ingest(readme_content)

    if linkedin_profile:
        for exp in linkedin_profile.experiences:
            _ingest(exp.title)
            _ingest(exp.description)
            _ingest(exp.company)
        for edu in linkedin_profile.educations:
            _ingest(edu.school)
            _ingest(edu.degree)
            _ingest(edu.field_of_study)
        for cert in linkedin_profile.certifications:
            _ingest(cert.name)
    
    # FIX LỖI: Dùng trực tiếp dữ liệu từ local_github_analysis, loại bỏ hoàn toàn hàm không tồn tại
    if local_github_analysis:
        # Nhúng các tag tìm thấy từ phân tích local
        local_tags = local_github_analysis.get("semantic_tags", [])
        for tag in local_tags:
            if tag not in visited_tags:
                selected_tags.append(tag)
                visited_tags.add(tag)
        
        # Nhúng các score từ phân tích local
        local_skills = local_github_analysis.get("technical_skills", {})
        for skill_name, score in local_skills.items():
            skill_set[skill_name] = max(skill_set.get(skill_name, 0), float(score))

    expected_skills = ["Backend", "Frontend", "Cloud Dev", "InfoSec", "ML / AI"]
    post_enrichment_scores = []
    for skill in expected_skills:
        post_enrichment_scores.append(float(skill_set.get(skill, 0.0)))
    
    pre_enrichment_scores = [round(s * 0.75, 1) for s in post_enrichment_scores]

    avg_post_score = sum(post_enrichment_scores) / len(post_enrichment_scores) if post_enrichment_scores else 0
    match_confidence_score = min(avg_post_score * 0.8 + (len(selected_tags) * 5), 99.0)
    score_increase = round(avg_post_score * 0.2, 1)

    final_semantic_tags = selected_tags[:8] if selected_tags else ["#github", "#enriched"]

    return MockAnalytics(
        match_confidence_score=round(match_confidence_score, 1),
        score_increase=score_increase,
        semantic_tags=final_semantic_tags,
        technical_skill_matrix=TechnicalSkillMatrix(
            pre_enrichment=pre_enrichment_scores,
            post_enrichment=[round(s, 1) for s in post_enrichment_scores],
        ),
    )


def idempotent_merge(existing: EnrichedProfile | None, new_data: EnrichedProfile) -> EnrichedProfile:
    if existing is None:
        return new_data
    
    merged_full_name = new_data.full_name or (new_data.linkedin.full_name if new_data.linkedin else None) or existing.full_name
    
    existing_tags = set(tag.lower() for tag in existing.analytics.semantic_tags)
    new_tags = set(tag.lower() for tag in new_data.analytics.semantic_tags)
    merged_tags = list(existing_tags.union(new_tags))[:8]
    
    merged_pre = [
        max(existing.analytics.technical_skill_matrix.pre_enrichment[i], new_data.analytics.technical_skill_matrix.pre_enrichment[i])
        for i in range(5)
    ]
    merged_post = [
        max(existing.analytics.technical_skill_matrix.post_enrichment[i], new_data.analytics.technical_skill_matrix.post_enrichment[i])
        for i in range(5)
    ]
    
    existing_experiences = {exp.company: exp for exp in (existing.linkedin.experiences if existing.linkedin else [])}
    new_experiences = {exp.company: exp for exp in (new_data.linkedin.experiences if new_data.linkedin else [])}
    merged_experiences_dict = {**existing_experiences, **new_experiences}
    merged_experiences = list(merged_experiences_dict.values())
    
    merged = EnrichedProfile(
        github=new_data.github if new_data.github else existing.github,
        linkedin=LinkedInProfile(
            experiences=merged_experiences,
            educations=new_data.linkedin.educations if new_data.linkedin else existing.linkedin.educations,
            certifications=new_data.linkedin.certifications if new_data.linkedin else existing.linkedin.certifications,
            full_name=new_data.linkedin.full_name if new_data.linkedin else existing.linkedin.full_name,
            headline=new_data.linkedin.headline if new_data.linkedin else existing.linkedin.headline,
            profile_url=new_data.linkedin.profile_url if new_data.linkedin else existing.linkedin.profile_url,
            avatar_url=new_data.linkedin.avatar_url if new_data.linkedin else existing.linkedin.avatar_url,
        ) if new_data.linkedin or existing.linkedin else None,
        analytics=MockAnalytics(
            match_confidence_score=max(existing.analytics.match_confidence_score, new_data.analytics.match_confidence_score),
            score_increase=max(existing.analytics.score_increase, new_data.analytics.score_increase),
            semantic_tags=merged_tags,
            technical_skill_matrix=TechnicalSkillMatrix(
                pre_enrichment=merged_pre,
                post_enrichment=merged_post,
            )
        ),
        github_username=new_data.github_username or existing.github_username,
        linkedin_url=new_data.linkedin_url or existing.linkedin_url,
        full_name=merged_full_name
    )
    return merged


async def enrichment_worker(
    candidate_uuid: str,
    settings: Settings
):
    """
    Enrichment Worker - No local files, direct scraper + Supabase integration
    
    Workflow:
    1. Ensure candidate exists in Supabase (synchronous)
    2. Get social links from candidate repository
    3. Update social links in Supabase
    4. Trigger scraper directly (no file checks)
    5. Save scraped data to Supabase via UPSERT
    6. Generate analytics
    7. Send WebSocket notification
    """
    logger.info("enrichment.worker.started", candidate_uuid=candidate_uuid)
    
    # Initialize Supabase services if configured
    supabase_client = get_supabase_client(settings, use_admin=True)
    candidate_service = None
    github_ingestion_service = None
    linkedin_ingestion_service = None
    use_supabase = supabase_client is not None
    
    if use_supabase:
        candidate_service = SupabaseCandidateService(settings, supabase_client)
        github_ingestion_service = GitHubIngestionService(settings, supabase_client)
        linkedin_ingestion_service = LinkedInIngestionService(settings, supabase_client)
        logger.info("enrichment.worker.supabase_enabled")
    else:
        logger.error("enrichment.worker.supabase_disabled.cannot_proceed")
        candidate_enrichments[candidate_uuid] = CandidateEnrichment(
            candidate_uuid=candidate_uuid,
            enrichment_status=EnrichmentStatus.ENRICHMENT_FAILED
        )
        return
    
    try:
        candidate_enrichments[candidate_uuid] = CandidateEnrichment(
            candidate_uuid=candidate_uuid,
            enrichment_status=EnrichmentStatus.IN_PROGRESS
        )
        
        # STEP 1: Ensure candidate exists in Supabase (synchronous)
        # Get candidate data from candidate repository (Azure Blob Storage URL + form fields)
        candidate = get_candidate(candidate_uuid)
        cv_file_path = candidate.cv_file_path if candidate else None
        full_name = candidate.full_name if candidate else None
        email = candidate.email if candidate else None
        phone = candidate.phone if candidate else None
        linkedin_url = candidate.linkedin_url if candidate else None
        github_username = candidate.github_username if candidate else None
        job_id = candidate.job_id if candidate else None
        
        logger.info("enrichment.step1.ensure_candidate", candidate_uuid=candidate_uuid, cv_file_path=cv_file_path)
        candidate_created = await candidate_service.ensure_candidate_exists(
            candidate_uuid,
            cv_file_path,
            full_name=full_name,
            email=email,
            phone=phone,
            linkedin_url=linkedin_url,
            github_username=github_username,
            job_id=job_id,
        )
        
        if not candidate_created:
            logger.error("enrichment.step1.candidate_creation_failed", candidate_uuid=candidate_uuid)
            raise RuntimeError(f"Failed to create candidate {candidate_uuid} in Supabase")
        
        logger.info("enrichment.step1.candidate_ensured", candidate_uuid=candidate_uuid)
        
        # STEP 2: Get social links from candidate repository
        logger.info("enrichment.step2.get_social_links", candidate_uuid=candidate_uuid)
        social_links = get_candidate_social_links(candidate_uuid)
        
        # STEP 3: Update candidate social links in Supabase if available
        if social_links.github_username or social_links.linkedin_url:
            logger.info(
                "enrichment.step3.update_social_links",
                candidate_uuid=candidate_uuid,
                github_username=social_links.github_username,
                linkedin_url=social_links.linkedin_url
            )
            await candidate_service.update_candidate_social_links(
                candidate_uuid,
                github_username=social_links.github_username,
                linkedin_url=social_links.linkedin_url
            )
            logger.info("enrichment.step3.social_links_updated", candidate_uuid=candidate_uuid)
        else:
            logger.warning("enrichment.step3.no_social_links", candidate_uuid=candidate_uuid)
        
        # STEP 4: Trigger scraper directly (no local file checks)
        github_profile = None
        linkedin_profile = None
        
        # GitHub Scraping
        if social_links.github_username:
            logger.info(
                "enrichment.step4.github_scraper.start",
                candidate_uuid=candidate_uuid,
                username=social_links.github_username
            )
            try:
                github_profile = await fetch_github_profile(social_links.github_username, settings)
                logger.info(
                    "enrichment.step4.github_scraper.success",
                    candidate_uuid=candidate_uuid,
                    username=social_links.github_username,
                    repos_count=len(github_profile.repos) if github_profile else 0
                )
            except Exception as e:
                logger.error(
                    "enrichment.step4.github_scraper.failed",
                    candidate_uuid=candidate_uuid,
                    username=social_links.github_username,
                    error=str(e)
                )
                github_profile = None
        
        # LinkedIn Scraping
        if social_links.linkedin_url:
            logger.info(
                "enrichment.step4.linkedin_scraper.start",
                candidate_uuid=candidate_uuid,
                url=social_links.linkedin_url
            )
            try:
                linkedin_profile = await fetch_linkedin_profile(
                    social_links.linkedin_url,
                    candidate_uuid,
                    settings
                )
                logger.info(
                    "enrichment.step4.linkedin_scraper.success",
                    candidate_uuid=candidate_uuid,
                    url=social_links.linkedin_url,
                    experiences_count=len(linkedin_profile.experiences) if linkedin_profile else 0
                )
            except Exception as e:
                logger.error(
                    "enrichment.step4.linkedin_scraper.failed",
                    candidate_uuid=candidate_uuid,
                    url=social_links.linkedin_url,
                    error=str(e)
                )
                linkedin_profile = None
        
        # STEP 5: Save scraped data to Supabase via UPSERT
        if github_profile and github_ingestion_service:
            logger.info(
                "enrichment.step5.github_supabase_save.start",
                candidate_uuid=candidate_uuid
            )
            try:
                # Map to match sample_github.json structure and github_profiles DDL
                scraped_github_data = {
                    "public_repos_count": github_profile.public_repos_count,
                    "top_languages": github_profile.top_languages,
                    "readme_content": github_profile.readme_content,
                    "repos": [repo.model_dump() for repo in github_profile.repos]
                }
                github_ingestion_service.save_scraped_github_data(candidate_uuid, scraped_github_data)
                logger.info(
                    "enrichment.step5.github_supabase_save.success",
                    candidate_uuid=candidate_uuid
                )
            except Exception as e:
                logger.error(
                    "enrichment.step5.github_supabase_save.failed",
                    candidate_uuid=candidate_uuid,
                    error=str(e)
                )
        
        if linkedin_profile and linkedin_ingestion_service:
            logger.info(
                "enrichment.step5.linkedin_supabase_save.start",
                candidate_uuid=candidate_uuid
            )
            try:
                def _parse_date_str(val):
                    if not val or not isinstance(val, str) or not val.strip():
                        return None
                    parts = val.strip().split()
                    d = {}
                    if len(parts) >= 1:
                        try:
                            d["year"] = int(parts[-1])
                        except ValueError:
                            pass
                    if len(parts) >= 2:
                        d["month"] = parts[0]
                    return d if d else None

                def _exp_to_supabase(exp):
                    d = exp.model_dump()
                    for field in ("start_date", "end_date"):
                        d[field] = _parse_date_str(d.get(field))
                    return d

                def _edu_to_supabase(edu):
                    d = edu.model_dump()
                    for field in ("start_date", "end_date"):
                        d[field] = _parse_date_str(d.get(field))
                    return d

                scraped_linkedin_data = {
                    "full_name": linkedin_profile.full_name,
                    "headline": linkedin_profile.headline,
                    "profile_url": linkedin_profile.profile_url,
                    "avatar_url": linkedin_profile.avatar_url,
                    "experience": [_exp_to_supabase(exp) for exp in linkedin_profile.experiences],
                    "education": [_edu_to_supabase(edu) for edu in linkedin_profile.educations],
                    "certifications": [cert.model_dump() for cert in linkedin_profile.certifications] if linkedin_profile.certifications else []
                }
                linkedin_ingestion_service.save_scraped_linkedin_data(candidate_uuid, scraped_linkedin_data)
                logger.info(
                    "enrichment.step5.linkedin_supabase_save.success",
                    candidate_uuid=candidate_uuid
                )
            except Exception as e:
                logger.error(
                    "enrichment.step5.linkedin_supabase_save.failed",
                    candidate_uuid=candidate_uuid,
                    error=str(e)
                )
        
        # STEP 6: Analyze and generate analytics
        logger.info("enrichment.step6.analytics.start", candidate_uuid=candidate_uuid)
        local_analysis = None
        if github_profile and github_profile.repos:
            local_analysis = analyze_github_local_fallback(github_profile)
        
        analytics = generate_analytics(
            readme_content=github_profile.readme_content if github_profile else None,
            linkedin_profile=linkedin_profile,
            local_github_analysis=local_analysis
        )
        logger.info("enrichment.step6.analytics.completed", candidate_uuid=candidate_uuid)
        
        # STEP 7: Build enriched profile
        candidate_full_name = linkedin_profile.full_name if linkedin_profile else None
        
        new_profile = EnrichedProfile(
            github=github_profile,
            linkedin=linkedin_profile,
            analytics=analytics,
            github_username=social_links.github_username,
            linkedin_url=social_links.linkedin_url,
            full_name=candidate_full_name
        )
        
        existing = candidate_enrichments.get(candidate_uuid)
        merged_profile = idempotent_merge(existing.enriched_profile if existing else None, new_profile)
        
        candidate_enrichments[candidate_uuid] = CandidateEnrichment(
            candidate_uuid=candidate_uuid,
            enrichment_status=EnrichmentStatus.ENRICHED,
            enriched_profile=merged_profile
        )
        
        logger.info(
            "enrichment.worker.completed",
            candidate_uuid=candidate_uuid,
            has_github=bool(github_profile),
            has_linkedin=bool(linkedin_profile)
        )
        
        # STEP 8: Send WebSocket notification
        if candidate_uuid in active_websockets:
            dead_sockets = []
            for websocket in list(active_websockets[candidate_uuid]):
                try:
                    await websocket.send_json({
                        "status": "ENRICHED",
                        "data": merged_profile.model_dump(),
                        "skills_matrix": merged_profile.analytics.technical_skill_matrix.model_dump(),
                        "career_trajectory": [
                            {
                                "title": exp.title,
                                "company": exp.company,
                                "start_date": exp.start_date,
                                "end_date": exp.end_date
                            }
                            for exp in (merged_profile.linkedin.experiences if merged_profile.linkedin else [])
                        ],
                        "semantic_tags": merged_profile.analytics.semantic_tags
                    })
                except Exception as ws_error:
                    logger.warning(
                        "enrichment.websocket.send.failed",
                        candidate_uuid=candidate_uuid,
                        error=str(ws_error),
                    )
                    dead_sockets.append(websocket)

            for websocket in dead_sockets:
                if websocket in active_websockets.get(candidate_uuid, []):
                    active_websockets[candidate_uuid].remove(websocket)
            if candidate_uuid in active_websockets and not active_websockets[candidate_uuid]:
                del active_websockets[candidate_uuid]
        
    except Exception as e:
        logger.error(
            "enrichment.worker.failed",
            error=str(e),
            candidate_uuid=candidate_uuid
        )
        candidate_enrichments[candidate_uuid] = CandidateEnrichment(
            candidate_uuid=candidate_uuid,
            enrichment_status=EnrichmentStatus.ENRICHMENT_FAILED
        )
        
        if candidate_uuid in active_websockets:
            dead_sockets = []
            for websocket in list(active_websockets[candidate_uuid]):
                try:
                    await websocket.send_json({
                        "status": "ENRICHMENT_FAILED",
                        "error": str(e)
                    })
                except Exception as ws_error:
                    logger.warning(
                        "enrichment.websocket.send.failed",
                        candidate_uuid=candidate_uuid,
                        error=str(ws_error),
                    )
                    dead_sockets.append(websocket)

            for websocket in dead_sockets:
                if websocket in active_websockets.get(candidate_uuid, []):
                    active_websockets[candidate_uuid].remove(websocket)
            if candidate_uuid in active_websockets and not active_websockets[candidate_uuid]:
                del active_websockets[candidate_uuid]
