# SmartATS Architecture

## Philosophy

The project does not build an AI agent for demonstration purposes.

The objective is to solve recruitment problems using AI agents.

---

## Layers

```
Recruiter
      │
      ▼
Planner
      │
      ▼
Tools
      │
      ▼
Services
      │
      ▼
Repositories
      │
      ▼
Supabase
```

---

## Responsibilities

Planner

- Understand recruiter intent
- Decide search strategy

Tools

- Expose business capabilities

Services

- Business orchestration

Repositories

- CRUD
- Search
- Vector search

Database

- Store resumes
- Store enrichment
- Store embeddings