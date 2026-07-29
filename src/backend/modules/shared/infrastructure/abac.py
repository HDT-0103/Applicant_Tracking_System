from typing import Any

import structlog

logger = structlog.get_logger(__name__)

ABAC_POLICY: dict[str, dict[str, str]] = {
    "tech_lead": {
        "full_name": "redact",
        "email": "redact",
        "phone": "redact",
        "address": "redact",
        "salary_expectation": "redact",
        "github_username": "passthrough",
        "linkedin_url": "passthrough",
        "github": "passthrough",
        "linkedin": "passthrough",
        "analytics": "passthrough",
        "skills": "passthrough",
        "experience": "passthrough",
        "career_timeline": "passthrough",
        "technical_skill_matrix": "passthrough",
        "match_confidence_score": "passthrough",
    },
    "hr": {},
    "admin": {},
}

_REDACTED = "***"


def _apply_field(value: Any, strategy: str) -> Any:
    if strategy == "passthrough":
        return value
    if strategy == "redact":
        return _REDACTED
    return value


def apply_abac(data: dict, role: str) -> dict:
    """Recursively mask fields in *data* per *role*'s ABAC policy."""
    policy = ABAC_POLICY.get(role, {})
    if not policy:
        return data

    result: dict = {}
    for key, value in data.items():
        strategy = policy.get(key, "passthrough")
        if isinstance(value, dict):
            result[key] = apply_abac(value, role)
        elif isinstance(value, list) and value and isinstance(value[0], dict):
            result[key] = [apply_abac(item, role) for item in value]
        else:
            result[key] = _apply_field(value, strategy)
    return result
