"""
Supabase Database Models for SmartATS
Pydantic models matching the Supabase database schema
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from enum import Enum


class RoleType(str, Enum):
    """Role type enum as defined in public.role_type"""
    ADMIN = "admin"
    HR_MANAGER = "hr_manager"
    TECH_LEAD = "tech_lead"
    INTERVIEWER = "interviewer"
    CANDIDATE = "candidate"


class User(BaseModel):
    """User table model matching public.users table"""
    id: str
    email: EmailStr
    name: str
    role: RoleType
    picture: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class UserInsert(BaseModel):
    """User model for insert operations (excludes auto-generated fields)"""
    email: EmailStr
    name: str
    role: RoleType
    picture: Optional[str] = None
    is_active: bool = True


class UserUpdate(BaseModel):
    """User model for update operations"""
    name: Optional[str] = None
    picture: Optional[str] = None
    is_active: Optional[bool] = None


class GithubRepo(BaseModel):
    """GitHub repository model for repos JSONB column (matches sample_github.json)"""
    name: str
    language: Optional[str] = None
    size: int = 0
    
    class Config:
        from_attributes = True


class GithubProfile(BaseModel):
    """GitHub profile model matching public.github_profiles table"""
    id: str
    candidate_uuid: str
    public_repos_count: int = 0
    top_languages: Dict[str, float] = {}  # JSONB: { "Python": 60.3, "Jupyter Notebook": 10.6 }
    readme_content: Optional[str] = None
    repos: List[GithubRepo] = []  # JSONB: array of repository objects
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class GithubProfileInsert(BaseModel):
    """GitHub profile model for insert operations"""
    candidate_uuid: str
    public_repos_count: int = 0
    top_languages: Dict[str, float] = {}
    readme_content: Optional[str] = None
    repos: List[GithubRepo] = []


class GithubProfileUpdate(BaseModel):
    """GitHub profile model for update operations"""
    public_repos_count: Optional[int] = None
    top_languages: Optional[Dict[str, float]] = None
    readme_content: Optional[str] = None
    repos: Optional[List[GithubRepo]] = None


class LinkedinExperience(BaseModel):
    """LinkedIn experience model for experience JSONB column (matches sample_linkedin.json)"""
    title: str
    company: str
    location: Optional[str] = None
    description: Optional[str] = None
    duration: Optional[str] = None
    start_date: Optional[Dict[str, int]] = None  # { "year": 2024, "month": "Jan" }
    end_date: Optional[Dict[str, int]] = None
    is_current: bool = False
    company_linkedin_url: Optional[str] = None
    company_logo_url: Optional[str] = None
    employment_type: Optional[str] = None
    location_type: Optional[str] = None
    company_id: Optional[str] = None
    skills: Optional[List[str]] = []
    skills_url: Optional[str] = None


class LinkedinEducation(BaseModel):
    """LinkedIn education model for education JSONB column (matches sample_linkedin.json)"""
    school: str
    degree: str
    degree_name: Optional[str] = None
    field_of_study: Optional[str] = None
    duration: Optional[str] = None
    school_linkedin_url: Optional[str] = None
    description: Optional[str] = None
    activities: Optional[str] = None
    school_logo_url: Optional[str] = None
    start_date: Optional[Dict[str, int]] = None  # { "year": 2021, "month": "Jul" }
    end_date: Optional[Dict[str, int]] = None
    school_id: Optional[str] = None


class LinkedinProfile(BaseModel):
    """LinkedIn profile model matching public.linkedin_profiles table"""
    id: str
    candidate_uuid: str
    full_name: Optional[str] = None
    headline: Optional[str] = None
    profile_url: Optional[str] = None
    avatar_url: Optional[str] = None
    experiences: List[LinkedinExperience] = []  # JSONB: array of work experience
    educations: List[LinkedinEducation] = []  # JSONB: array of education
    certifications: List[Dict[str, Any]] = []  # JSONB: array of certifications
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class LinkedinProfileInsert(BaseModel):
    """LinkedIn profile model for insert operations (matches actual schema)"""
    candidate_uuid: str
    full_name: Optional[str] = None
    headline: Optional[str] = None
    profile_url: Optional[str] = None
    avatar_url: Optional[str] = None
    experiences: List[LinkedinExperience] = []
    educations: List[LinkedinEducation] = []
    certifications: List[Dict[str, Any]] = []


class LinkedinProfileUpdate(BaseModel):
    """LinkedIn profile model for update operations (matches actual schema)"""
    full_name: Optional[str] = None
    headline: Optional[str] = None
    profile_url: Optional[str] = None
    avatar_url: Optional[str] = None
    experiences: Optional[List[LinkedinExperience]] = None
    educations: Optional[List[LinkedinEducation]] = None
    certifications: Optional[List[Dict[str, Any]]] = None


class ScrapedGithubData(BaseModel):
    """Raw scraped data structure from GitHub scraper"""
    username: str
    profile_url: str
    public_repos: int
    top_languages: Dict[str, int]
    readme_content: Optional[str] = None
    repos: List[Dict[str, Any]]


class ScrapedLinkedinData(BaseModel):
    """Raw scraped data structure from LinkedIn scraper (matches sample_linkedin.json)"""
    profile_url: Optional[str] = None
    headline: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    experience: List[Dict[str, Any]] = []
    education: List[Dict[str, Any]] = []
    certifications: List[Dict[str, Any]] = []


class GoogleOAuthSession(BaseModel):
    """Google OAuth session data"""
    provider: str = "google"
    access_token: str
    refresh_token: Optional[str] = None
    expires_at: Optional[int] = None
    token_type: str
    user: Dict[str, Any]


class AuthResult(BaseModel):
    """Authentication result"""
    success: bool
    user: Optional[User] = None
    error: Optional[str] = None


class SupabaseResponse(BaseModel):
    """Generic Supabase response wrapper"""
    data: Optional[Any] = None
    error: Optional[str] = None
    count: Optional[int] = None
