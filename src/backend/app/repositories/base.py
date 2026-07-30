from src.backend.app.database.connection import supabase


class BaseRepository:
    """Base class for repository access via Supabase."""

    def __init__(self, session):
        self.session = session
        self.client = supabase