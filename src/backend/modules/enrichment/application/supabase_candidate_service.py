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
    
    async def ensure_candidate_exists(self, candidate_uuid: str, cv_file_path: Optional[str] = None) -> bool:
        """
        Ensure candidate exists in public.candidates table
        If not exists, create a new record with minimal data matching exact schema
        
        Schema DDL for public.candidates:
        - uuid (varchar(36), PK)
        - full_name (varchar(255), nullable)
        - github_username (varchar(255), nullable)
        - linkedin_url (text, nullable)
        - resume_text (text, nullable)
        - status (varchar(50), NOT NULL, default 'CREATED')
        - created_at (timestamptz, NOT NULL, default now())
        - updated_at (timestamptz, NOT NULL, default now())
        - cv_file_path (text, nullable)
        
        Args:
            candidate_uuid: The UUID of the candidate
            cv_file_path: Azure Blob Storage URL for CV (optional)
        
        Returns:
            True if candidate exists or was created successfully
        """
        try:
            # Check if candidate exists
            result = self._client.table('candidates').select('*').eq(
                'uuid', candidate_uuid
            ).execute()
            
            if result.data and len(result.data) > 0:
                logger.info(
                    "candidate.exists",
                    candidate_uuid=candidate_uuid
                )
                return True
            
            # Candidate doesn't exist - create minimal record matching exact schema
            logger.info(
                "candidate.not_found.creating",
                candidate_uuid=candidate_uuid,
                cv_file_path=cv_file_path
            )
            
            # Only include fields that exist in schema (Rule B: No invalid columns)
            new_candidate = {
                "uuid": candidate_uuid,
                "status": "CREATED",
                "cv_file_path": cv_file_path
            }
            
            insert_result = self._client.table('candidates').insert(new_candidate).execute()
            
            if insert_result.data:
                logger.info(
                    "candidate.created",
                    candidate_uuid=candidate_uuid,
                    cv_file_path=cv_file_path
                )
                return True
            else:
                logger.error(
                    "candidate.create_failed",
                    candidate_uuid=candidate_uuid,
                    error="No data returned from insert"
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
            update_data = {"updated_at": "now()"}
            
            if github_username is not None:
                update_data["github_username"] = github_username
            
            if linkedin_url is not None:
                update_data["linkedin_url"] = linkedin_url
            
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
