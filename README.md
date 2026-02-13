# Próximos Passos

Full-stack application with a Go backend and Next.js frontend.

## Dev Container

This project uses a VS Code Dev Container with:

| Component  | Version |
| ---------- | ------- |
| Go         | 1.24    |
| Node.js    | 22 LTS  |
| PostgreSQL | 17      |

### Getting Started

1. Open this folder in VS Code
2. When prompted, click **"Reopen in Container"** (or run `Dev Containers: Reopen in Container` from the command palette)
3. Wait for the container to build and dependencies to install

### Running the apps

**Backend** (port 8080):

```bash
cd backend && go run .
```

**Frontend** (port 3000):

```bash
cd frontend && npm run dev
```

### API Documentation (Swagger)

The backend uses [swaggo/swag](https://github.com/swaggo/swag) to generate OpenAPI/Swagger docs from code annotations.

**Swagger UI:** http://localhost:8080/swagger/index.html (available when the backend is running)

To regenerate docs after modifying or adding API annotations:

```bash
cd backend && swag init
```

### Database

PostgreSQL is available at `localhost:5432` inside the container.

| Setting  | Value          |
| -------- | -------------- |
| Host     | localhost      |
| Port     | 5432           |
| User     | postgres       |
| Password | postgres       |
| Database | proximospassos |

Connection string: `postgres://postgres:postgres@localhost:5432/proximospassos?sslmode=disable`

Available via the `DATABASE_URL` environment variable.
