# ─── Stage 1: Build ─────────────────────────────────────────────────────────
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Cache dependency downloads
COPY go.mod go.sum ./
RUN go mod download

# Install swag CLI to generate Swagger docs
RUN go install github.com/swaggo/swag/cmd/swag@latest

# Copy source, generate docs, then build
COPY . .
RUN swag init
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server .

# ─── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM alpine:3.21

# ca-certificates needed for outbound HTTPS (R2, SMTP, etc.)
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

COPY --from=builder /app/server .
COPY --from=builder /app/docs ./docs

EXPOSE 8080

CMD ["./server"]
