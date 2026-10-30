# Mini Task Manager (Full-Stack + Redis + Docker)

A lightweight, beginner-friendly, production-style reference project designed to demonstrate how **Next.js**, **NestJS**, **PostgreSQL**, **Redis**, and **Docker** work together in harmony.

---

## Architecture Diagram

```
                                  +----------------------------------------------------+
                                  |                 DOCKER COMPOSE                     |
                                  |                                                    |
[ Web Browser ]                   |   +--------------------+                           |
       |                          |   |  frontend service  |                           |
       | 1. HTTP (Port 3000)      |   |  (Next.js App)     |                           |
       +----------------------------->|  Port: 3000        |                           |
       |                          |   +--------------------+                           |
       |                          |                                                    |
       | 2. REST API (Port 4000)  |   +--------------------+                           |
       +----------------------------->|  backend service   |                           |
       |                              |  (NestJS + Prisma) |                           |
       |                              |  Port: 4000        |                           |
       |                              +---------+----------+                           |
       |                                        |                                      |
       |                     +------------------+------------------+                   |
       |                     | (Docker Bridge Network: task_network)                   |
       |                     v                                     v                   |
       |           +-------------------+                 +-------------------+         |
       |           |   redis service   |                 | postgres service  |         |
       |           |   (Redis 7 Cache) |                 | (PostgreSQL 16)   |         |
       |           |   Port: 6379      |                 | Port: 5432        |         |
       |           +-------------------+                 +---------+---------+         |
       |                                                           |                   |
       +-----------------------------------------------------------+-------------------+
                                                                   |
                                                         [ Persistent Volume ]
                                                            (postgres_data)
```

---

## How a Request Travels Through the System

### Case A: Fetching Tasks (`GET /tasks`)
1. **User interaction:** The user loads `http://localhost:3000` in their browser.
2. **Frontend request:** Next.js client-side code issues `fetch('http://localhost:4000/tasks')`.
3. **Backend intercept:** NestJS `TasksController` receives the request and delegates it to `TasksService.findAll()`.
4. **Cache check:** `TasksService` queries Redis for the key `tasks:all`:
   - **Cache Hit:** If data exists in Redis, backend prints `CACHE HIT` to logs and immediately returns cached JSON. PostgreSQL is never touched.
   - **Cache Miss:** If key is not in Redis, backend prints `CACHE MISS`, queries PostgreSQL via Prisma (`prisma.task.findMany()`), stores the result into Redis with a 60-second TTL (`EX 60`), and returns the data to the browser.

### Case B: Mutating Tasks (`POST`, `PATCH`, `DELETE`)
1. **User action:** The user adds, completes, or deletes a task.
2. **Database write:** NestJS performs the operation in PostgreSQL via Prisma.
3. **Cache Invalidation:** Immediately upon success, `TasksService` deletes the Redis key `tasks:all`.
4. **Next fetch:** The subsequent `GET /tasks` will encounter a `CACHE MISS`, fetching fresh data from PostgreSQL and re-warming Redis.

---

## Quick Start (Docker Compose)

### 1. Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

### 2. Configure Environment
```bash
cp .env.example .env
```

### 3. Build and Run All Services
```bash
docker compose up --build
```
*(Add `-d` to run in detached background mode: `docker compose up --build -d`)*

### 4. Access the Applications
- **Frontend UI:** [http://localhost:3000](http://localhost:3000)
- **Backend API:** [http://localhost:4000/tasks](http://localhost:4000/tasks)
- **PostgreSQL:** `localhost:5432`
- **Redis:** `localhost:6379`

---

## Essential Docker Concepts

| Concept | What It Is | Role in this Project |
| :--- | :--- | :--- |
| **Image** | A read-only template with code, runtime, libraries, and tools. | `node:20-alpine`, `postgres:16-alpine`, `redis:7-alpine`. |
| **Container** | A runnable, isolated instance of a Docker image. | The 4 running containers: `task-manager-frontend`, `task-manager-backend`, etc. |
| **Volume** | Persistent storage independent of container lifecycle. | `postgres_data` prevents database loss when containers are stopped or deleted. |
| **Network** | A virtual software network connecting containers. | `task_network` provides DNS resolution so backend reaches `postgres` and `redis` by name. |
| **Service** | A configuration in `docker-compose.yml` declaring an image, ports, env, and dependencies. | `frontend`, `backend`, `postgres`, `redis`. |

---

## Environment Variables Deep Dive

### Backend Variables
- `PORT=4000`: Port NestJS listens on.
- `DATABASE_URL=postgresql://task_user:task_password@postgres:5432/task_db?schema=public`: Database connection string using the Docker service name `postgres`.
- `REDIS_HOST=redis`: Redis hostname inside Docker network.
- `REDIS_PORT=6379`: Redis internal port.
- `REDIS_TTL=60`: Cache lifespan in seconds.

### Frontend Variables
- `NEXT_PUBLIC_API_URL=http://localhost:4000`: Base URL the browser uses to call the NestJS API.

### Key Conceptual Questions Answered:
1. **Why `localhost` inside a container is different from your Mac:**
   Each container runs in its own network namespace. Inside `backend`, `localhost` points to the `backend` container itself, NOT your Mac and NOT PostgreSQL.
2. **Why the backend uses `postgres` and `redis` as hostnames:**
   Docker Compose runs an internal DNS server. Containers on the same bridge network resolve sibling container service names (`postgres`, `redis`) to their private IP addresses.
3. **Why browser-facing API URLs differ from container-to-container URLs:**
   Your web browser runs directly on your Mac (host OS), not inside the Docker bridge network. Therefore, the browser must reach the backend using published host ports (`http://localhost:4000`).
4. **Build-time vs Runtime variables in Next.js:**
   Variables prefixed with `NEXT_PUBLIC_` are evaluated and hard-coded into the static JavaScript bundle during `next build`. Normal server-side environment variables are read dynamically at runtime.
5. **Why frontend secrets must never use `NEXT_PUBLIC_`:**
   Any variable prefixed with `NEXT_PUBLIC_` is shipped in plaintext inside the JavaScript bundle to every user visiting your site. Anyone can view them via browser developer tools.

---

## Step-by-Step Testing & Verification

### 1. View Container Status
```bash
docker compose ps
```

### 2. Verify Redis Cache Miss & Cache Hit
Stream the backend logs in a terminal:
```bash
docker compose logs -f backend
```
- Open [http://localhost:3000](http://localhost:3000) or run `curl http://localhost:4000/tasks`.
- Observe output: `CACHE MISS` (queried PostgreSQL and saved in Redis).
- Refresh the page within 60 seconds:
- Observe output: `CACHE HIT` (retrieved directly from Redis memory).

### 3. Verify Cache Invalidation on Mutations
- In the frontend, add a new task: "Learn Redis with Docker".
- In the backend logs, observe: `[CACHE INVALIDATED] tasks:all removed due to task creation`.
- Next fetch immediately triggers `CACHE MISS` to retrieve the new task from PostgreSQL and re-cache it.

### 4. Inspect Redis Cache Keys Directly
```bash
# Connect to Redis CLI
docker compose exec redis redis-cli

# Inside redis-cli:
KEYS *
# Output: 1) "tasks:all"

TTL tasks:all
# Shows remaining seconds (e.g. 54)

GET tasks:all
# Prints the JSON array of tasks

exit
```

### 5. Inspect PostgreSQL Database Records Directly
```bash
# Connect to PostgreSQL psql CLI
docker compose exec postgres psql -U task_user -d task_db

# Inside psql:
\dt
# List tables (shows "Task")

SELECT id, title, completed, "createdAt" FROM "Task";

\q
```

### 6. Verify Data Persistence
```bash
# Stop and destroy containers (volumes are preserved)
docker compose down

# Start containers again
docker compose up -d

# Check data in PostgreSQL or reload http://localhost:3000
docker compose exec postgres psql -U task_user -d task_db -c 'SELECT COUNT(*) FROM "Task";'
```

### 7. Test Redis Restart & Resiliency
```bash
# Restart the Redis container
docker compose restart redis

# Reload http://localhost:3000
# Notice that backend gracefully reconnects, encounters a CACHE MISS, and repopulates Redis!
```

### 8. Test Backend Outage & Frontend Error State
```bash
# Stop backend container
docker compose stop backend

# Refresh http://localhost:3000
# Observe clean frontend error state: "⚠️ Failed to load tasks (or Unable to connect)"
# Click "Retry" after restarting backend:
docker compose start backend
```

---

## Useful Debugging Commands

```bash
# View combined logs
docker compose logs

# Follow logs of a specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
docker compose logs -f redis

# Check container resource usage (CPU/Memory)
docker stats

# Open an interactive shell inside a container
docker compose exec backend sh
docker compose exec frontend sh

# Reset everything (including database volume)
docker compose down -v
```

---

## CI/CD Pipeline (GitHub Actions)

The repository includes a production-ready automated CI/CD pipeline located at [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml).

### Workflow Stages:
1. **`backend-ci`**: Installs dependencies, runs `prisma generate`, and verifies NestJS compiles cleanly.
2. **`frontend-ci`**: Installs dependencies and verifies Next.js builds for production.
3. **`docker-integration-test`**: Validates `docker-compose.yml`, builds images, launches the stack in a temporary test runner, and performs automated HTTP smoke tests against `http://localhost:4000/tasks` and `http://localhost:3000`.
4. **`cd-publish-images`**: When code merges into `main` or `master`, Docker Buildx automatically builds and pushes versioned production images (`:latest` and `:<commit-sha>`) directly to **GitHub Container Registry (GHCR)**:
   - `ghcr.io/<your-username>/task-manager-backend:latest`
   - `ghcr.io/<your-username>/task-manager-frontend:latest`
