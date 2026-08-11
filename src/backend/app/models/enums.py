import enum


class CandidateStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ARCHIVED = "archived"


class RoleType(str, enum.Enum):
    HR = "hr"
    TECH_LEAD = "tech_lead"
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
    IN_PROGRESS = "IN_PROGRESS"
    ENRICHED = "ENRICHED"
    ENRICHMENT_FAILED = "ENRICHMENT_FAILED"
    NO_PROFILES_FOUND = "NO_PROFILES_FOUND"


class EmbeddingSource(str, enum.Enum):
    SUMMARY = "summary"
    EXPERIENCE = "experience"
    GITHUB = "github"
    LINKEDIN = "linkedin"


class JobEmbeddingSource(str, enum.Enum):
    SUMMARY = "summary"
    REQUIREMENTS = "requirements"


class ReviewDecision(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class AuditAction(str, enum.Enum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    REVIEW_SUBMIT = "REVIEW_SUBMIT"
    REVIEW_RESOLVE = "REVIEW_RESOLVE"
    SLOT_CONFIRM = "SLOT_CONFIRM"
    SCHEDULE_SEARCH = "SCHEDULE_SEARCH"
    ENRICHMENT_START = "ENRICHMENT_START"
    ENRICHMENT_COMPLETE = "ENRICHMENT_COMPLETE"
    CALENDAR_KEY_UPDATE = "CALENDAR_KEY_UPDATE"
    UPLOAD_RESUME = "UPLOAD_RESUME"
    CANDIDATE_SEARCH = "CANDIDATE_SEARCH"