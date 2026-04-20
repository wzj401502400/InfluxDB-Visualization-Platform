# NoCodeQuery — InfluxDB Visualization Platform

A **no-code time-series data exploration tool** that lets users visually build InfluxDB Flux queries through a drag-and-drop hierarchy tree, dynamic form controls, and embedded Grafana dashboards — without writing a single line of Flux.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Frontend** | React | 19.1 |
| **Build Tool** | Vite | 7.1 |
| **Styling** | Tailwind CSS | 3.4 |
| **Animation** | Framer Motion | 11.x |
| **Icons** | Lucide React | 0.460 |
| **Charts** | Recharts | 3.2 |
| **Data Fetching** | TanStack React Query | 5.51 |
| **Backend** | Express | 5.1 |
| **API Layer** | REST + GraphQL (`graphql-http`) | GraphQL 16 |
| **Time-Series DB** | InfluxDB | 2.7 |
| **Query Language** | Flux | — |
| **DB Client** | `@influxdata/influxdb-client` | 1.35 |
| **Visualization** | Grafana OSS (embedded via iframe) | 11.4 |
| **Session Auth** | Cookie + in-memory Map (`cookie-parser`) | — |
| **Runtime** | Node.js | 22 LTS |
| **Containerization** | Docker Compose | — |
| **Dev Environment** | VSCode Dev Containers | — |
| **Testing** | Jest (ESM) + supertest | Jest 29 |
| **Linting** | ESLint 9 (flat config) + react-hooks + react-refresh | — |
| **Package Management** | npm workspaces (monorepo) | — |

---

## Features

- **Session-based authentication** — InfluxDB URL + Token stored in httpOnly cookies; never exposed to the browser
- **Dynamic schema discovery** — Measurements, fields, tag keys, and tag values are fetched live from InfluxDB using Flux `schema.*()` functions
- **No-code query builder** — Select bucket → measurement → field → tags → time range → aggregation function → group by, all from dropdowns
- **Drag-and-drop hierarchy tree** — Build custom data hierarchies (bucket → measurement → field → tag) and query by clicking any node
- **Saved hierarchy queries** — Save hierarchy definitions and re-run with different parameters
- **Configurable aggregation** — Switch between `mean`, `sum`, `max`, `min`, `median`, `count`, `last`, `first`, `spread` — applied to both the Flux display and the Grafana chart
- **Group By support** — Multi-select columns to group by; synced to both the generated Flux and Grafana visualization
- **8 visualization types** — Time series, bar chart, stat, gauge, table, pie chart, heatmap, histogram (via Grafana)
- **Embedded Grafana dashboards** — Backend dynamically creates Grafana dashboards via HTTP API and embeds them as iframes; re-submit overwrites the same dashboard instead of creating duplicates
- **Cross-measurement queries** — Union multiple measurements with different fields into a single chart
- **Real-time Flux preview** — See the generated Flux query update live as you change parameters
- **GraphQL API** — Bucket listing, login/logout exposed via GraphQL alongside REST endpoints
- **Auto-provisioned Grafana datasource** — InfluxDB Flux datasource is configured automatically on first startup via provisioning YAML

---

## Architecture

```
┌──────────────────┐        ┌──────────────────┐        ┌──────────────┐
│  React 19 + Vite │───────▶│  Express 5 API   │───────▶│  InfluxDB 2  │
│  Tailwind CSS    │  REST  │  + GraphQL       │  Flux  │  (TSDB)      │
│  Framer Motion   │  GQL   │  cookie-parser   │        │  :8086       │
│  React Query     │        │  :4000           │        └──────────────┘
│  Recharts        │        └────────┬─────────┘               ▲
│  :5173           │                 │ Grafana HTTP API         │ Flux
└──────┬───────────┘                 ▼                         │
       │ iframe              ┌──────────────┐                  │
       └────────────────────▶│  Grafana OSS │──────────────────┘
                             │  :3001       │
                             └──────────────┘
```

### Data Flow

1. **UI → Backend**: React sends structured query specs (bucket, measurement, field, tags, time range, aggregate function, group by) to Express REST endpoints.
2. **Backend → InfluxDB**: Express compiles specs into Flux queries and executes them via the InfluxDB v2 HTTP API.
3. **Backend → Grafana**: Express creates/overwrites Grafana dashboards via Grafana HTTP API (Basic Auth), returning an iframe embed URL.
4. **Visualization**: Grafana panels are embedded via iframe in the React UI. Flux query text is displayed alongside for transparency.

### Key Design Decisions

| Decision | Rationale |
|---|---|
| Session cookie (httpOnly) | Token never in localStorage/JS — prevents XSS token theft |
| In-memory session Map | Sufficient for single-instance dev; swap to Redis for production |
| 365-day default lookback | Test data may be months old; avoids "no data" confusion |
| Measurement-scoped tag values | Prevents cross-measurement value pollution in dropdowns |
| Stable Grafana dashboard UID | Re-submit overwrites the same dashboard instead of creating orphans |
| Whitelist validation on aggregation/groupBy | Prevents Flux injection in server-side query construction |
| npm workspaces monorepo | Single `package-lock.json`; avoids dependency drift between client/server |

---

## Project Structure

```
.
├── client/                          # Frontend (React 19 + Vite 7)
│   ├── src/
│   │   ├── App.jsx                  # Main UI — hierarchy builder, query form, visualization
│   │   ├── config/grafana.js        # Aggregate window calculator
│   │   ├── services/api.js          # REST/GraphQL client functions
│   │   └── utils/flux.js            # Flux query spec builder
│   ├── index.html                   # SPA entry point
│   ├── tailwind.config.js           # Tailwind theme (brand/accent/neutral)
│   ├── vite.config.js               # Dev proxy → :4000
│   └── package.json                 # Frontend deps
│
├── server/                          # Backend (Express 5 + GraphQL 16)
│   ├── server.js                    # Entry — mounts REST, GraphQL, health check
│   ├── graphql/
│   │   ├── schema.js                # GraphQL type definitions
│   │   └── resolvers.js             # Query/Mutation resolvers
│   ├── middleware/auth.js           # Session validation middleware
│   ├── routes/rest.js               # REST endpoints + Grafana dashboard proxy
│   ├── services/
│   │   ├── influx.js                # InfluxDB client (schema discovery + query)
│   │   └── session.js               # Cookie-based session manager
│   └── package.json                 # Backend deps
│
├── devcontainer/                    # Docker / Dev Container configs
│   ├── compose.influxdb.yaml        # 3-service orchestration (app + influxdb + grafana)
│   ├── Dockerfile                   # Node.js 22 LTS (MS devcontainer base)
│   └── grafana-provisioning/
│       └── datasources/influxdb.yaml  # Auto-configures InfluxDB Flux datasource
│
├── script/
│   └── influx_testdata_augmented.csv  # Sample data (measurement=m, field=mem, 6 tags)
│
├── package.json                     # Root — npm workspaces, concurrently
└── package-lock.json                # Single lock file for entire monorepo
```

---

## Quick Start

### Prerequisites

- Docker Desktop
- VSCode + Dev Containers extension (recommended)

### 1. Clone and configure

```bash
git clone <repo-url>
cd InfluxDB-Visualization-Platform
cp devcontainer/.env.example devcontainer/.env
# Edit .env — set GRAFANA_TOKEN (see instructions inside the file)
```

> **Note: To use Grafana dynamic panels and dashboard auto-creation, you must set `GRAFANA_TOKEN` in your `.env` file (see `.env.example` and Quick Start step 1 for instructions).**

### 2. Start all services

Open `devcontainer/compose.influxdb.yaml` in VSCode and click **Run all services**, or:

```bash
docker compose -f devcontainer/compose.influxdb.yaml up -d --build
```

This launches three containers:
- **app** — Node.js 22 running the Express backend + Vite dev server
- **influxdb** — InfluxDB 2.7 with pre-configured org/bucket/token
- **grafana** — Grafana OSS 11.4 with auto-provisioned InfluxDB datasource

### 3. Load test data

1. Open InfluxDB UI: http://localhost:8086 (user: `dev`, password: `devpass123`)
2. Go to **Load Data → Buckets → devbucket → Add Data → CSV**
3. Upload `script/influx_testdata_augmented.csv`

### 4. Access the app

| Service | URL | Credentials |
|---|---|---|
| **App** | http://localhost:5173 | Login with URL `http://influxdb:8086`, token `devtoken` |
| **InfluxDB** | http://localhost:8086 | `dev` / `devpass123` |
| **Grafana** | http://localhost:3001 | `admin` / `admin` |

> Grafana datasource is **auto-provisioned** — no manual configuration needed.

### 5. Development workflow

| Tool | Behavior |
|---|---|
| Frontend (Vite) | HMR — save a file, see changes instantly |
| Backend (nodemon) | Auto-restarts on file change |
| Code editing | Edit on host; volumes are mounted into container |

### Reset everything

```bash
docker compose -f devcontainer/compose.influxdb.yaml down -v
# Re-run step 2. Recreate GRAFANA_TOKEN after volume wipe.
```

---

## Testing

11 integration tests covering auth, protected endpoints, input validation, and dashboard creation.

```bash
# Run from project root
npm test -w server
```

| # | Test | Assertion |
|---|---|---|
| 1 | `GET /healthz` | 200 + `"ok"` |
| 2 | `POST /auth/login` — empty body | 400 — fields required |
| 3 | `POST /auth/login` — bad URL | 400 — invalid URL format |
| 4 | `POST /auth/login` — valid | 200 + `set-cookie: sid=…` |
| 5 | `POST /auth/logout` | 200 + `ok:true` |
| 6 | `GET /api/buckets` — no session | 401 |
| 7 | `GET /api/measurements` — no session | 401 |
| 8 | `GET /api/buckets` — with session | 200 + bucket list |
| 9 | `POST /api/query/spec` — missing time | 400 — `time.start required` |
| 10 | `POST /api/create-filtered-dashboard` — no measurement | 400 |
| 11 | `POST /api/create-filtered-dashboard` — cross-measurement missing fields | 400 |

Global `fetch` is mocked via `jest.fn()` — tests run without InfluxDB or Grafana.

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/auth/login` | POST | Authenticate with InfluxDB URL + Token |
| `/auth/logout` | POST | Clear session |
| `/api/buckets` | GET | List all buckets |
| `/api/measurements` | GET | List measurements (`?bucketId=&start=`) |
| `/api/fields` | GET | List fields (`?bucketId=&measurement=&start=`) |
| `/api/tag-keys` | GET | List tag keys (`?bucketId=&measurement=&start=`) |
| `/api/tag-values` | GET | List tag values (`?bucketId=&tag=&measurement=&field=&start=&filters=`) |
| `/api/query/spec` | POST | Execute structured query spec → Flux |
| `/api/query` | POST | Execute raw Flux query |
| `/api/create-filtered-dashboard` | POST | Create/overwrite Grafana dashboard (filters, aggregation, groupBy) |
| `/graphql` | POST | GraphQL: `getBuckets`, `login`, `logout` |
| `/healthz` | GET | Health check |

> All `/api/*` endpoints require a valid session. Schema discovery defaults to `start=-365d`.

---

## Test Data

`script/influx_testdata_augmented.csv`:

| Property | Value |
|---|---|
| `_measurement` | `m` |
| `_field` | `mem` |
| Tags | `host` (A/B/C), `region` (east), `env` (prod/staging/dev), `service` (billing/api/ml), `rack` (r1/r2/r3), `az` (a/b) |
| Time range | 2025-08-31 00:52 – 04:52 (4 hours, ~240 points) |

Upload additional CSVs with different measurements/fields to test cross-measurement queries.
