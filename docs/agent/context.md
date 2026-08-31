# ATS Candidate Search Agent - Current Architecture & Refactor Plan

---

# 1. Current Graph Flow

```text
Recruiter Query
        │
        ▼
 Planner
        │
        ├───────────────┐
        │               │
Need clarification?     Enough information
        │               │
        ▼               ▼
 Interaction        Retrieval
        │               │
        └──────► Planner │
                        ▼
                  Reflection
                        │
              ┌─────────┴─────────┐
              │                   │
      Search not good        Search good
              │                   │
              ▼                   ▼
          Planner          Recruiter Decision
                                  │
                                  ▼
                                 END
```

Current LangGraph routing:

```text
START
   │
   ▼
Planner
   │
   ├── interaction
   │        │
   │        ▼
   │     Planner
   │
   └── retrieval
            │
            ▼
      Reflection
            │
      ┌─────┴─────┐
      │           │
 Planner      Recruiter
                    │
                    ▼
                   END
```

---

# 2. Intended Candidate Search Pipeline

Repository layer only exposes primitive retrieval methods.

Actual search logic should live inside the Search Service / Retrieval Node.

```text
Recruiter Query
        │
        ▼
Planner
        │
Extract Requirement
        │
Decompose Query
        │
 ┌─────────────┐
 │             │
Hard Query   Soft Query
 │             │
 ▼             ▼
Hard Filter   Embedding
      │
Candidate IDs
      │
 ┌────┴─────┐
 ▼          ▼
Dense     Lexical
Search    Search
 └────┬─────┘
      ▼
 Fusion
      ▼
 Ranking
      ▼
 Top-K Candidates
```

Current database already supports this through three RPCs:

- get_candidate_ids_by_skills()
- search_profiles_lexically()
- search_similar_embeddings()

---

# 3. Current Problems

## Problem 1 — State is outdated

The current `ATSState` was designed before the new Hybrid Retrieval architecture.

It still contains concepts that no longer match the search pipeline.

Examples:

- SchedulerState
- requirement_id workflow
- old Observation model
- missing query decomposition result

Planner currently cannot store:

- hard requirements
- semantic requirements
- extracted skills
- search constraints

As a result, RetrievalNode has no structured input.

---

## Problem 2 — RetrievalNode still uses old pipeline

Current RetrievalNode:

```text
Planner
      │
      ▼
SemanticPipeline.search_candidates(...)
```

This pipeline belongs to the old architecture.

It does NOT use:

- Skill RPC
- Lexical RPC
- Vector RPC
- Fusion
- Ranking

Meaning all newly implemented retrieval capabilities are completely bypassed.

---

## Problem 3 — Retrieval logic is hidden inside old service

Current implementation delegates everything into:

```python
SemanticPipeline.search_candidates()
```

This service performs retrieval internally.

With the new architecture we already have:

- EmbeddingService
- Repository layer
- RPC layer
- Ranking logic

Therefore the old pipeline should disappear.

---

# 4. Planned Refactor

The retrieval node becomes the orchestration layer.

Instead of:

```text
Planner
    │
    ▼
SemanticPipeline
```

It becomes

```text
Planner
    │
    ▼
Retrieval Node
      │
      ├── Hard Filter RPC
      │
      ├── Embed Soft Query
      │
      ├── Dense Search RPC
      │
      ├── Lexical Search RPC
      │
      ├── Score Fusion
      │
      └── Ranking
```

The node itself orchestrates the search.

Repositories remain simple database access layers.

---

# 5. New Responsibility of Planner

Planner is no longer only checking whether the recruiter query is complete.

Planner now has two major responsibilities.

## A. Query Assessment

Determine whether the recruiter query contains enough information.

Possible outcomes:

```text
Enough
```

or

```text
Need clarification
```

If clarification is needed:

```text
Planner
      │
      ▼
Interaction
      │
      ▼
Planner
```

---

## B. Query Decomposition

Planner decomposes the recruiter request into two independent parts.

### Hard Requirements

Used for exact filtering.

Example:

```text
Skills

- Python
- FastAPI
- PostgreSQL

Experience

- 3 years

Location

- Remote
```

These become the input for:

```text
get_candidate_ids_by_skills()
```

---

### Soft Requirements

Natural language requirement.

Example:

```text
Senior backend engineer capable of designing scalable APIs,
working with distributed systems,
communicating with product teams,
and mentoring junior engineers.
```

This text becomes the embedding query used for Semantic Search.

---

# 6. New Responsibility of Retrieval Node

Retrieval Node becomes the core search orchestrator.

Pipeline:

```text
Receive planner output
        │
        ▼
Hard Filter
        │
candidate_ids
        │
        ▼
Embed Soft Query
        │
        ▼
Dense Search
        │
        ▼
Lexical Search
        │
        ▼
Fusion
        │
        ▼
Ranking
        │
        ▼
Top-K CandidateContext
```

It is responsible for producing the final candidate list that Reflection and RecruiterDecision consume.

---

# 7. Nodes That Mostly Stay the Same

## Interaction Node

Still responsible for asking recruiter for missing information.

No major architectural changes.

---

## Reflection Node

Still evaluates whether retrieval quality is acceptable.

Possible decisions:

```text
Retry
```

or

```text
Continue
```

---

## RecruiterDecision Node

Consumes ranked CandidateContext objects.

Produces:

- recommendation
- reasoning
- strengths
- risks
- missing requirements

This node remains largely unchanged.

---

# 8. Immediate Refactor Tasks

## Phase 1 — State Refactor

Redesign `ATSState` to match the Hybrid Search architecture.

Main additions:

- Query decomposition
- Hard requirements
- Soft requirement
- Search constraints
- Retrieval results
- Ranking results

Remove:

- SchedulerState
- obsolete fields from old pipeline

---

## Phase 2 — Planner Refactor

Planner should output:

- clarification
- decomposed query
- hard requirements
- soft requirement

instead of only RequirementAnalysis.

---

## Phase 3 — Retrieval Refactor

Replace:

```text
SemanticPipeline.search_candidates()
```

with

```text
Hard Filter RPC
      │
Dense Search RPC
      │
Lexical Search RPC
      │
Fusion
      │
Ranking
```

using the repositories and services that have already been implemented and tested.

---

## Phase 4 — Reflection & Decision

Reflection and RecruiterDecision consume the new CandidateContext generated by Retrieval.

Minimal modifications are expected.

---

# 9. Current Project Status

## Completed

- Supabase schema
- Repository layer
- Integration tests
- EmbeddingService
- Three retrieval RPCs
- Hybrid retrieval foundation

## Remaining

1. Refactor ATSState
2. Refactor Planner output
3. Reimplement Retrieval Node using Hybrid Search
4. Connect Reflection
5. Connect Recruiter Decision
6. End-to-end integration testing of the LangGraph agent

At this point, the database layer and retrieval infrastructure are considered stable. The remaining work is primarily focused on integrating these components into the LangGraph agent architecture.