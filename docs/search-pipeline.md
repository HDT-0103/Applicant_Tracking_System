# Candidate Search Pipeline

```
Recruiter Query
        │
        ▼
Planner
        │
        ▼
Extract Skills
        │
        ▼
Hard Filter
        │
Candidate IDs
    ┌───┴────┐
    ▼        ▼
Dense     Lexical
Search    Search
    └───┬────┘
        ▼
Fusion
        ▼
Ranking
        ▼
Top-K
```

Repositories only provide primitive retrieval.

Ranking is performed inside Search Service.