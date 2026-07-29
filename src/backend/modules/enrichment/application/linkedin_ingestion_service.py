"""
LinkedIn Ingestion Service for SmartATS
Handles saving scraped LinkedIn data to Supabase with UPSERT logic
"""

import structlog
from typing import Optional, List, Dict, Any
from supabase import Client

from modules.shared.domain.supabase_models import (
    LinkedinProfile,
    LinkedinProfileInsert,
    LinkedinProfileUpdate,
    ScrapedLinkedinData,
    SupabaseResponse,
)
from modules.shared.infrastructure.config import Settings

logger = structlog.get_logger(__name__)


class LinkedInIngestionService:
    """
    Service for ingesting LinkedIn profile data into Supabase
    """
    
    def __init__(self, settings: Settings, supabase_client: Client):
        self._settings = settings
        self._client = supabase_client
    
    def save_scraped_linkedin_data(
        self,
        candidate_uuid: str,
        scraped_data: ScrapedLinkedinData,
        use_admin: bool = True
    ) -> SupabaseResponse:
        """
        Save scraped LinkedIn data to Supabase with UPSERT logic
        
        This function performs an UPSERT operation (INSERT or UPDATE) based on the
        unique constraint on the candidate_uuid column.
        
        Args:
            candidate_uuid: The UUID of the candidate in the candidates table
            scraped_data: Raw scraped data from LinkedIn scraper
            use_admin: Whether to use admin client (default: True)
        
        Returns:
            SupabaseResponse with the saved/updated LinkedIn profile or error
        """
        try:
            # Validate required fields
            if not candidate_uuid:
                raise ValueError("candidate_uuid is required")
            
            if not scraped_data or not isinstance(scraped_data, dict):
                raise ValueError("scraped_data must be a valid object")
            
            # Map scraped data to database schema (matches actual DDL)
            profile_data = LinkedinProfileInsert(
                candidate_uuid=candidate_uuid,
                full_name=scraped_data.get("full_name"),
                headline=scraped_data.get("headline"),
                profile_url=scraped_data.get("profile_url"),
                avatar_url=scraped_data.get("avatar_url"),
                experiences=scraped_data.get("experience", []),
                educations=scraped_data.get("education", []),
                certifications=scraped_data.get("certifications", [])
            )
            
            # Convert to dict for Supabase
            profile_dict = profile_data.model_dump(mode='json', exclude_none=True)
            
            # Perform UPSERT operation
            # The on_conflict clause specifies the unique constraint to handle duplicates
            result = self._client.table('linkedin_profiles').upsert(
                profile_dict,
                on_conflict='candidate_uuid'  # Matches the unique constraint
            ).execute()
            
            if result.data:
                logger.info(
                    "linkedin.ingestion.success",
                    candidate_uuid=candidate_uuid,
                    skills_count=len(profile_dict.get("skills", []))
                )
                return SupabaseResponse(
                    data=result.data[0] if result.data else None,
                    error=None,
                    count=len(result.data) if result.data else 0
                )
            else:
                raise ValueError("No data returned from Supabase upsert")
                
        except Exception as e:
            logger.error(
                "linkedin.ingestion.failed",
                candidate_uuid=candidate_uuid,
                error=str(e)
            )
            return SupabaseResponse(
                data=None,
                error=str(e),
                count=None
            )
    
    def get_linkedin_profile_by_candidate(
        self,
        candidate_uuid: str,
        use_admin: bool = True
    ) -> SupabaseResponse:
        """
        Get LinkedIn profile by candidate UUID
        
        Args:
            candidate_uuid: The UUID of the candidate
            use_admin: Whether to use admin client (default: True)
        
        Returns:
            SupabaseResponse with the LinkedIn profile or error
        """
        try:
            if not candidate_uuid:
                raise ValueError("candidate_uuid is required")
            
            result = self._client.table('linkedin_profiles').select('*').eq(
                'candidate_uuid', candidate_uuid
            ).execute()
            
            if result.data and len(result.data) > 0:
                return SupabaseResponse(
                    data=result.data[0],
                    error=None,
                    count=len(result.data)
                )
            else:
                # No record found - return null data without error
                return SupabaseResponse(
                    data=None,
                    error=None,
                    count=0
                )
                
        except Exception as e:
            logger.error(
                "linkedin.ingestion.fetch_failed",
                candidate_uuid=candidate_uuid,
                error=str(e)
            )
            return SupabaseResponse(
                data=None,
                error=str(e),
                count=None
            )
    
    def get_linkedin_profile_by_url(
        self,
        profile_url: str,
        use_admin: bool = True
    ) -> SupabaseResponse:
        """
        Get LinkedIn profile by profile URL
        
        Args:
            profile_url: The LinkedIn profile URL
            use_admin: Whether to use admin client (default: True)
        
        Returns:
            SupabaseResponse with the LinkedIn profile or error
        """
        try:
            if not profile_url:
                raise ValueError("profile_url is required")
            
            result = self._client.table('linkedin_profiles').select('*').eq(
                'profile_url', profile_url
            ).execute()
            
            if result.data and len(result.data) > 0:
                return SupabaseResponse(
                    data=result.data[0],
                    error=None,
                    count=len(result.data)
                )
            else:
                # No record found - return null data without error
                return SupabaseResponse(
                    data=None,
                    error=None,
                    count=0
                )
                
        except Exception as e:
            logger.error(
                "linkedin.ingestion.fetch_by_url_failed",
                profile_url=profile_url,
                error=str(e)
            )
            return SupabaseResponse(
                data=None,
                error=str(e),
                count=None
            )
    
    def delete_linkedin_profile(
        self,
        candidate_uuid: str,
        use_admin: bool = True
    ) -> SupabaseResponse:
        """
        Delete LinkedIn profile by candidate UUID
        
        Args:
            candidate_uuid: The UUID of the candidate
            use_admin: Whether to use admin client (default: True)
        
        Returns:
            SupabaseResponse with success status or error
        """
        try:
            if not candidate_uuid:
                raise ValueError("candidate_uuid is required")
            
            result = self._client.table('linkedin_profiles').delete().eq(
                'candidate_uuid', candidate_uuid
            ).execute()
            
            logger.info(
                "linkedin.ingestion.deleted",
                candidate_uuid=candidate_uuid
            )
            
            return SupabaseResponse(
                data=None,
                error=None,
                count=len(result.data) if result.data else 0
            )
            
        except Exception as e:
            logger.error(
                "linkedin.ingestion.delete_failed",
                candidate_uuid=candidate_uuid,
                error=str(e)
            )
            return SupabaseResponse(
                data=None,
                error=str(e),
                count=None
            )
    
    def batch_save_linkedin_profiles(
        self,
        profiles_data: List[Dict[str, Any]],
        use_admin: bool = True
    ) -> SupabaseResponse:
        """
        Batch save multiple LinkedIn profiles
        
        Args:
            profiles_data: Array of { candidate_uuid, scraped_data } objects
            use_admin: Whether to use admin client (default: True)
        
        Returns:
            SupabaseResponse with results for each profile
        """
        try:
            if not profiles_data or len(profiles_data) == 0:
                raise ValueError("profiles_data must be a non-empty array")
            
            # Map all scraped data to database schema (matches actual DDL)
            profiles_to_insert = []
            for item in profiles_data:
                profile_data = LinkedinProfileInsert(
                    candidate_uuid=item["candidate_uuid"],
                    full_name=item["scraped_data"].get("full_name"),
                    headline=item["scraped_data"].get("headline"),
                    profile_url=item["scraped_data"].get("profile_url"),
                    avatar_url=item["scraped_data"].get("avatar_url"),
                    experiences=item["scraped_data"].get("experience", []),
                    educations=item["scraped_data"].get("education", []),
                    certifications=item["scraped_data"].get("certifications", [])
                )
                profiles_to_insert.append(profile_data.model_dump(mode='json', exclude_none=True))
            
            # Perform batch UPSERT
            result = self._client.table('linkedin_profiles').upsert(
                profiles_to_insert,
                on_conflict='candidate_uuid'
            ).execute()
            
            logger.info(
                "linkedin.ingestion.batch_success",
                count=len(profiles_to_insert)
            )
            
            return SupabaseResponse(
                data=result.data,
                error=None,
                count=len(result.data) if result.data else 0
            )
            
        except Exception as e:
            logger.error(
                "linkedin.ingestion.batch_failed",
                error=str(e)
            )
            return SupabaseResponse(
                data=None,
                error=str(e),
                count=None
            )
    
    def update_linkedin_profile(
        self,
        candidate_uuid: str,
        updates: LinkedinProfileUpdate,
        use_admin: bool = True
    ) -> SupabaseResponse:
        """
        Update specific fields of a LinkedIn profile
        
        Args:
            candidate_uuid: The UUID of the candidate
            updates: Partial updates to apply
            use_admin: Whether to use admin client (default: True)
        
        Returns:
            SupabaseResponse with the updated profile or error
        """
        try:
            if not candidate_uuid:
                raise ValueError("candidate_uuid is required")
            
            if not updates or not hasattr(updates, 'model_dump'):
                raise ValueError("updates must be a valid LinkedinProfileUpdate object")
            
            # Convert to dict, excluding None values
            update_dict = updates.model_dump(mode='json', exclude_none=True)
            
            if not update_dict:
                raise ValueError("updates must contain at least one field")
            
            result = self._client.table('linkedin_profiles').update(
                update_dict
            ).eq('candidate_uuid', candidate_uuid).select().execute()
            
            if result.data and len(result.data) > 0:
                logger.info(
                    "linkedin.ingestion.updated",
                    candidate_uuid=candidate_uuid
                )
                return SupabaseResponse(
                    data=result.data[0],
                    error=None,
                    count=len(result.data)
                )
            else:
                raise ValueError("No data returned from Supabase update")
                
        except Exception as e:
            logger.error(
                "linkedin.ingestion.update_failed",
                candidate_uuid=candidate_uuid,
                error=str(e)
            )
            return SupabaseResponse(
                data=None,
                error=str(e),
                count=None
            )
