"""
Supabase Candidate Service for SmartATS
Handles candidate record management in Supabase for enrichment workflow
"""

import structlog
from typing import Optional, Dict, Any
from supabase import Client

from modules.shared.infrastructure.config import Settings

logger = structlog.get_logger(__name__)


class SupabaseCandidateService:
    """
    Service for managing candidate records in Supabase
    Ensures candidate exists before enrichment operations
    """
    
    def __init__(self, settings: Settings, supabase_client: Client):
        self._settings = settings
        self._client = supabase_client
    
    async def ensure_candidate_exists(
        self,
        candidate_uuid: str,
        cv_file_path: Optional[str] = None,
        full_name: Optional[str] = None,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        linkedin_url: Optional[str] = None,
        github_username: Optional[str] = None,
    ) -> bool:
        """
        Ensure candidate exists in public.candidates table
        Uses UPSERT to handle race conditions where the record may already exist.
        
        Args:
            candidate_uuid: The UUID of the candidate
            cv_file_path: Azure Blob Storage URL for CV (optional)
            full_name: Candidate's full name (optional)
            email: Candidate's email (optional)
            phone: Candidate's phone (optional)
            linkedin_url: LinkedIn profile URL (optional)
            github_username: GitHub username (optional)
        
        Returns:
            True if candidate exists or was created successfully
        """
        try:
            new_candidate = {
                "uuid": candidate_uuid,
                "status": "CREATED",
                "cv_file_path": cv_file_path
            }
            
            if full_name:
                new_candidate["full_name"] = full_name
            if email:
                new_candidate["email"] = email
            if phone:
                new_candidate["phone"] = phone
            if linkedin_url:
                new_candidate["linkedin_url"] = linkedin_url
            if github_username:
                new_candidate["github_username"] = github_username
            
            result = self._client.table('candidates').upsert(
                new_candidate,
                on_conflict='uuid'
            ).execute()
            
            if result.data:
                logger.info(
                    "candidate.upserted",
                    candidate_uuid=candidate_uuid,
                    cv_file_path=cv_file_path
                )
                return True
            else:
                logger.error(
                    "candidate.upsert_failed",
                    candidate_uuid=candidate_uuid,
                    error="No data returned from upsert"
                )
                return False
                
        except Exception as e:
            logger.error(
                "candidate.ensure_failed",
                candidate_uuid=candidate_uuid,
                error=str(e)
            )
            return False
    
    async def update_candidate_social_links(
        self,
        candidate_uuid: str,
        github_username: Optional[str] = None,
        linkedin_url: Optional[str] = None
    ) -> bool:
        """
        Update candidate's social links in Supabase
        
        Args:
            candidate_uuid: The UUID of the candidate
            github_username: GitHub username (optional)
            linkedin_url: LinkedIn profile URL (optional)
        
        Returns:
            True if update successful
        """
        try:
            update_data = {}
            
            if github_username is not None:
                update_data["github_username"] = github_username
            
            if linkedin_url is not None:
                update_data["linkedin_url"] = linkedin_url
            
            if not update_data:
                return True
            
            result = self._client.table('candidates').update(
                update_data
            ).eq('uuid', candidate_uuid).execute()
            
            if result.data:
                logger.info(
                    "candidate.social_links.updated",
                    candidate_uuid=candidate_uuid,
                    github_username=github_username,
                    linkedin_url=linkedin_url
                )
                return True
            else:
                logger.warning(
                    "candidate.social_links.update_no_effect",
                    candidate_uuid=candidate_uuid
                )
                return False
                
        except Exception as e:
            logger.error(
                "candidate.social_links.update_failed",
                candidate_uuid=candidate_uuid,
                error=str(e)
            )
            return False
    
    async def get_candidate(self, candidate_uuid: str) -> Optional[Dict[str, Any]]:
        """
        Get candidate record from Supabase
        
        Args:
            candidate_uuid: The UUID of the candidate
        
        Returns:
            Candidate data dict or None if not found
        """
        try:
            result = self._client.table('candidates').select('*').eq(
                'uuid', candidate_uuid
            ).execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0]
            else:
                return None
                
        except Exception as e:
            logger.error(
                "candidate.get_failed",
                candidate_uuid=candidate_uuid,
                error=str(e)
            )
            return None
