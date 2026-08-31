# Repository Design

Repositories are responsible only for data access.

Repositories never:

- Call LLMs
- Generate embeddings
- Perform ranking
- Implement business logic

---

# ResumeRepository

Purpose

Manage raw resumes.

Methods

create_resume()

get_resume_by_id()

get_resume_by_candidate()

update_resume_text()

delete_resume()

---

# EnrichmentRepository

Purpose

Manage AI structured profiles.

Methods

create_profile()

update_profile()

update_status()

get_profile()

get_candidate_ids_by_skills()

---

# EmbeddingRepository

Purpose

Perform vector search.

Methods

create_embedding()

create_embeddings()

search_similar_embeddings()

search_profiles_lexically()