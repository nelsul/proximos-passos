package middleware

import (
	"context"
	"net/http"

	"proximos-passos/backend/internal/adapter/response"
	"proximos-passos/backend/internal/domain/apperror"
	"proximos-passos/backend/internal/domain/entity"
	"proximos-passos/backend/internal/domain/repository"
	"proximos-passos/backend/internal/infrastructure/jwt"
)

type contextKey string

const (
	userPublicIDKey contextKey = "user_public_id"
	userRoleKey     contextKey = "user_role"
)

func Auth(jwtService *jwt.Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie(jwt.CookieName)
			if err != nil {
				response.Error(w, apperror.ErrUnauthorized)
				return
			}

			claims, err := jwtService.Parse(cookie.Value)
			if err != nil {
				response.Error(w, apperror.ErrUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), userPublicIDKey, claims.UserPublicID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RequireAdmin(repo repository.UserRepository) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			publicID := UserPublicID(r.Context())
			if publicID == "" {
				response.Error(w, apperror.ErrUnauthorized)
				return
			}

			user, err := repo.GetByPublicID(r.Context(), publicID)
			if err != nil || user == nil {
				response.Error(w, apperror.ErrUnauthorized)
				return
			}

			if user.Role != entity.UserRoleAdmin {
				response.Error(w, apperror.ErrForbidden)
				return
			}

			ctx := context.WithValue(r.Context(), userRoleKey, user.Role)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func UserPublicID(ctx context.Context) string {
	v, _ := ctx.Value(userPublicIDKey).(string)
	return v
}

func UserRole(ctx context.Context) entity.UserRole {
	v, _ := ctx.Value(userRoleKey).(entity.UserRole)
	return v
}
