package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	httpSwagger "github.com/swaggo/http-swagger"

	_ "proximos-passos/backend/docs"
)

// @title           Proximos Passos API
// @version         1.0
// @description     API server for Proximos Passos.

// @host            localhost:8080
// @BasePath        /

func main() {
	mux := http.NewServeMux()

	// healthCheck godoc
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
