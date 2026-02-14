package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	httpSwagger "github.com/swaggo/http-swagger"

	_ "proximos-passos/backend/docs"
	"proximos-passos/backend/internal/adapter/handler"
	"proximos-passos/backend/internal/adapter/middleware"
	"proximos-passos/backend/internal/infrastructure/jwt"
	"proximos-passos/backend/internal/infrastructure/postgres"
	"proximos-passos/backend/internal/infrastructure/r2"
	"proximos-passos/backend/internal/infrastructure/resend"
	"proximos-passos/backend/internal/usecase"
)

// @title           Proximos Passos API
// @version         1.0
// @description     API server for Proximos Passos.

// @host            localhost:8080
// @BasePath        /

// @securityDefinitions.apikey CookieAuth
// @in                         cookie
// @name                       token

func main() {
	ctx := context.Background()

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET environment variable is required")
	}

	resendAPIKey := os.Getenv("RESEND_API_KEY")
	if resendAPIKey == "" {
		log.Fatal("RESEND_API_KEY environment variable is required")
	}

	resendFromEmail := os.Getenv("RESEND_FROM_EMAIL")
	if resendFromEmail == "" {
		log.Fatal("RESEND_FROM_EMAIL environment variable is required")
	}

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		log.Fatal("FRONTEND_URL environment variable is required")
	}

	logoFullURL := os.Getenv("LOGO_FULL_URL")
	if logoFullURL == "" {
		log.Fatal("LOGO_FULL_URL environment variable is required")
	}

	r2AccountID := os.Getenv("R2_ACCOUNT_ID")
	if r2AccountID == "" {
		log.Fatal("R2_ACCOUNT_ID environment variable is required")
	}

	r2AccessKeyID := os.Getenv("R2_ACCESS_KEY_ID")
	if r2AccessKeyID == "" {
		log.Fatal("R2_ACCESS_KEY_ID environment variable is required")
	}

	r2AccessKeySecret := os.Getenv("R2_ACCESS_KEY_SECRET")
	if r2AccessKeySecret == "" {
		log.Fatal("R2_ACCESS_KEY_SECRET environment variable is required")
	}

	r2Bucket := os.Getenv("R2_BUCKET")
	if r2Bucket == "" {
		log.Fatal("R2_BUCKET environment variable is required")
	}

	r2PublicURL := os.Getenv("R2_PUBLIC_URL")
	if r2PublicURL == "" {
		log.Fatal("R2_PUBLIC_URL environment variable is required")
	}

	pool, err := postgres.NewConnection(ctx, databaseURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer pool.Close()

	adminName := os.Getenv("ADMIN_NAME")
	adminEmail := os.Getenv("ADMIN_EMAIL")
	adminPassword := os.Getenv("ADMIN_PASSWORD")

	verificationCooldownStr := os.Getenv("VERIFICATION_COOLDOWN_SECONDS")
	if verificationCooldownStr == "" {
		verificationCooldownStr = "180"
	}
	verificationCooldownSecs, err := strconv.Atoi(verificationCooldownStr)
	if err != nil {
		log.Fatal("VERIFICATION_COOLDOWN_SECONDS must be a valid integer")
	}
	verificationCooldown := time.Duration(verificationCooldownSecs) * time.Second

	setupInput := &usecase.SetupAdminInput{
		Name:     adminName,
		Email:    adminEmail,
		Password: adminPassword,
	}

	jwtService := jwt.NewService(jwtSecret, 24*time.Hour)
	emailSvc := resend.NewEmailService(resendAPIKey, resendFromEmail, logoFullURL)

	storageSvc, err := r2.NewStorageService(r2AccountID, r2AccessKeyID, r2AccessKeySecret, r2Bucket, r2PublicURL)
	if err != nil {
		log.Fatalf("failed to initialize R2 storage: %v", err)
	}

	userRepo := postgres.NewUserRepository(pool)
	groupRepo := postgres.NewGroupRepository(pool)
	activityRepo := postgres.NewActivityRepository(pool)
	userUC := usecase.NewUserUseCase(userRepo, emailSvc, storageSvc, jwtService, frontendURL, verificationCooldown)
	authUC := usecase.NewAuthUseCase(userRepo, jwtService)
	groupUC := usecase.NewGroupUseCase(groupRepo, userRepo, storageSvc)
	activityUC := usecase.NewActivityUseCase(activityRepo, groupRepo, userRepo, storageSvc)

	authHandler := handler.NewAuthHandler(authUC, userUC, setupInput)
	userHandler := handler.NewUserHandler(userUC)
	groupHandler := handler.NewGroupHandler(groupUC)
	activityHandler := handler.NewActivityHandler(activityUC)

	adminOnly := func(next http.Handler) http.Handler {
		return middleware.Auth(jwtService)(middleware.RequireAdmin(userRepo)(next))
	}

	authOnly := func(next http.Handler) http.Handler {
		return middleware.Auth(jwtService)(next)
	}

	authWithRole := func(next http.Handler) http.Handler {
		return middleware.AuthWithRole(jwtService, userRepo)(next)
	}

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

	authHandler.RegisterRoutes(mux)
	authHandler.RegisterProtectedRoutes(mux, adminOnly)
	userHandler.RegisterRoutes(mux, adminOnly)
	userHandler.RegisterSelfRoutes(mux, authOnly)
	groupHandler.RegisterRoutes(mux, adminOnly, authWithRole)
	groupHandler.RegisterSelfRoutes(mux, authOnly)
	groupHandler.RegisterMemberRoutes(mux, adminOnly, authWithRole)
	activityHandler.RegisterRoutes(mux, authWithRole)
	mux.Handle("GET /swagger/", httpSwagger.WrapHandler)

	port := os.Getenv("PORT")
	if port == "" {
		log.Fatal("PORT environment variable is required")
	}

	log.Printf("Backend listening on :%s", port)
	log.Printf("Swagger UI available at http://localhost:%s/swagger/index.html", port)
	if err := http.ListenAndServe(":"+port, middleware.CORS(mux)); err != nil {
		log.Fatal(err)
	}
}
