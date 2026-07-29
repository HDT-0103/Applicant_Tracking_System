---
name: ingestion-azure-pipeline
description: CV/resume PDF ingestion pipeline with multi-layer PDF validation, Azure Blob Storage, Azure Service Bus messaging, and Supabase persistence
version: 2.0.0
author: SmartATS Ingestion & Cloud Architecture Team
tech_stack:
  - FastAPI
  - Python 3.11+
  - Azure Blob Storage SDK
  - Azure Service Bus SDK
  - Supabase
  - PyPDF / PDFPlumber
when_to_use:
  - "implement PDF resume upload endpoints"
  - "validate PDF binary integrity, size limits, and magic bytes"
  - "upload files to Azure Blob Storage and generate SAS URLs"
  - "publish ingestion events to Azure Service Bus queues"
  - "store initial candidate metadata into Supabase candidates table"
---

# Ingestion Module: Azure-Powered CV Pipeline

## 1. Overview & Cloud Architecture

Handles PDF resume upload, binary validation, cloud storage, and event-driven processing for SmartATS. When a candidate or recruiter uploads a CV, the system validates its integrity, uploads the raw binary to Azure Blob Storage, queues a message to Azure Service Bus, and creates an initial record in Supabase.

```
src/backend/modules/ingestion/
├── adapters/
│   ├── routes.py              # POST /api/v1/ingest (Public / Form upload)
│   └── azure_routes.py        # Azure EventGrid / Trigger endpoints
├── application/
│   ├── ingestion_service.py   # Core ingestion orchestrator
│   └── azure_ingestion_service.py # Azure-aware pipeline runner
├── domain/
│   ├── models.py              # ResumeIngestion & Candidate models
│   └── candidate_repository.py# Supabase CRUD repository
└── infra/
    ├── azure_blob_service.py  # Upload/download from Azure Blob containers
    └── azure_service_bus_service.py # Queue event publisher
```

---

## 2. Multi-Layer PDF Validation Rules

All uploaded files MUST pass three strict validation layers before processing:

```
[Uploaded File]
       │
       ├── Layer 1: MIME Type Check (`application/pdf` or `application/x-pdf`)
       │
       ├── Layer 2: File Size Boundary Check (Max 10MB / `MAX_UPLOAD_MB`)
       │
       └── Layer 3: Magic Bytes Check (`%PDF` header bytes: `0x25 0x50 0x44 0x46`)
               │
               ▼ (Passes All 3 Layers)
       Proceed to Azure Storage & Service Bus Queue
```

---

## 3. Ingestion Pipeline Execution Sequence

```
Frontend / Public Portal
       │
       ├─ POST /api/v1/ingest (multipart form: PDF binary + metadata)
       │
       ▼
IngestionService
  ├── 1. Validate PDF magic bytes (%PDF) & size limit (< 10MB)
  ├── 2. Generate unique UUID for candidate
  ├── 3. Save Candidate record in Supabase `candidates` table (status = 'CREATED')
  ├── 4. Upload PDF binary to Azure Blob Storage container (`resumes/{uuid}.pdf`)
  ├── 5. Generate secure Shared Access Signature (SAS) URL
  └── 6. Publish event message to Azure Service Bus queue (`smartats-events`)
       │
       ▼
Response: { "uuid": "candidate_uuid", "status": "created" }
```

---

## 4. Environment Variables & Credentials

```bash
AZURE_STORAGE_CONNECTION_STRING=   # Connection string for Azure Storage Account
AZURE_SERVICE_BUS_CONNECTION_STRING=  # Connection string for Azure Service Bus namespace
AZURE_SERVICE_BUS_QUEUE_NAME=smartats-events
UPLOAD_DIR=uploads
MAX_UPLOAD_MB=10
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
```

---

## 5. AI Agent Instructions & Guidelines

### When Should AI Load This Skill?
Load this skill when modifying PDF upload endpoints, altering file validation rules, configuring Azure Blob Storage containers, or publishing Service Bus queue events.

### What Problems Does This Skill Solve?
Ensures safe, malware-free PDF file ingestion, guarantees cloud backup of resume assets, and decouples file upload from heavy AI parsing via event queues.

### Dependent Modules & Required Skills:
- `cv-analysis-semantic-ranking` (Consumes Azure SAS URL for Gemini parsing)
- `ats-business-domain` (Initializes candidate status to `SUBMITTED`)
- `shared-infrastructure` (Provides cloud configurations & Supabase client)

### Which Files Should AI Modify vs Never Modify?
- **Modify**: `modules/ingestion/application/*`, `modules/ingestion/infra/*`, `modules/ingestion/adapters/routes.py`.
- **Never Modify**: Do NOT bypass magic byte check (`%PDF`) in validation code.

### Common Anti-Patterns & Implementation Mistakes:
- **Storing File Binaries in PostgreSQL**: Storing giant PDF byte arrays in Supabase DB instead of Azure Blob Storage.
- **Exposing Private Blob URLs**: Returning raw private blob URLs without SAS signatures or security tokens.
- **Ignoring File Content Spooks**: Relying solely on file extension (`.pdf`) without checking magic bytes.
