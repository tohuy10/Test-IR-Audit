# Test-IR-Audit: MAX FE Audit Report Example

Sample repository demonstrating the solution for **IR #478574 - MAX FE audit report Jenkins**.

## Project Architecture
- **Frontend**: React application (`frontend/`) with automated audit script (`frontend/scripts/generate-audit-report.js`).
- **Backend**: Go API server (`backend/main.go`).
- **Database**: PostgreSQL container defined in `docker-compose.yml`.
- **CI/CD**: `Jenkinsfile` with dedicated `MAX FE Audit Report` stage.

## Quick Start & Verification

### 1. Test FE Audit Generator
```bash
node frontend/scripts/generate-audit-report.js
```
Report will be generated at `frontend/audit-reports/fe-audit-report.html`.

### 2. Verify Docker Compose Setup
```bash
docker compose config
```

### 3. Check Jenkins Pipeline Definition
See `Jenkinsfile` for the audit artifact publishing stage.