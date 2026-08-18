from typing import Annotated
from fastapi import Depends
from supabase import Client, create_client
from src.backend.modules.shared.infrastructure.config import Settings, get_settings

def get_supabase_client(
    settings: Annotated[Settings, Depends(get_settings)]
) -> Client:
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)

def get_supabase_admin_client(
    settings: Annotated[Settings, Depends(get_settings)]
) -> Client:
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)