# Project Structure

## Top-level layout
```
KiroApp/
├── .kiro/                  # Kiro specs and steering
│   ├── specs/              # Feature specs (requirements, design, tasks)
│   └── steering/           # Steering rules (this folder)
├── PETROWEB/               # Main product
│   ├── architecture/       # Architecture diagrams (drawio) and docs
│   ├── backend/            # FastAPI + Lambda backend
│   ├── database/           # MySQL DDL, seeds, schema models
│   ├── docs/               # Product/user documentation
│   ├── frontend/           # React + Vite SPA
│   ├── images/             # Reference images
│   ├── infra/              # IaC (CloudFormation, Terraform, scripts)
│   ├── massa de teste/     # Test data fixtures
│   └── openapi/            # OpenAPI specs
├── PETROWEB_ATUALIZACAO/   # Update / migration working area
└── petroweb-*.txt          # Notes per AWS service (cloudfront, lambda, rds, ...)
```

## Backend layout (`PETROWEB/backend`)
```
backend/
├── app/
│   ├── core/           # Cross-cutting (config, security, logging)
│   ├── database/       # SQLAlchemy session/engine setup
│   ├── middleware/     # ASGI middleware (e.g. RequestIdMiddleware)
│   ├── models/         # SQLAlchemy ORM models
│   ├── modules/        # Self-contained feature modules (e.g. copilot/)
│   ├── repositories/   # Data-access layer over models
│   ├── routers/        # FastAPI routers, one file per resource
│   ├── schemas/        # Pydantic request/response schemas
│   ├── services/       # Business logic
│   └── main.py         # FastAPI app, exception handlers, router wiring
├── lambda/             # Lambda-specific helpers
├── package/            # Build output: deps + app for zipping
├── tests/
│   ├── conftest.py     # Shared Hypothesis strategies and fixtures
│   └── unit/           # Unit + property-based tests
├── lambda_handler.py   # Mangum entry: handler = Mangum(app)
├── requirements.txt
├── build-lambda.sh     # Builds petroweb-backend.zip from ./package
└── deploy_backend.sh   # Build + s3 cp + lambda update-function-code
```

### Backend layering rules
- Request flow: `routers → services → repositories → models`. Don't bypass layers (e.g. routers should not query SQLAlchemy directly).
- `schemas/` holds Pydantic models for I/O. Don't return ORM models from routers — map to a schema first.
- New resources get their own router file in `routers/` and are registered in `app/main.py` with prefix `/api/v1/<resource>`.
- Larger self-contained features (like `copilot`) live under `app/modules/<name>/` with their own router/service/schema files, registered via `from app.modules.<name>.router import router`.

## Frontend layout (`PETROWEB/frontend/src`)
```
src/
├── app/            # App-level wiring (router, providers)
├── assets/         # Static assets
├── components/     # Shared/reusable UI components
├── config/         # Env and runtime configuration
├── constants/      # App-wide constants
├── context/        # React contexts
├── hooks/          # Custom hooks (e.g. useAuth)
├── layout/         # Layout shells (e.g. AppShell)
├── mocks/          # MSW handlers for dev/test
├── modules/        # Feature modules (alarms, dashboard, experiments,
│                   #   interventions, predictions, valves)
├── pages/          # Route-level page components (LoginPage, ...)
├── services/       # API clients (axios) and external integrations
├── theme/          # Styling/theming
├── types/          # Shared TypeScript types
├── utils/          # Pure utilities
├── App.tsx         # Auth gate + Routes
└── main.tsx        # React bootstrap
```

### Frontend conventions
- Group feature code under `src/modules/<feature>/`. Tab-style sub-views follow the pattern `Valve<Section>Tab.tsx` (see `modules/valves/`).
- Components are PascalCase `.tsx` files. Hooks live in `hooks/` and start with `use`.
- Use absolute-from-`src` relative imports as the existing code does (e.g. `./hooks/useAuth`, `./layout/AppShell/AppShell`).
- Server state goes through `@tanstack/react-query`; auth state through Amplify/Cognito via `useAuth`.
- Route-level pages live in `pages/`; the actual route table is in `app/router/AppRouter`.

## Specs and steering
- Each feature spec lives at `.kiro/specs/<feature-name>/` with `requirements.md`, `design.md`, `tasks.md`.
- Steering files in `.kiro/steering/` apply globally; keep them concise.

## Naming
- Python: snake_case files and functions, PascalCase classes (FastAPI/Pydantic/SQLAlchemy idioms).
- TypeScript/React: PascalCase components and files for components, camelCase for hooks/utilities.
- Feature/spec directory names: kebab-case.
