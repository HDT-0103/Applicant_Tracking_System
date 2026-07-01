from enum import Enum
from typing import Any, Dict, List
from pydantic import BaseModel, Field


class EnrichmentStatus(str, Enum):
    QUEUED = "QUEUED"
    IN_PROGRESS = "IN_PROGRESS"
    ENRICHED = "ENRICHED"
    ENRICHMENT_FAILED = "ENRICHMENT_FAILED"
    NO_PROFILES_FOUND = "NO_PROFILES_FOUND"


class CandidateSocialLinks(BaseModel):
    github_username: str | None = None
    linkedin_url: str | None = None


class GitHubRepo(BaseModel):
    name: str
    language: str | None
    size: int


class GitHubProfile(BaseModel):
    public_repos_count: int
    top_languages: Dict[str, float]
    readme_content: str | None
    repos: List[GitHubRepo]


class LinkedInExperience(BaseModel):
    title: str
    company: str
    start_date: str | None
    end_date: str | None
    description: str | None


class LinkedInEducation(BaseModel):
    school: str
    degree: str | None
    field_of_study: str | None
    start_date: str | None
    end_date: str | None


class LinkedInCertification(BaseModel):
    name: str
    issuing_organization: str
    issue_date: str | None
    expiration_date: str | None


class LinkedInProfile(BaseModel):
    experiences: List[LinkedInExperience]
    educations: List[LinkedInEducation]
    certifications: List[LinkedInCertification]


class TechnicalSkillMatrix(BaseModel):
    pre_enrichment: List[float]
    post_enrichment: List[float]


class MockAnalytics(BaseModel):
    match_confidence_score: float
    score_increase: float
    semantic_tags: List[str]
    technical_skill_matrix: TechnicalSkillMatrix


class EnrichedProfile(BaseModel):
    github: GitHubProfile | None = None
    linkedin: LinkedInProfile | None = None
    analytics: MockAnalytics


class CandidateEnrichment(BaseModel):
    candidate_uuid: str
    enrichment_status: EnrichmentStatus
    enriched_profile: EnrichedProfile | None = None
    updated_at: str | None = None
