"""
GitHub Ingestion Service for SmartATS
Handles saving scraped GitHub data to Supabase with UPSERT logic
"""

import structlog
from typing import Optional, List, Dict, Any
from supabase import Client

from modules.shared.domain.supabase_models import (
    GithubProfile,
    GithubProfileInsert,
    GithubProfileUpdate,
    ScrapedGithubData,
    SupabaseResponse,
)
from modules.shared.infrastructure.config import Settings

logger = structlog.get_logger(__name__)


class GitHubIngestionService:
    """
    Service for ingesting GitHub profile data into Supabase
    """
    
    def __init__(self, settings: Settings, supabase_client: Client):
        self._settings = settings
        self._client = supabase_client
    
    def save_scraped_github_data(
        self,
        candidate_uuid: str,
        scraped_data: ScrapedGithubData,
        use_admin: bool = True
    ) -> SupabaseResponse:
        """
        Save scraped GitHub data to Supabase with UPSERT logic
        
        This function performs an UPSERT operation (INSERT or UPDATE) based on the
        unique constraint `uq_github_profile_candidate` on the candidate_uuid column.
        
        Args:
            candidate_uuid: The UUID of the candidate in the candidates table
            scraped_data: Raw scraped data from GitHub scraper
            use_admin: Whether to use admin client (default: True)
        
        Returns:
            SupabaseResponse with the saved/updated GitHub profile or error
        """
        try:
            # Validate required fields
            if not candidate_uuid:
                raise ValueError("candidate_uuid is required")
            
            if not scraped_data or not isinstance(scraped_data, dict):
                raise ValueError("scraped_data must be a valid object")
            
            # Map scraped data to database schema (matches sample_github.json structure)
            # sample_github.json has: data.public_repos_count, data.top_languages, data.readme_content, data.repos
            profile_data = GithubProfileInsert(
                candidate_uuid=candidate_uuid,
                public_repos_count=scraped_data.get("public_repos_count", 0),
                top_languages=scraped_data.get("top_languages", {}),
                readme_content=scraped_data.get("readme_content"),
                repos=scraped_data.get("repos", [])
            )
            
            # Convert to dict for Supabase
            profile_dict = profile_data.model_dump(mode='json', exclude_none=True)
            
            # Perform UPSERT operation
            # The on_conflict clause specifies the unique constraint to handle duplicates
            result = self._client.table('github_profiles').upsert(
                profile_dict,
                on_conflict='candidate_uuid'  # Matches the unique constraint
            ).execute()
            
            if result.data:
                logger.info(
                    "github.ingestion.success",
                    candidate_uuid=candidate_uuid,
                    repos_count=len(profile_dict.get("repos", []))
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
                "github.ingestion.failed",
                candidate_uuid=candidate_uuid,
                error=str(e)
            )
            return SupabaseResponse(
                data=None,
                error=str(e),
                count=None
            )
    
    def get_github_profile_by_candidate(
        self,
        candidate_uuid: str,
        use_admin: bool = True
    ) -> SupabaseResponse:
        """
        Get GitHub profile by candidate UUID
        
        Args:
            candidate_uuid: The UUID of the candidate
            use_admin: Whether to use admin client (default: True)
        
        Returns:
            SupabaseResponse with the GitHub profile or error
        """
        try:
            if not candidate_uuid:
                raise ValueError("candidate_uuid is required")
            
            result = self._client.table('github_profiles').select('*').eq(
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
                "github.ingestion.fetch_failed",
                candidate_uuid=candidate_uuid,
                error=str(e)
            )
            return SupabaseResponse(
                data=None,
                error=str(e),
                count=None
            )
    
    def delete_github_profile(
        self,
        candidate_uuid: str,
        use_admin: bool = True
    ) -> SupabaseResponse:
        """
        Delete GitHub profile by candidate UUID
        
        Args:
            candidate_uuid: The UUID of the candidate
            use_admin: Whether to use admin client (default: True)
        
        Returns:
            SupabaseResponse with success status or error
        """
        try:
            if not candidate_uuid:
                raise ValueError("candidate_uuid is required")
            
            result = self._client.table('github_profiles').delete().eq(
                'candidate_uuid', candidate_uuid
            ).execute()
            
            logger.info(
                "github.ingestion.deleted",
                candidate_uuid=candidate_uuid
            )
            
            return SupabaseResponse(
                data=None,
                error=None,
                count=len(result.data) if result.data else 0
            )
            
        except Exception as e:
            logger.error(
                "github.ingestion.delete_failed",
                candidate_uuid=candidate_uuid,
                error=str(e)
            )
            return SupabaseResponse(
                data=None,
                error=str(e),
                count=None
            )
    
    def batch_save_github_profiles(
        self,
        profiles_data: List[Dict[str, Any]],
        use_admin: bool = True
    ) -> SupabaseResponse:
        """
        Batch save multiple GitHub profiles
        
        Args:
            profiles_data: Array of { candidate_uuid, scraped_data } objects
            use_admin: Whether to use admin client (default: True)
        
        Returns:
            SupabaseResponse with results for each profile
        """
        try:
            if not profiles_data or len(profiles_data) == 0:
                raise ValueError("profiles_data must be a non-empty array")
            
            # Map all scraped data to database schema
            profiles_to_insert = []
            for item in profiles_data:
                profile_data = GithubProfileInsert(
                    candidate_uuid=item["candidate_uuid"],
                    public_repos_count=item["scraped_data"].get("public_repos", 0),
                    top_languages=item["scraped_data"].get("top_languages", {}),
                    readme_content=item["scraped_data"].get("readme_content"),
                    repos=item["scraped_data"].get("repos", [])
                )
                profiles_to_insert.append(profile_data.model_dump(mode='json', exclude_none=True))
            
            # Perform batch UPSERT
            result = self._client.table('github_profiles').upsert(
                profiles_to_insert,
                on_conflict='candidate_uuid'
            ).execute()
            
            logger.info(
                "github.ingestion.batch_success",
                count=len(profiles_to_insert)
            )
            
            return SupabaseResponse(
                data=result.data,
                error=None,
                count=len(result.data) if result.data else 0
            )
            
        except Exception as e:
            logger.error(
                "github.ingestion.batch_failed",
                error=str(e)
            )
            return SupabaseResponse(
                data=None,
                error=str(e),
                count=None
            )
    
    def update_github_profile(
        self,
        candidate_uuid: str,
        updates: GithubProfileUpdate,
        use_admin: bool = True
    ) -> SupabaseResponse:
        """
        Update specific fields of a GitHub profile
        
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
                raise ValueError("updates must be a valid GithubProfileUpdate object")
            
            # Convert to dict, excluding None values
            update_dict = updates.model_dump(mode='json', exclude_none=True)
            
            if not update_dict:
                raise ValueError("updates must contain at least one field")
            
            result = self._client.table('github_profiles').update(
                update_dict
            ).eq('candidate_uuid', candidate_uuid).select().execute()
            
            if result.data and len(result.data) > 0:
                logger.info(
                    "github.ingestion.updated",
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
                "github.ingestion.update_failed",
                candidate_uuid=candidate_uuid,
                error=str(e)
            )
            return SupabaseResponse(
                data=None,
                error=str(e),
                count=None
            )
