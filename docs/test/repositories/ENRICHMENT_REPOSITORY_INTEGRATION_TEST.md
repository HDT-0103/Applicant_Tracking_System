# Enrichment Repository Integration Test & Service Workflow Pattern

**File Test:** `tests/repositories/test_enrichment_repository.py`

**Status:** ✅ 1 PASSED

**Scope:** Integration testing of `EnrichmentRepository` with Supabase PostgreSQL (`enrichment_profiles`, `candidates`).

---

# 1. Test Coverage & Results

## Purpose

This integration test validates the complete lifecycle of an Enrichment Profile, from initialization to successful completion.

### 1. Create Profile (`create_profile`)

Verify that the repository can create a new enrichment profile containing extracted candidate information (such as skills, summary, experience, GitHub, LinkedIn) with the initial status:

- `EnrichmentStatus.IN_PROGRESS`

---

### 2. Retrieve Profile (`get_profile`)

Verify that the repository can retrieve an enrichment profile by `candidate_uuid` and correctly map database records into the Python model.

Validation includes:

- Candidate UUID
- Skills
- Summary
- Experience
- GitHub URL
- LinkedIn URL
- Enrichment Status

---

### 3. Update Status (`update_status`)

Verify that the enrichment status can transition correctly:

```text
IN_PROGRESS
      ↓
 ENRICHED
```

The updated status must persist correctly in Supabase.

---

### 4. Cleanup (Teardown)

Ensure all test records are removed after execution.

Cleanup order follows foreign key dependencies to avoid constraint violations.

---

## Test Result

✅ CRUD operations work correctly against Supabase PostgreSQL.

✅ `candidate_uuid` foreign key relationship is valid.

✅ `EnrichmentStatus` enum is fully compatible with the database schema.

---

# 2. Standard Service Workflow Pattern

Every enrichment-related service should follow the workflow below.

```python
from src.backend.app.models.enums import EnrichmentStatus
from src.backend.app.repositories.enrichment_repository import (
    EnrichmentRepository,
)

class EnrichmentService:
    def __init__(
        self,
        enrichment_repo: EnrichmentRepository,
    ):
        self.enrichment_repo = enrichment_repo

    async def process_candidate_enrichment(
        self,
        candidate_uuid: str,
        raw_cv_data: dict,
    ):
        """
        Standard enrichment workflow.
        """

        # --------------------------------------------------
        # STEP 1
        # Create processing record
        # --------------------------------------------------
        profile = await self.enrichment_repo.create_profile(
            candidate_uuid=candidate_uuid,
            skills=[],
            summary="Processing...",
            enrichment_status=EnrichmentStatus.IN_PROGRESS,
        )

        try:

            # --------------------------------------------------
            # STEP 2
            # Execute AI / External Extraction Logic
            # --------------------------------------------------

            # enriched_data = await self.ai_agent.extract(raw_cv_data)

            # --------------------------------------------------
            # STEP 3
            # Update profile and mark as completed
            # --------------------------------------------------

            updated_profile = await self.enrichment_repo.update_status(
                candidate_uuid=candidate_uuid,
                status=EnrichmentStatus.ENRICHED,
            )

            return updated_profile

        except Exception:

            # --------------------------------------------------
            # STEP 4
            # Mark job as failed
            # --------------------------------------------------

            await self.enrichment_repo.update_status(
                candidate_uuid=candidate_uuid,
                status=EnrichmentStatus.ENRICHMENT_FAILED,
            )

            raise
```

---

# 3. Golden Rules for Service Layer

## 3.1 Standard Enrichment Status Flow

Every enrichment job should follow this lifecycle.

| Stage | Status |
|--------|--------|
| Job started | `IN_PROGRESS` |
| Job completed | `ENRICHED` |
| Processing failed | `ENRICHMENT_FAILED` |
| No enrichment data found | `NO_PROFILES_FOUND` |

---

## 3.2 Cleanup Order

Database dependency:

```text
candidates
    │
    └── enrichment_profiles
              │
              └── embeddings
```

Cleanup must happen in reverse order:

```text
embeddings
      ↓
enrichment_profiles
      ↓
candidates
```

This prevents foreign key constraint violations.

---

## 3.3 Always Cleanup in `finally`

Every integration test or background job should clean up resources inside a `finally` block.

Example:

```python
try:
    ...
finally:
    # delete embeddings
    # delete enrichment_profiles
    # delete candidates
```

Always clean up using `candidate_uuid` to prevent orphaned records when tests or jobs fail unexpectedly.

---

# 4. Key Takeaways

- Always create an enrichment profile with `IN_PROGRESS` before processing.
- Execute AI/external enrichment inside a `try` block.
- Update the status to `ENRICHED` on success.
- Update the status to `ENRICHMENT_FAILED` on exceptions.
- Follow the database cleanup order:
  - `embeddings`
  - `enrichment_profiles`
  - `candidates`
- Perform cleanup in `finally` to guarantee database consistency.
- Use `candidate_uuid` as the primary identifier for retrieval, updates, and cleanup.