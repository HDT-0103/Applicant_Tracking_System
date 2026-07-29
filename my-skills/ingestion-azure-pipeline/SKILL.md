---
name: ingestion-azure-pipeline
description: CV/resume PDF ingestion pipeline with Azure Blob Storage, Azure Service Bus, and Supabase persistence
version: 1.0.0
tech_stack:
  - FastAPI
  - Python 3.11+
  - Azure Blob Storage
  - Azure Service Bus
  - Supabase
  - Multer (file validation middleware)
when_to_use:
  - "upload and store PDF resumes"
  - "configure Azure Blob Storage for file uploads"
  - "set up Azure Service Bus for ingestion events"
  - "validate PDF file format and size"
  - "persist candidate metadata to Supabase"
---

# Ingestion Module: Azure-Powered CV Pipeline

## Overview

Handles PDF resume upload, validation, cloud storage, and event-driven processing for SmartATS. When a candidate uploads their CV, the system validates it, stores it in Azure Blob Storage, queues a message to Azure Service Bus, and creates a candidate record in Supabase.

## Architecture

```
modules/ingestion/
├── adapters/
│   ├── routes.py              # POST /api/v1/ingest (public)
│   └── azure_routes.py        # Alternative Azure-triggered endpoints
├── application/
│   ├── __init__.py
│   ├── ingestion_service.py   # Core ingestion logic
│   └── azure_ingestion_service.py  # Azure-aware ingestion
├── domain/
│   ├── __init__.py
│   ├── models.py              # Candidate, ResumeIngestion models
│   └── candidate_repository.py  # Supabase CRUD for candidates
├── infra/
│   ├── __init__.py
│   ├── azure_blob_service.py  # Upload/download from Azure Blob
│   └── azure_service_bus_service.py  # Queue messages to Service Bus
└── __init__.py
```

## Pipeline Flow

```
Frontend (Careers Portal)
       │
       ├─ POST /api/v1/ingest (multipart: file + metadata)
       │
       ▼
validateResume.ts (Middleware)
  ├── Check file size < 10MB
  ├── Check MIME type = application/pdf
  ├── Check magic bytes = %PDF
  │
       ▼
IngestionService
  ├── 1. Save candidate metadata to Supabase (candidates table)
  ├── 2. Upload PDF to Azure Blob Storage container
  ├── 3. Send message to Azure Service Bus queue
  │
       ▼
Response: { candidate_uuid: "uuid", status: "created" }
       │
       ▼
Frontend redirects to /candidate-profile/enriched?uuid=...
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/ingest` | None | Upload CV (multipart form) |

### POST /api/v1/ingest

**Request (multipart/form-data):**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | PDF resume (max 10MB) |
| `full_name` | String | Yes | Candidate full name |
| `email` | String | Yes | Candidate email |
| `phone` | String | No | Phone number |
| `linkedin_url` | String | No | LinkedIn profile URL |
| `github_url` | String | No | GitHub username/URL |
| `job_id` | String | No | Associated job posting ID |

**Response (201):**
```json
{
  "candidate_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "status": "created",
  "message": "Resume uploaded and queued for processing"
}
```

## Key Files

| File | Responsibility |
|------|----------------|
| `middleware/validateResume.ts` | Express-style multer middleware: file size, MIME type, magic byte validation |
| `modules/ingestion/application/ingestion_service.py` | Orchestrates: Supabase insert → Blob upload → Service Bus send |
| `modules/ingestion/infra/azure_blob_service.py` | `upload_blob()`, `download_blob()`, `generate_sas_url()` for Azure Blob containers |
| `modules/ingestion/infra/azure_service_bus_service.py` | `send_message()` to queue; `receive_messages()` for worker |
| `modules/ingestion/domain/models.py` | Pydantic models for candidate ingestion |
| `modules/ingestion/domain/candidate_repository.py` | Supabase queries for candidate CRUD |

## Environment Variables

```bash
AZURE_STORAGE_CONNECTION_STRING=   # Azure Storage account connection string
AZURE_SERVICE_BUS_CONNECTION_STRING=  # Service Bus connection string
AZURE_SERVICE_BUS_QUEUE_NAME=smartats-events
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
UPLOAD_DIR=uploads
MAX_UPLOAD_MB=25
ALLOWED_RESUME_EXTENSIONS=pdf,docx
```

## Middleware: File Validation

`src/backend/middleware/validateResume.ts` performs three-layer validation:

1. **Multer filter**: Rejects non-PDF MIME types and files > 10MB
2. **File existence**: Checks that `req.file` is present
3. **Magic bytes**: Reads first 4 bytes of buffer and verifies `%PDF` header (catches spoofed extensions)

## Frontend Integration

```typescript
// From careers/page.tsx
const formData = new FormData();
formData.append('file', cvFile);
formData.append('full_name', formData.fullName);
formData.append('email', formData.email);
formData.append('phone', formData.phone);
formData.append('linkedin_url', formData.linkedinUrl);
formData.append('github_url', formData.githubUrl);
formData.append('job_id', selectedJob?.id || '');

const response = await fetch(
  `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}/api/v1/ingest`,
  { method: 'POST', body: formData }
);
const { candidate_uuid } = await response.json();
router.push(`/candidate-profile/enriched?uuid=${candidate_uuid}`);
```

## Error Handling

| Error | HTTP Status | Response |
|-------|-------------|----------|
| Invalid file format | 400 | `{ "code": "HTTP_400_BAD_REQUEST", "message": "Document must be a valid PDF..." }` |
| File too large | 400 | `{ "code": "HTTP_400_BAD_REQUEST", "message": "File size boundary limits exceed 10MB!" }` |
| No file | 400 | `{ "status": "error", "message": "No file asset detected!" }` |
| Spoofed PDF | 400 | `{ "code": "HTTP_400_BAD_REQUEST", "message": "Magic byte do not match PDF!" }` |
