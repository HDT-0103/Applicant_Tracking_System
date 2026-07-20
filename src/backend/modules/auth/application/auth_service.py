import structlog
from typing import Optional

from modules.auth.domain.models import (
    AuthTokenResponse,
    AuthUser,
    RefreshTokenResponse,
    UserRole,
)
from modules.auth.infra.google_verifier import GoogleTokenVerifier
from modules.auth.infra.jwt_service import JwtService
from modules.shared.infrastructure.config import Settings
from modules.shared.infrastructure.supabase_client import get_supabase_client
from modules.shared.domain.supabase_models import User, RoleType

logger = structlog.get_logger(__name__)


class AuthService:
    def __init__(
        self,
        settings: Settings,
        google_verifier: GoogleTokenVerifier,
        jwt_service: JwtService,
    ) -> None:
        self._settings = settings
        self._google_verifier = google_verifier
        self._jwt_service = jwt_service
        self._supabase_client = get_supabase_client(settings, use_admin=True)
        self._use_supabase = self._supabase_client is not None

    def resolve_role_from_supabase(self, email: str) -> UserRole:
        """
        Resolve user role by querying Supabase public.users table
        Only allows authentication if email exists and role is 'admin'
        
        Args:
            email: User email from Google OAuth
        
        Returns:
            UserRole if user exists and has admin role
        
        Raises:
            ValueError: If user not found or doesn't have admin role
        """
        try:
            # Query Supabase for user by email
            result = self._supabase_client.table('users').select('*').eq(
                'email', email
            ).eq('is_active', True).execute()
            
            if not result.data or len(result.data) == 0:
                raise ValueError(
                    f"Authentication failed: Email '{email}' not found in system. "
                    f"Please contact administrator."
                )
            
            user_data = result.data[0]
            
            # Verify user has admin role
            if user_data.get('role') != 'admin':
                raise ValueError(
                    f"Authentication failed: User '{email}' does not have admin privileges. "
                    f"Current role: {user_data.get('role')}"
                )
            
            return user_data.get('role')
            
        except ValueError:
            raise  # Re-raise ValueError with our custom message
        except Exception as e:
            logger.error("auth.supabase_query_failed", email=email, error=str(e))
            raise ValueError(f"Database query failed: {str(e)}")

    def resolve_role(self, email: str) -> UserRole:
        """
        Fallback role resolution using .env configuration
        This method is kept for backward compatibility but should not be used
        in production when Supabase is configured.
        
        Args:
            email: User email
        
        Returns:
            UserRole based on .env configuration
        """
        normalized_email = email.strip().lower()
        domain = normalized_email.split("@")[-1]

        if normalized_email in self._settings.admin_email_list:
            return "admin"

        if domain in self._settings.recruiter_domain_list:
            return "recruiter"

        return "interviewer"

    def login_with_google(self, credential: str, use_supabase: Optional[bool] = None) -> AuthTokenResponse:
        """
        Login with Google OAuth and verify admin role from Supabase
        
        Args:
            credential: Google OAuth credential token
            use_supabase: Whether to use Supabase for role verification (default: auto-detect)
        
        Returns:
            AuthTokenResponse with access token and user info
        
        Raises:
            ValueError: If authentication fails
        """
        profile = self._google_verifier.verify_credential(credential)
        
        # Auto-detect if Supabase is configured if use_supabase is not explicitly set
        if use_supabase is None:
            use_supabase = self._use_supabase
        
        # Use Supabase for role verification if configured and requested
        if use_supabase and self._supabase_client:
            try:
                role = self.resolve_role_from_supabase(profile["email"])
            except ValueError as e:
                # Re-raise with clear error message
                raise ValueError(str(e))
        else:
            # Fallback to .env-based role resolution
            role = self.resolve_role(profile["email"])

        user = AuthUser(
            id=profile["id"],
            email=profile["email"],
            name=profile["name"],
            role=role,
            picture=profile.get("picture"),
        )

        access_token = self._jwt_service.create_access_token(user)
        refresh_token = self._jwt_service.create_refresh_token(user)

        logger.info(
            "auth.login.success",
            user_id=user.id,
            email=user.email,
            role=user.role,
            auth_method="supabase" if (use_supabase and self._supabase_client) else "env_fallback"
        )

        return AuthTokenResponse(
            accessToken=access_token,
            refreshToken=refresh_token,
            user=user,
        )

    def refresh_tokens(self, refresh_token: str) -> RefreshTokenResponse:
        user = self._jwt_service.decode_token(refresh_token, expected_type="refresh")

        access_token = self._jwt_service.create_access_token(user)
        new_refresh_token = self._jwt_service.create_refresh_token(user)

        logger.info("auth.refresh.success", user_id=user.id, email=user.email)

        return RefreshTokenResponse(
            accessToken=access_token,
            refreshToken=new_refresh_token,
        )
