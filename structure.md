ATS/ # Root Repository
│
├── .github/ # GitHub specific configurations
│ └── workflows/
│ └── ci-cd.yml # CI/CD pipeline definition (GitHub Actions)
│
├── docs/ # 📁 DOCUMENTATION FOLDER (Strict SE Compliance)
│ ├── management/ # JIRA screenshots, sprint reports, deployment guides
│ │ └── deployment_guide.md  
│ ├── requirements/ # User stories, agent specs, system prompt frameworks
│ │ └── vision_agent_spec.md #[cite: 6, 7]
│ ├── analysis and design/ # Database schemas, architectural diagrams, MCP specs
│ │ └── mcp_architecture.md  
│ └── test/ # Test logs, QA assertions, agent evaluation parameters
│ └── agent_evaluation_report.md
│
├── src/ # 📁 SOURCE CODE FOLDER
│ ├── frontend/ # Next.js Web Application
│ │ ├── public/
│ │ └── src/
│ │ ├── components/ # Reusable UI parts (Native PDF Viewer, Charts)
│ │ ├── views/ # Workspace Dashboard, Kanban Board, BI Admin view
│ │ └── services/ # WebSocket client connections and API integration
│ │
│ └── backend/ # NestJS / FastAPI Monolithic Server
│ ├── apps/ # Gateway or main execution entry points
│ └── modules/ # Segments divided by Core Vertical Features
│ ├── shared/ # Shared kernels, logging utilities, DB client setups
│ │ └── infrastructure/
│ │ └── database/postgres.config.ts # PostgreSQL & pgvector config
│ │
│ ├── ingestion/ # Handles raw CV PDF processing & storage routing
│ ├── ai-analytics/ # Core LLM Orchestrator & Semantic Matching Engine
│ │ ├── domain/ # TẦNG 1: Core Resume/JD Entities & Matching logic
│ │ ├── application/ # TẦNG 2: ParseResumeUseCase & CalculateScoreUseCase
│ │ ├── adapters/ # TẦNG 3: Presenters (Data formatting for Radar Charts)
│ │ └── infra/ # TẦNG 4: LangChain connectors & OpenAI/Gemini bindings
│ │
│ ├── mcp-host/ # Model Context Protocol Host infrastructure layer
│ │ └── tools/ # Binding registries (drive_search_mcp, slack_notify_mcp)
│ │
│ ├── portfolio-enrich/# GitHub / LinkedIn external crawling engine
│ └── notification/ # Azure Service Bus consumer & Google Calendar utilities
│
├── .env.example # Template for environment parameters (API Keys, DB Credentials)
├── .gitignore # Ignore node_modules, .env files, and local build artifacts
├── docker-compose.yml # Production & staging container orchestration matrix
└── README.md # System architecture summary, installation, and setup guide
