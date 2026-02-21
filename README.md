# Próximos Passos

![Próximos Passos](https://proximos-passos.nelsul.dev/app_example_en.webp)

**[👉 Access the Live Platform Here](https://proximos-passos.nelsul.dev)**

A full-stack, modern educational platform built for students preparing for public exams and university entrance exams. It provides powerful tools for studying, practicing questions, and tracking progress.

Built with a fast **Go** backend and a sleek **Next.js** frontend.

## 📋 Summary

- [🚀 Features](#-features)
- [🔌 Core Integrations](#-core-integrations)
- [🛠️ Dev Container](#️-dev-container)
- [🏃 Running the apps](#-running-the-apps)
- [📚 API Documentation (Swagger)](#-api-documentation-swagger)
- [🗄️ Database Reference](#-database-reference)

## 🚀 Features

- **Practice Questions**: Extensive question bank with categorized answer keys.
- **Classes & Groups**: Form study groups and track student activities.
- **Activities & Playlists**: Build rich playlists of videos, handouts, and questions.
- **AI Grading**: Open-ended questions are auto-graded by AI with detailed feedback.

## 🔌 Core Integrations

- **Cloudflare R2**: High-performance, S3-compatible object storage for robustly hosting all platform documents, assets, and media.
- **Resend**: Modern and reliable email API utilized for sending account verifications, group invites, and important system notifications.
- **GitHub Actions**: Fully automated CI/CD pipelines ensuring seamless testing, building, and deployment cycles straight to production.

## 🛠️ Dev Container

This project is optimized for a VS Code Dev Container environment:

| Component      | Version |
| -------------- | ------- |
| **Go**         | 1.24    |
| **Node.js**    | 22 LTS  |
| **PostgreSQL** | 17      |

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

### Database Reference

PostgreSQL is available at `localhost:5432` inside the container.

- **Host**: `localhost`
- **Port**: `5432`
- **User**: `postgres`
- **Password**: `postgres`
- **Database**: `proximospassos`

**Connection string:** `postgres://postgres:postgres@localhost:5432/proximospassos?sslmode=disable`
_(Available via the `DATABASE_URL` environment variable)_
