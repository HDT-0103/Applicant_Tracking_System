# Coding Guidelines

Always use:

- SQLAlchemy Async
- AsyncSession
- Repository Pattern

Never:

- Put business logic inside repositories
- Call repositories directly from Agent
- Perform ranking inside repositories

Business flow

Agent

↓

Tools

↓

Services

↓

Repositories

↓

Database