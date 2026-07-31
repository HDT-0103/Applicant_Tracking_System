# Resume Repository Workflow

**Test File:** `tests/repositories/test_resume_repository.py`  
**Status:** ✅ 1 Passed

## Overview

Integration test for `ResumeRepository` with Supabase PostgreSQL (`resumes`, `candidates`).

---

## Tested Features

### Create Resume

Verify `create_resume()` correctly stores resume metadata associated with a `candidate_uuid`.

**Fields**

- `filename`
- `file_path`
- `text_content`
- `candidate_uuid`

### Direct Database Verification

Validate the inserted record using a direct `SELECT` query.

### Get Resume by ID

Verify `get_resume_by_id(UUID)` returns the correct resume.

### Get Resume by Candidate

Verify `get_resume_by_candidate(candidate_uuid)` returns the candidate's resume.

### Cleanup

Delete test data in dependency order to avoid foreign key violations.

1. Delete from `resumes`
2. Delete from `candidates`

---

## Result

- ✅ CRUD operations work correctly with Supabase.
- ✅ UUID conversion between Python and PostgreSQL is handled correctly.

---

# ResumeService Workflow Pattern

```python
class ResumeService:
    async def upload_and_process_resume(
        self,
        candidate_uuid: str,
        file_bytes: bytes,
        filename: str,
    ):
        # 1. Upload file to storage
        file_path = await self.storage_service.upload(
            path=f"resumes/{candidate_uuid}/{filename}",
            data=file_bytes,
        )

        # 2. Extract text
        text_content = await self.pdf_parser.extract_text(file_bytes)

        # 3. Save metadata
        resume = await self.resume_repo.create_resume(
            candidate_uuid=candidate_uuid,
            filename=filename,
            file_path=file_path,
            text_content=text_content,
        )

        # 4. Optional post-processing
        # await self.enrichment_service.trigger_enrichment(
        #     candidate_uuid,
        #     text_content,
        # )

        return resume

    async def get_candidate_resume(self, candidate_uuid: str):
        return await self.resume_repo.get_resume_by_candidate(candidate_uuid)
```

---

# Best Practices

## Upload Workflow

1. Upload file to storage.
2. Extract document text.
3. Save metadata through `ResumeRepository`.
4. Trigger optional downstream processing (embedding, enrichment, etc.).

---

## Cleanup Order

Always delete in this order:

```
resumes
    ↓
candidates
```

During teardown, delete using `candidate_uuid` instead of `resume_id` to avoid orphaned test data if a test is interrupted.

---

## UUID Handling

`get_resume_by_id()` expects a `UUID` object.

Always convert string IDs before calling the repository.

```python
from uuid import UUID

resume = await repo.get_resume_by_id(UUID(resume_id))
```