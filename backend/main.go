package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"

	httpSwagger "github.com/swaggo/http-swagger"

	_ "proximos-passos/backend/docs"
	"proximos-passos/backend/internal/adapter/handler"
	"proximos-passos/backend/internal/infrastructure/postgres"
	"proximos-passos/backend/internal/usecase"
)

// @title           Proximos Passos API
// @version         1.0
// @description     API server for Proximos Passos.

// @host            localhost:8080
// @BasePath        /

func main() {
	ctx := context.Background()

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}

	pool, err := postgres.NewConnection(ctx, databaseURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer pool.Close()

	userRepo := postgres.NewUserRepository(pool)
	userUC := usecase.NewUserUseCase(userRepo)
	userHandler := handler.NewUserHandler(userUC)

	mux := http.NewServeMux()

	// @Summary     Health check
	// @Description Returns the health status of the API
	// @Tags        health
	// @Produce     json
	// @Success     200 {object} map[string]string
	// @Router      /health [get]
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status": "ok"}`)
	})

	userHandler.RegisterRoutes(mux)
	mux.Handle("GET /swagger/", httpSwagger.WrapHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Backend listening on :%s", port)
	log.Printf("Swagger UI available at http://localhost:%s/swagger/index.html", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
