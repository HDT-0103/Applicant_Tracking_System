from datetime import datetime, timezone
from typing import Dict, Optional, Any
import structlog
import os
import json

from .models import CandidateRecord

logger = structlog.get_logger(__name__)

DATA_DIR = "./stored_data"
os.makedirs(DATA_DIR, exist_ok=True)

candidate_store: Dict[str, CandidateRecord] = {}
github_data_store: Dict[str, Dict] = {}
linkedin_data_store: Dict[str, Dict] = {}


def save_candidate(candidate: CandidateRecord) -> CandidateRecord:
    logger.debug("candidate_repository.save", uuid=candidate.uuid, github_username=candidate.github_username, linkedin_url=candidate.linkedin_url)
    candidate_store[candidate.uuid] = candidate
    return candidate


def get_candidate(uuid: str) -> Optional[CandidateRecord]:
    candidate = candidate_store.get(uuid)
    if candidate:
        logger.debug(
            "candidate_repository.get.found",
            uuid=uuid,
            github_username=candidate.github_username,
            linkedin_url=candidate.linkedin_url,
            full_name=candidate.full_name,
        )
    else:
        logger.debug("candidate_repository.get.not_found", uuid=uuid)
    return candidate


def update_candidate(uuid: str, **kwargs) -> Optional[CandidateRecord]:
    candidate = candidate_store.get(uuid)
    if not candidate:
        logger.warning("candidate_repository.update.not_found", uuid=uuid)
        return None
    for key, value in kwargs.items():
        setattr(candidate, key, value)
    candidate.updated_at = datetime.now(timezone.utc).isoformat()
    logger.debug("candidate_repository.update", uuid=uuid, updates=kwargs)
    return candidate


def save_github_data(candidate_uuid: str, github_data: Dict) -> bool:
    """Lưu dữ liệu GitHub (repos, README content) vào database và file JSON."""
    try:
        payload = {
            "data": github_data,
            "saved_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Lưu vào RAM
        github_data_store[candidate_uuid] = payload
        
        # Ghi xuống file JSON
        file_path = os.path.join(DATA_DIR, f"github_{candidate_uuid}.json")
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=4)
        
        logger.info(
            "github.scraped.saved_to_db",
            candidate_uuid=candidate_uuid,
            repo_count=len(github_data.get("repos", [])),
            has_readme=bool(github_data.get("readme_content"))
        )
        logger.info("github.scraped.saved_to_disk", path=file_path)
        return True
    except Exception as e:
        logger.error("github.scraped.save_failed", candidate_uuid=candidate_uuid, error=str(e))
        return False


def save_linkedin_data(candidate_uuid: str, linkedin_data: Dict) -> bool:
    """Lưu dữ liệu LinkedIn (profile, experiences, educations) vào database và file JSON."""
    try:
        payload = {
            "data": linkedin_data,
            "saved_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Lưu vào RAM
        linkedin_data_store[candidate_uuid] = payload
        
        # Ghi xuống file JSON
        file_path = os.path.join(DATA_DIR, f"linkedin_{candidate_uuid}.json")
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=4)
        
        logger.info(
            "linkedin.scraped.saved_to_db",
            candidate_uuid=candidate_uuid,
            full_name=linkedin_data.get("full_name"),
            experiences_count=len(linkedin_data.get("experiences", [])),
            educations_count=len(linkedin_data.get("educations", []))
        )
        logger.info("linkedin.scraped.saved_to_disk", path=file_path)
        return True
    except Exception as e:
        logger.error("linkedin.scraped.save_failed", candidate_uuid=candidate_uuid, error=str(e))
        return False


def get_github_data(candidate_uuid: str) -> Optional[Dict]:
    """Lấy dữ liệu GitHub đã lưu từ database hoặc cache hydration từ disk."""
    # Kiểm tra RAM trước
    if candidate_uuid in github_data_store:
        return github_data_store[candidate_uuid]
    
    # Cache hydration: Thử đọc từ file JSON nếu không có trong RAM
    file_path = os.path.join(DATA_DIR, f"github_{candidate_uuid}.json")
    if os.path.exists(file_path):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                github_data_store[candidate_uuid] = data
                logger.info("github.data.hydrated_from_disk", candidate_uuid=candidate_uuid, path=file_path)
                return data
        except Exception as e:
            logger.error("github.data.hydrate_failed", candidate_uuid=candidate_uuid, error=str(e))
    
    return None


def get_linkedin_data(candidate_uuid: str) -> Optional[Dict]:
    """Lấy dữ liệu LinkedIn đã lưu từ database hoặc cache hydration từ disk."""
    # Kiểm tra RAM trước
    if candidate_uuid in linkedin_data_store:
        return linkedin_data_store[candidate_uuid]
    
    # Cache hydration: Thử đọc từ file JSON nếu không có trong RAM
    file_path = os.path.join(DATA_DIR, f"linkedin_{candidate_uuid}.json")
    if os.path.exists(file_path):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                linkedin_data_store[candidate_uuid] = data
                logger.info("linkedin.data.hydrated_from_disk", candidate_uuid=candidate_uuid, path=file_path)
                return data
        except Exception as e:
            logger.error("linkedin.data.hydrate_failed", candidate_uuid=candidate_uuid, error=str(e))
    
    return None
