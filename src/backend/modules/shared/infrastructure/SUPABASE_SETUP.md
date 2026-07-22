# Supabase Integration Setup for SmartATS

## Overview

This document explains how to integrate Supabase with the existing Python/FastAPI backend for SmartATS, replacing hardcoded .env configuration with database-driven authentication and data storage.

## Installation

Install the Supabase Python client:

```bash
pip install supabase>=2.0,<3.0
```

Or update requirements.txt (already included):
```
supabase>=2.0,<3.0
```

## Environment Variables

Add these variables to your `.env` file:

```bash
# Supabase Configuration
SUPABASE_URL=your-supabase-project-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_KEY=your-supabase-service-role-key

# LinkedIn Scraper Configuration
USE_SUPABASE=true  # Set to false to fallback to Excel file storage
```

## Database Schema

### Required Tables

```sql
-- Users table (for authentication)
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email character varying(255) NOT NULL,
  name character varying(255) NOT NULL,
  role public.role_type NOT NULL,
  picture text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pk_user PRIMARY KEY (id),
  CONSTRAINT uq_user_email UNIQUE (email)
);

-- GitHub profiles table
CREATE TABLE public.github_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  candidate_uuid character varying(36) NOT NULL,
  public_repos_count integer NOT NULL DEFAULT 0,
  top_languages jsonb NOT NULL DEFAULT '{}'::jsonb,
  readme_content text NULL,
  repos jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pk_github_profile PRIMARY KEY (id),
  CONSTRAINT uq_github_profile_candidate UNIQUE (candidate_uuid),
  CONSTRAINT fk_github_profile_candidate FOREIGN KEY (candidate_uuid) REFERENCES candidates (uuid) ON DELETE CASCADE
);

-- LinkedIn profiles table
CREATE TABLE public.linkedin_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  candidate_uuid character varying(36) NOT NULL,
  profile_url text NOT NULL,
  headline text NULL,
  location text NULL,
  industry text NULL,
  skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  experience jsonb NOT NULL DEFAULT '[]'::jsonb,
  education jsonb NOT NULL DEFAULT '[]'::jsonb,
  endorsements jsonb NOT NULL DEFAULT '{}'::jsonb,
  connections_count integer NULL,
  profile_picture_url text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pk_linkedin_profile PRIMARY KEY (id),
  CONSTRAINT uq_linkedin_profile_candidate UNIQUE (candidate_uuid),
  CONSTRAINT fk_linkedin_profile_candidate FOREIGN KEY (candidate_uuid) REFERENCES candidates (uuid) ON DELETE CASCADE
);

-- Role type enum
CREATE TYPE public.role_type AS ENUM ('admin', 'hr_manager', 'tech_lead', 'interviewer', 'candidate');
```

## Module Structure

```
src/backend/modules/
├── shared/
│   ├── infrastructure/
│   │   ├── supabase_client.py          # Supabase client configuration
│   │   └── config.py                   # Existing settings
│   └── domain/
│       └── supabase_models.py          # Pydantic models for Supabase schemas
├── auth/
│   └── application/
│       └── auth_service.py             # Refactored to use Supabase
└── enrichment/
    └── application/
        ├── github_ingestion_service.py  # GitHub data ingestion
        └── linkedin_ingestion_service.py # LinkedIn data ingestion
```

## Authentication Integration

### Changes to `auth_service.py`

The `AuthService` class has been refactored to:

1. **Query Supabase for user roles**: Instead of checking `.env` email lists, it queries the `public.users` table
2. **Admin-only authentication**: Only users with `role = 'admin'` can authenticate
3. **Fallback support**: Maintains backward compatibility with `.env` configuration

```python
# New method in AuthService
def resolve_role_from_supabase(self, email: str) -> UserRole:
    # Queries public.users table
    # Only returns 'admin' if user exists and has admin role
    # Raises ValueError if user not found or not admin
```

### Usage

```python
from modules.auth.application.auth_service import AuthService

# The login_with_google method now has a use_supabase parameter (default: True)
auth_service.login_with_google(credential, use_supabase=True)
```

## Data Ingestion Integration

### GitHub Ingestion

```python
from modules.enrichment.application.github_ingestion_service import GitHubIngestionService
from modules.shared.infrastructure.supabase_client import get_supabase_client
from modules.shared.infrastructure.config import Settings

# Initialize service
settings = Settings()
supabase_client = get_supabase_client(settings, use_admin=True)
github_service = GitHubIngestionService(settings, supabase_client)

# Save scraped data
scraped_data = {
    "username": "john-doe",
    "profile_url": "https://github.com/john-doe",
    "public_repos": 42,
    "top_languages": {"typescript": 15, "python": 10},
    "readme_content": "# My Projects",
    "repos": [...]
}

result = github_service.save_scraped_github_data(candidate_uuid, scraped_data)
```

### LinkedIn Ingestion

```python
from modules.enrichment.application.linkedin_ingestion_service import LinkedInIngestionService

# Initialize service
linkedin_service = LinkedInIngestionService(settings, supabase_client)

# Save scraped data
scraped_data = {
    "profile_url": "https://linkedin.com/in/john-doe",
    "headline": "Senior Software Engineer",
    "skills": ["TypeScript", "Python", "React"],
    "experience": [...],
    "education": [...],
    "endorsements": {"typescript": 10}
}

result = linkedin_service.save_scraped_linkedin_data(candidate_uuid, scraped_data)
```

## LinkedIn Scraper Integration

The existing LinkedIn scraper (`linkedin_scraper.py`) has been updated to:

1. **Format data for Supabase**: Extracts skills, experience, education in Supabase-compatible format
2. **Save to Supabase**: New `save_to_supabase()` function for database storage
3. **Fallback support**: Can still save to Excel if `USE_SUPABASE=false`

### Configuration

```bash
# .env file
USE_SUPABASE=true  # Enable Supabase storage
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_KEY=your-service-key
RENIDLY_API_KEY=your-renidly-key
```

### Usage

```bash
# Run the scraper (will save to Supabase if configured)
python -m modules.auth.application.linkedin_scraper
```

## Migration Steps

### 1. Install Dependencies

```bash
pip install supabase>=2.0,<3.0
```

### 2. Configure Environment Variables

Add Supabase credentials to `.env`:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
```

### 3. Create Database Tables

Run the SQL schema provided above in your Supabase SQL editor.

### 4. Seed Admin Users

Insert admin users into the `public.users` table:

```sql
INSERT INTO public.users (email, name, role, is_active)
VALUES 
  ('admin@smartats.com', 'Admin User', 'admin', true),
  ('hr@smartats.com', 'HR Manager', 'hr_manager', true);
```

### 5. Test Authentication

Test the Google OAuth flow with an admin email:

```python
# Should succeed if email exists in users table with admin role
auth_service.login_with_google(credential, use_supabase=True)
```

### 6. Test Data Ingestion

Test saving scraped data:

```python
github_service.save_scraped_github_data(candidate_uuid, scraped_data)
linkedin_service.save_scraped_linkedin_data(candidate_uuid, scraped_data)
```

## Troubleshooting

### Authentication Issues

**Issue**: "Email not found in system"
- **Solution**: Ensure the user exists in `public.users` table with `role = 'admin'`

**Issue**: "User does not have admin privileges"
- **Solution**: Update the user's role in the database:
```sql
UPDATE public.users SET role = 'admin' WHERE email = 'user@example.com';
```

### Data Ingestion Issues

**Issue**: "SUPABASE_URL environment variable is not configured"
- **Solution**: Add Supabase credentials to `.env` file

**Issue**: UPSERT creates duplicate records
- **Solution**: Verify unique constraints exist on tables:
```sql
-- Check constraints
SELECT conname FROM pg_constraint WHERE conrelid = 'github_profiles'::regclass;
```

**Issue**: JSONB data not storing correctly
- **Solution**: Ensure data is passed as Python dicts/lists, not strings

## Security Considerations

1. **Service Role Key**: The service role key bypasses RLS policies. Never expose it to client-side code.
2. **Admin Client**: Only use admin client on server-side for privileged operations.
3. **Role Verification**: Authentication strictly enforces admin role requirement.
4. **PII Protection**: Consider implementing PII masking for sensitive candidate data.

## Backward Compatibility

The integration maintains backward compatibility:

- **Fallback Authentication**: Set `use_supabase=False` to use `.env` email lists
- **Fallback Storage**: Set `USE_SUPABASE=false` to save LinkedIn data to Excel files
- **Gradual Migration**: Can migrate users and data gradually

## Performance Considerations

1. **Batch Operations**: Use batch save functions for multiple records
2. **Connection Pooling**: Supabase client handles connection pooling automatically
3. **Indexing**: Ensure proper indexes on frequently queried columns
4. **Caching**: Consider caching user role data to reduce database queries

## Monitoring

Enable logging to track Supabase operations:

```python
import structlog

logger = structlog.get_logger(__name__)

# Logs are automatically generated for:
# - Authentication attempts
# - Data ingestion operations
# - Database query failures
```

## Support

For issues related to:
- **Supabase**: Check Supabase documentation
- **Python Integration**: Review module code in `src/backend/modules/`
- **Database Schema**: Refer to SQL schema in this document
