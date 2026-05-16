# Tech Stack

## Backend (`PETROWEB/backend`)
- **Runtime**: Python 3 on AWS Lambda (Mangum adapter wraps the FastAPI app)
- **Framework**: FastAPI 0.115 + Pydantic v2
- **DB access**: SQLAlchemy 2.0 + PyMySQL against Amazon RDS MySQL
- **AWS SDK**: boto3
- **Testing**: pytest + Hypothesis (property-based testing is a first-class practice — shared strategies live in `tests/conftest.py`)
- **Entry points**: `app/main.py` (FastAPI app, routers under `/api/v1/*`), `lambda_handler.py` (Mangum handler)

## Frontend (`PETROWEB/frontend`)
- **Stack**: React 18 + TypeScript 5.5, built with Vite 5
- **Routing**: react-router-dom v7
- **Data fetching**: @tanstack/react-query, axios
- **Auth**: aws-amplify (Cognito)
- **Charts**: echarts / echarts-for-react and recharts
- **Mocking**: msw for tests/dev
- **Lint**: ESLint 9 with `typescript-eslint` and React hooks plugins

## Infrastructure
- AWS S3 + CloudFront (frontend SPA hosting)
- AWS API Gateway → Lambda (backend)
- Amazon Cognito (auth), RDS MySQL (operational data), S3 (files), QuickSight (embedded dashboards), CloudWatch (observability)
- IaC under `PETROWEB/infra/` (CloudFormation and Terraform)

## Common commands

### Backend
Run from `PETROWEB/backend`:
```bash
# Install deps
pip install -r requirements.txt

# Run locally (dev)
uvicorn app.main:app --reload

# Run tests (includes Hypothesis property tests)
pytest
pytest tests/unit/<file>.py::<test_name>   # single test

# Build Lambda zip (expects deps already installed into ./package)
bash build-lambda.sh

# Build + upload + update Lambda (HML environment)
bash deploy_backend.sh
```

### Frontend
Run from `PETROWEB/frontend`:
```bash
npm install
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build
npm run lint       # ESLint
npm run preview    # preview production build
bash deploy_frontend.sh [dev|hml|prd]   # build + s3 sync + CloudFront invalidation
```

## Conventions
- API routes are prefixed `/api/v1/<resource>` and grouped per router file.
- Standard JSON response envelope used by global exception handlers:
  `{ "success": bool, "data": ..., "message": str, "errors": [{"field", "message"}] }`
- HTTP status mapping: `IntegrityError → 409`, `ValidationError → 422`, unhandled → `500`.
- All requests carry a request ID via `RequestIdMiddleware` for log/audit correlation.
- CORS preflight is handled by API Gateway (MOCK integration); FastAPI middleware only adds headers to real responses. Don't change `allow_credentials=False` without coordinating both layers.
- New backend tests should reuse Hypothesis strategies from `tests/conftest.py` (e.g. `iot_packet`, `alarm_severity`, `comparison_operator`) rather than redefining domain enums.
- Frontend code is TypeScript-only; prefer React Query for server state and Amplify for auth flows.
