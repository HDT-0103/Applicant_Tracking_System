from typing import Any
from src.backend.app.database.connection import supabase


class BaseRepository:
    """Base class for repository access via Supabase."""

    def __init__(self, session: Any = None):
        self.session = session
        self.client = session or supabase