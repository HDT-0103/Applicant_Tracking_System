import enum


class CandidateStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ARCHIVED = "archived"


class RoleType(str, enum.Enum):
    ADMIN = "admin"
    RECRUITER = "recruiter"
    INTERVIEWER = "interviewer"
    CANDIDATE = "candidate"


class StatusType(str, enum.Enum):
    WAITING = "waiting"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"

class EnrichmentStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    
class EmbeddingSource(str, enum.Enum):
    SUMMARY = "summary"
    EXPERIENCE = "experience"
    GITHUB = "github"
    LINKEDIN = "linkedin"