import structlog
from typing import Annotated, Dict, List

import httpx
from fastapi import Depends

from modules.enrichment.application.gemini_parser_service import GeminiParserService
from modules.enrichment.application.linkedin_scraper_service import LinkedInScraperService
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
) -> GitHubProfile | None:
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
            
            readme_content = None
            if repos:
                try:
                    readme_response = await client.get(
                        f"https://api.github.com/repos/{github_username}/{repos[0].name}/readme",
                        headers=headers
                    )
                    if readme_response.status_code == 200:
                        import base64
                        readme_data = readme_response.json()
                        readme_content = base64.b64decode(readme_data["content"]).decode("utf-8", errors="ignore")
                except Exception:
                    pass
            
            return GitHubProfile(
                public_repos_count=len(repos),
                top_languages=top_languages,
                readme_content=readme_content,
                repos=repos
            )
    except Exception as e:
        logger.error("github.fetch.failed", error=str(e), github_username=github_username)
        return None


def _gemini_dict_to_linkedin_profile(data: dict) -> LinkedInProfile:
    experiences = []
    for exp in data.get("experiences", []):
        experiences.append(
            LinkedInExperience(
                title=exp.get("title", ""),
                company=exp.get("company", ""),
                start_date=exp.get("starts_at"),
                end_date=exp.get("ends_at"),
                description=exp.get("description"),
            )
        )
    educations = []
    for edu in data.get("educations", []):
        educations.append(
            LinkedInEducation(
                school=edu.get("school", ""),
                degree=edu.get("degree"),
                field_of_study=edu.get("field_of_study"),
                start_date=edu.get("starts_at"),
                end_date=edu.get("ends_at"),
            )
        )
    certifications = []
    for cert_name in data.get("certifications", []):
        if isinstance(cert_name, str):
            certifications.append(
                LinkedInCertification(
                    name=cert_name,
                    issuing_organization="",
                    issue_date=None,
                    expiration_date=None,
                )
            )
    return LinkedInProfile(
        experiences=experiences,
        educations=educations,
        certifications=certifications,
    )


async def fetch_linkedin_profile(
    linkedin_url: str,
    settings: Annotated[Settings, Depends(get_settings)]
) -> LinkedInProfile | None:
    linkedin_profile = None

    # ---- Flow 1: LinkedInScraperService + GeminiParserService ----
    if settings.gemini_api_key:
        try:
            scraper = LinkedInScraperService(settings)
            markdown = await scraper.scrape_to_markdown(linkedin_url)
            await scraper.close()

            if markdown:
                parser = GeminiParserService(settings)
                parsed = await parser.parse_markdown(markdown)
                if parsed and "experiences" in parsed:
                    linkedin_profile = _gemini_dict_to_linkedin_profile(parsed)
                    logger.info("linkedin.fetch.gemini_success", url=linkedin_url)
        except Exception as e:
            logger.warning("linkedin.fetch.gemini_failed", error=str(e), linkedin_url=linkedin_url)

    return linkedin_profile


SKILL_MAP = {
    "python": ("Python", 8), "javascript": ("JavaScript", 8), "typescript": ("TypeScript", 7),
    "java": ("Java", 7), "go": ("Go", 7), "rust": ("Rust", 6),
    "kubernetes": ("Kubernetes", 8), "docker": ("Docker", 8), "terraform": ("Terraform", 7),
    "aws": ("AWS", 8), "gcp": ("GCP", 7), "azure": ("Azure", 7),
    "kafka": ("Kafka", 7), "microservice": ("Microservices", 8),
    "react": ("React", 7), "nodejs": ("Node.js", 7), "node.js": ("Node.js", 7),
    "machine-learning": ("Machine Learning", 8), "deep-learning": ("Deep Learning", 7),
    "nlp": ("NLP", 7), "devops": ("DevOps", 7), "sql": ("SQL", 6),
    "redis": ("Redis", 6), "postgresql": ("PostgreSQL", 6), "mongodb": ("MongoDB", 6),
    "ci/cd": ("CI/CD", 7), "ci-cd": ("CI/CD", 7),
}


def generate_analytics(readme_content: str | None = None,
                        linkedin_profile: LinkedInProfile | None = None) -> MockAnalytics:
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

    if not skill_set:
        return MockAnalytics(
            match_confidence_score=0.0,
            score_increase=0.0,
            semantic_tags=selected_tags[:8],
            technical_skill_matrix=TechnicalSkillMatrix(
                pre_enrichment=[0.0] * 5,
                post_enrichment=[0.0] * 5,
            ),
        )

    detected_skills = sorted(skill_set.items(), key=lambda x: -x[1])[:5]
    skill_names = [s[0] for s in detected_skills]
    scores = [min(s[1], 100.0) for s in detected_skills]

    while len(skill_names) < 5:
        skill_names.append("N/A")
        scores.append(0.0)

    total_data_points = (1 if readme_content else 0) + (1 if linkedin_profile and (
        linkedin_profile.experiences or linkedin_profile.educations) else 0)
    base_score = min(total_data_points * 40.0 + sum(scores) / len(scores) * 0.3, 99.0)
    score_increase = scores[0] * 0.15 if scores else 0.0

    return MockAnalytics(
        match_confidence_score=round(base_score + score_increase, 1),
        score_increase=round(score_increase, 1),
        semantic_tags=selected_tags[:8],
        technical_skill_matrix=TechnicalSkillMatrix(
            pre_enrichment=[round(s * 0.75, 1) for s in scores[:5]],
            post_enrichment=[round(s, 1) for s in scores[:5]],
        ),
    )


def idempotent_merge(existing: EnrichedProfile | None, new_data: EnrichedProfile) -> EnrichedProfile:
    if existing is None:
        return new_data
    
    merged = EnrichedProfile(
        github=new_data.github if new_data.github else existing.github,
        linkedin=new_data.linkedin if new_data.linkedin else existing.linkedin,
        analytics=new_data.analytics
    )
    return merged


async def enrichment_worker(
    candidate_uuid: str,
    settings: Settings
):
    logger.info("enrichment.worker.started", candidate_uuid=candidate_uuid)
    
    try:
        candidate_enrichments[candidate_uuid] = CandidateEnrichment(
            candidate_uuid=candidate_uuid,
            enrichment_status=EnrichmentStatus.IN_PROGRESS
        )
        
        social_links = get_candidate_social_links(candidate_uuid)
        
        github_profile = None
        if social_links.github_username:
            github_profile = await fetch_github_profile(social_links.github_username, settings)
        
        linkedin_profile = None
        if social_links.linkedin_url:
            linkedin_profile = await fetch_linkedin_profile(social_links.linkedin_url, settings)
        
        # Always generate analytics, even without social profiles
        analytics = generate_analytics(
            readme_content=github_profile.readme_content if github_profile else None,
            linkedin_profile=linkedin_profile,
        )
        
        new_profile = EnrichedProfile(
            github=github_profile,
            linkedin=linkedin_profile,
            analytics=analytics
        )
        
        existing = candidate_enrichments.get(candidate_uuid)
        merged_profile = idempotent_merge(existing.enriched_profile if existing else None, new_profile)
        
        candidate_enrichments[candidate_uuid] = CandidateEnrichment(
            candidate_uuid=candidate_uuid,
            enrichment_status=EnrichmentStatus.ENRICHED,
            enriched_profile=merged_profile
        )
        
        logger.info("enrichment.worker.completed", candidate_uuid=candidate_uuid)
        
        # Notify connected websockets
        if candidate_uuid in active_websockets:
            for websocket in active_websockets[candidate_uuid]:
                try:
                    await websocket.send_json({
                        "status": "ENRICHED",
                        "data": merged_profile.model_dump()
                    })
                except Exception:
                    pass
        
    except Exception as e:
        logger.error("enrichment.worker.failed", error=str(e), candidate_uuid=candidate_uuid)
        candidate_enrichments[candidate_uuid] = CandidateEnrichment(
            candidate_uuid=candidate_uuid,
            enrichment_status=EnrichmentStatus.ENRICHMENT_FAILED
        )
        
        if candidate_uuid in active_websockets:
            for websocket in active_websockets[candidate_uuid]:
                try:
                    await websocket.send_json({
                        "status": "ENRICHMENT_FAILED",
                        "error": str(e)
                    })
                except Exception:
                    pass

