# SmartATS - Intelligent HR Analytics & Autonomous Agentic System

SmartATS is a next-generation Enterprise Applicant Tracking System (ATS) that shifts the recruitment paradigm from passive CRUD data entry to active, multi-channel **HR Analytics**. The system is built on a **Modular Monolith + Clean Architecture** blueprint, leveraging an event-driven **Hybrid Agentic Loop** via the **Model Context Protocol (MCP)** to autonomously harvest, evaluate, and rank candidates with contextual intelligence.

---

## 🏗️ System Architecture Overview

SmartATS bridges deterministic software engineering with adaptive LLM-driven reasoning through four core components:

1. **Core Agent Runtime:** Maintains the autonomous execution loop, prompt lifecycle parameters, and session state memory.
2. **Model Context Protocol (MCP) Host Layer:** Provides a standardized communication protocol interface allowing the LLM orchestrator to dynamically discover and call system tools.
3. **Custom Skills & Tool Registry:**
   - `ResumeParserSkill(pdf_bytes)`: Extracts schema-validated candidate representations.
   - `CandidateRankingSkill(job_description)`: Computes high-dimensional proximity distances using semantic vectors.
   - `CalendarOrchestrationSkill(interviewer_ids, date_range)`: Solves scheduling availability dynamically.
4. **Enterprise State Machine:** A deterministic verification layer validating the agent's proposed tool executions before persisting transaction records to the relational database.

---

## 📁 Repository Directory Structure

The project strictly follows Software Engineering (SE) organizational standards for artifact isolation:

```text
├── .github/
│   └── workflows/
│       └── ci-cd.yml            # Automated testing and Azure deployment pipelines
├── docs/                        # SYSTEM DOCUMENTATION
│   ├── management/              # JIRA sprint reports, velocity charts, deployment guides
│   ├── requirements/            # User stories, agent persona designs, prompt frameworks
│   ├── analysis and design/     # DB entity-relational schemas, architectural diagrams
│   └── test/                    # QA test logs, unit assertions, validation reports
├── src/                         # SYSTEM SOURCE CODE
│   ├── frontend/                # Next.js responsive Split-Screen Workspace application
│   └── backend/                 # NestJS / FastAPI Monolithic server with Clean Architecture layers
└── docker-compose.yml           # Production multi-stage container orchestration
```
