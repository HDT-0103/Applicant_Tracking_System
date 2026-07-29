"""
Supabase Client Configuration for SmartATS
Provides Supabase client instances for database operations
"""

import os
from typing import Optional
from supabase import create_client, Client
from modules.shared.infrastructure.config import Settings


class SupabaseClientManager:
    """
    Manages Supabase client instances for database operations
    """
    
    def __init__(self, settings: Settings):
        self._settings = settings
        self._client: Optional[Client] = None
        self._admin_client: Optional[Client] = None
    
    @property
    def supabase_url(self) -> Optional[str]:
        """Get Supabase URL from environment or settings"""
        url = os.getenv("SUPABASE_URL") or getattr(self._settings, "supabase_url", None)
        return url
    
    @property
    def supabase_anon_key(self) -> Optional[str]:
        """Get Supabase anon key from environment or settings"""
        key = os.getenv("SUPABASE_ANON_KEY") or getattr(self._settings, "supabase_anon_key", None)
        return key
    
    @property
    def supabase_service_key(self) -> Optional[str]:
        """Get Supabase service role key from environment or settings"""
        key = os.getenv("SUPABASE_SERVICE_KEY") or getattr(self._settings, "supabase_service_key", None)
        return key
    
    @property
    def client(self) -> Optional[Client]:
        """
        Get public Supabase client for client-side operations
        Uses anon key with RLS policies
        Returns None if Supabase is not configured
        """
        if self._client is None:
            if not self.supabase_url or not self.supabase_anon_key:
                return None
            self._client = create_client(
                self.supabase_url,
                self.supabase_anon_key
            )
        return self._client
    
    @property
    def admin_client(self) -> Optional[Client]:
        """
        Get admin Supabase client for server-side operations
        Uses service role key to bypass RLS policies
        WARNING: Only use on server-side, never expose to client
        Returns None if Supabase is not configured
        """
        if self._admin_client is None:
            if not self.supabase_url or not self.supabase_service_key:
                return None
            self._admin_client = create_client(
                self.supabase_url,
                self.supabase_service_key
            )
        return self._admin_client
    
    def get_client(self, use_admin: bool = False) -> Optional[Client]:
        """
        Get appropriate client based on context
        
        Args:
            use_admin: Whether to use admin client (server-side only)
        
        Returns:
            Supabase client instance or None if not configured
        """
        if use_admin:
            if hasattr(self, '_is_client_side') and self._is_client_side:
                print("WARNING: Attempting to use admin client on client-side. This is a security risk.")
            return self.admin_client
        return self.client
    
    def is_configured(self) -> bool:
        """
        Check if Supabase is properly configured
        
        Returns:
            True if Supabase credentials are available
        """
        return bool(self.supabase_url and (self.supabase_anon_key or self.supabase_service_key))


# Global instance for dependency injection
_supabase_manager: Optional[SupabaseClientManager] = None


def get_supabase_manager(settings: Settings) -> SupabaseClientManager:
    """
    Get or create Supabase client manager instance
    
    Args:
        settings: Application settings
    
    Returns:
        SupabaseClientManager instance
    """
    global _supabase_manager
    if _supabase_manager is None:
        _supabase_manager = SupabaseClientManager(settings)
    return _supabase_manager


def get_supabase_client(settings: Settings, use_admin: bool = False) -> Client:
    """
    Convenience function to get Supabase client
    
    Args:
        settings: Application settings
        use_admin: Whether to use admin client
    
    Returns:
        Supabase client instance
    """
    manager = get_supabase_manager(settings)
    return manager.get_client(use_admin)
