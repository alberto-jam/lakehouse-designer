# Product

PETROWEB is a web application for monitoring, analysis, and operational management of control and safety valves in oil & gas operations.

## What it does
- Tracks valve health, alarms, interventions, maintenances, experiments, and predictions
- Ingests IoT sensor measurements (temperature, pressure, flow, humidity, displacement, status fields)
- Surfaces operational dashboards, embedded analytics (QuickSight), and a copilot module
- Role-aware navigation backed by AWS Cognito authentication

## Primary users
Operations engineers, maintenance teams, and analysts working with industrial valves.

## Language
The product targets Portuguese (pt-BR) users. User-facing strings, error messages, comments in scripts, and documentation are commonly written in Portuguese. Code identifiers are in English. Preserve this split when adding new code.

## Domain vocabulary
- **Valve / Válvula** — the monitored asset
- **Alarm / Alarme** — threshold breach event with severity (LOW, MEDIUM, HIGH, CRITICAL) and status (OPEN, ACKNOWLEDGED, CLOSED)
- **Intervention / Intervenção** — corrective action on a valve (status: OPEN, IN_PROGRESS, COMPLETED, CANCELLED)
- **Maintenance / Manutenção** — scheduled/preventive activity
- **Experiment / Experimento** — test run on a valve (status: DRAFT, RUNNING, COMPLETED, CANCELLED)
- **Measurement / Medição** — IoT data point, source can be SENSOR, MANUAL, IMPORT, CALCULATED, LAB
- **Indicator / Indicador** and **Prediction / Predição** — derived analytics
