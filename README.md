# NoCodeQuery

Development environment based on __React (Vite)__ frontend + __Express__ + __GraphQL__ backend + __InfluxDB__ + __Grafana__.

Uses __VSCode Dev Containers__ + __Docker Compose__ to unify the development environment and ensure team consistency.

---

## 📂 Project Structure
```plaintext
.
├── client/              # Frontend (React + Vite)
│   ├── src/             # React source code
│   ├── public/          # Static assets
│   ├── package.json     # Frontend dependencies
│   └── vite.config.js   # Vite config
│
├── server/              # Backend (Express + GraphQL)
│   ├── graphql/         # GraphQL schema & resolvers
│   ├── middleware/      # Express middleware
│   ├── routes/          # REST API routes
│   ├── services/        # InfluxDB, session, etc.
│   ├── server.js        # Backend entry point
│   └── package.json     # Backend dependency declarations (declared only, no lock generated)
│
├── devcontainer/        # VSCode Dev Container / Compose configs
│   └── compose.influxdb.yaml
│
├── package.json         # Root package.json (shared deps & scripts)
├── package-lock.json    # Root lock file (single source of truth)
├── README.md            # Project guide
└── ...

```

## 🚀 Development Environment

- Node.js 22 (auto-installed inside container)
- Docker / Docker Compose
- VSCode + Dev Containers extension
- Dependency installation and runtime happen __inside the container__ to avoid cross-platform issues.



## 🛠 Daily Workflow

### 1. Open the project
1.1 Open the project folder with VSCode

1.2 Open Docker Desktop

1.3 Open compose.influxdb.yaml

1.4 Wait a few seconds and click __Run all services__ at the top — that’s it

1.5 Visit web URLs directly
   
> On first start, images will be built automatically and the app + influxdb + grafana containers will be launched.


### 2. Install dependencies
Run inside the container only to ensure consistency.

If you add new deps, declare them in package.json; rebuilding the Docker setup will pick them up.

### 3. Start services
3.1 Open Docker Desktop

3.2 Open __compose.influxdb.yaml__ and click __Run all services__

> Note: run docker compose -f devcontainer/compose.influxdb.yaml down -v in a terminal to remove all current configs if Docker misbehaves, then repeat the steps above to regenerate containers.

___
__InfluxDB URL:__ http://localhost:8086

__InfluxDB Username:__ dev

__InfluxDB Password:__ devpass123

> Click __Load Data__ on the left toolbar and upload a test __CSV file__ to create a default buckets named __devbucket__.

___
__Grafana URL:__ http://localhost:3001

__Grafana Username:__ admin

__Grafana Password:__ admin

> InfluxDB data source is **auto-configured** on first startup (via provisioning).
> No manual setup needed — Flux mode, devtoken, devorg, devbucket are all pre-configured.



___
__No-Code Solution Web Application URL:__ http://localhost:5173

__Login URL:__ http://influxdb:8086

__Login token:__ devtoken

___

### 4. Edit code

Use VSCode on the host (Windows / Mac / Linux) to open and edit the code.

Changes are automatically synced (volumes are mounted).

Frontend (Vite) → HMR auto-reload

Backend (nodemon) → Auto-restart

### 5. Commit code

All dependencies are locked by the __root__ package-lock.json.

Do __not__ create a separate lock file under server/.

Before committing, ensure your changes have synced to the host.

📊 __Service Overview__

Backend (Express + GraphQL): exposes /api and /graphql

Frontend (Vite + React): provides the UI

InfluxDB: time-series storage

Grafana: visualizes queries against InfluxDB

📈 __Grafana Embedding__

The frontend embeds Grafana panels via iframe.

In Grafana, prepare dashboards with variables (recommended: bucket / measurement / field / tag). Copy the share URL and use it directly.

If different visualization types need different panels, add variables like VITE_GRAFANA_PANEL_TIMESERIES_ID, VITE_GRAFANA_PANEL_STAT_ID, etc.

If Grafana does not allow anonymous access, inject a login cookie at the reverse-proxy layer for the iframe, or use a minimally-privileged API Key instead.

### 🔧 Grafana Authentication Setup

The Grafana Service Account Token is pre-configured in `compose.influxdb.yaml` (`GRAFANA_TOKEN`).

On **first startup**, everything works out of the box — no manual steps needed.

#### After `docker compose down -v` (volumes deleted)

If you wipe volumes, the token in compose becomes invalid. Regenerate it:

```bash
# 1. Create Service Account + Token
$headers = @{"Authorization"="Basic YWRtaW46YWRtaW4="; "Content-Type"="application/json"}
$sa = Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/serviceaccounts" -Headers $headers -Body '{"name":"nocode-sa","role":"Admin"}'
$token = Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/serviceaccounts/$($sa.id)/tokens" -Headers $headers -Body '{"name":"nocode-token"}'
Write-Host "New token:" $token.key

# 2. Update GRAFANA_TOKEN in devcontainer/compose.influxdb.yaml with the new token
# 3. Restart app container
docker compose -f devcontainer/compose.influxdb.yaml up -d app
```

✅ __FAQs__

Port conflict (5173)

If port 5173 is already taken on the host, Vite will switch to 5174 automatically. However, ports other than 5173 are disabled here, so close the process that occupies 5173.
