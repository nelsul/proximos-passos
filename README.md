# Próximos Passos

![Próximos Passos](https://proximos-passos.nelsul.dev/app_example_en.webp)

**[👉 Access the Live Platform Here](https://proximos-passos.tech)**

A full-stack, modern educational platform built for students preparing for public exams and university entrance exams. It provides powerful tools for studying, practicing questions, and tracking progress.

Built with a fast **Go** backend and a sleek **Next.js** frontend.

## 📋 Summary

- [🚀 Features](#-features)
- [🔌 Core Integrations](#-core-integrations)
- [💻 Running Locally (No Docker)](#-running-locally-no-docker)
- [🛠️ Dev Container](#️-dev-container)
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

---

## 💻 Running Locally (No Docker)

Use this if you already have **Go**, **Node.js**, and **PostgreSQL** installed on your machine and want to run without dev containers or Docker.

### Prerequisites

| Tool           | Version               |
| -------------- | --------------------- |
| **Go**         | 1.24+                 |
| **Node.js**    | 22 LTS+               |
| **PostgreSQL** | 15+ (running locally) |

### 1. Environment Variables

A single `.env` file at the **project root** is shared by both services. Copy the template and fill in your values:

```bash
cp .env.example .env
```

Then open `.env` and at minimum set:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/proximospassos?sslmode=disable
JWT_SECRET=dev-secret-change-in-production
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8080
PORT=8080
ADMIN_NAME=Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=changeme
```

R2 (file uploads) and Resend (email) keys are optional for local development.

### 2. Database Setup

Make sure your PostgreSQL instance is running. Create the database and apply the schema:

```bash
createdb proximospassos
psql -d proximospassos -f database/setup.sql
```

### 3. Backend

Source the root `.env` and start the Go server (port 8080):

```bash
export $(grep -v '^#' .env | xargs) && cd backend && go run .
```

> For live-reload, install [air](https://github.com/air-verse/air) and run `air` instead of `go run .`

### 4. Frontend

Source the root `.env` and start the Next.js dev server (port 3000):

```bash
export $(grep -v '^#' .env | xargs) && cd frontend && npm install && npm run dev
```

The app will be available at **http://localhost:3000**.

---

## 🛠️ Dev Container

This project is also optimized for a VS Code Dev Container environment:

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

## 📚 API Documentation (Swagger)

The backend uses [swaggo/swag](https://github.com/swaggo/swag) to generate OpenAPI/Swagger docs from code annotations.

**Swagger UI:** http://localhost:8080/swagger/index.html (available when the backend is running)

To regenerate docs after modifying or adding API annotations:

```bash
cd backend && swag init
```

## 🗄️ Database Reference

PostgreSQL connection defaults (used in both local and dev container setups):

- **Host**: `localhost`
- **Port**: `5432`
- **User**: `postgres`
- **Password**: `postgres`
- **Database**: `proximospassos`

**Connection string:** `postgres://postgres:postgres@localhost:5432/proximospassos?sslmode=disable`
_(Available via the `DATABASE_URL` environment variable)_
