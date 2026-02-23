package handler

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"proximos-passos/backend/internal/adapter/dto"
	"proximos-passos/backend/internal/adapter/response"
	"proximos-passos/backend/internal/domain/apperror"
	"proximos-passos/backend/internal/domain/entity"
	"proximos-passos/backend/internal/infrastructure/jwt"
	"proximos-passos/backend/internal/usecase"
)

type AuthHandler struct {
	authUC     *usecase.AuthUseCase
	userUC     *usecase.UserUseCase
	setupInput *usecase.SetupAdminInput
}

func NewAuthHandler(authUC *usecase.AuthUseCase, userUC *usecase.UserUseCase, setupInput *usecase.SetupAdminInput) *AuthHandler {
	return &AuthHandler{authUC: authUC, userUC: userUC, setupInput: setupInput}
}

func (h *AuthHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /auth/setup", h.SetupAdmin)
	mux.HandleFunc("POST /auth/register", h.Register)
	mux.HandleFunc("POST /auth/login", h.Login)
	mux.HandleFunc("POST /auth/logout", h.Logout)
	mux.HandleFunc("POST /auth/verify-email", h.VerifyEmail)
	mux.HandleFunc("POST /auth/request-verification", h.RequestVerification)
}

func (h *AuthHandler) RegisterProtectedRoutes(mux *http.ServeMux, mw func(http.Handler) http.Handler) {
	mux.Handle("POST /auth/resend-verification", mw(http.HandlerFunc(h.ResendVerification)))
}

// SetupAdmin godoc
// @Summary     Setup admin
// @Description Creates the default admin user if no users exist
// @Tags        auth
// @Produce     json
// @Success     201 {object} dto.UserResponse
// @Failure     409 {object} apperror.AppError
// @Failure     500 {object} apperror.AppError
// @Router      /auth/setup [post]
func (h *AuthHandler) SetupAdmin(w http.ResponseWriter, r *http.Request) {
	user, err := h.userUC.SetupAdmin(r.Context(), *h.setupInput)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, dto.UserToResponse(user))
}

// Register godoc
// @Summary     Register
// @Description Creates a new user with regular role and sends a verification email
// @Tags        auth
// @Accept      json
// @Produce     json
// @Param       body body     dto.RegisterRequest true "Registration data"
// @Success     201  {object} dto.UserResponse
// @Failure     400  {object} apperror.AppError
// @Failure     409  {object} apperror.AppError
// @Failure     500  {object} apperror.AppError
// @Router      /auth/register [post]
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req dto.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidBody)
		return
	}

	input := usecase.CreateUserInput{
		Name:     req.Name,
		Email:    strings.ToLower(strings.TrimSpace(req.Email)),
		Password: req.Password,
		Role:     entity.UserRoleRegular,
	}

	user, err := h.userUC.Create(r.Context(), input)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, dto.UserToResponse(user))
}

// Login godoc
// @Summary     Login
// @Description Authenticates a user and sets a JWT cookie
// @Tags        auth
// @Accept      json
// @Produce     json
// @Param       body body     dto.LoginRequest true "Credentials"
// @Success     200  {object} dto.LoginResponse
// @Failure     400  {object} apperror.AppError
// @Failure     401  {object} apperror.AppError
// @Failure     500  {object} apperror.AppError
// @Router      /auth/login [post]
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req dto.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidBody)
		return
	}

	output, err := h.authUC.Login(r.Context(), usecase.LoginInput{
		Email:    strings.ToLower(strings.TrimSpace(req.Email)),
		Password: req.Password,
	})
	if err != nil {
		response.Error(w, err)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     jwt.CookieName,
		Value:    output.Token,
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteNoneMode,
		Expires:  time.Unix(output.ExpiresAt, 0),
	})

	response.JSON(w, http.StatusOK, dto.LoginResponse{
		Token:     output.Token,
		ExpiresAt: output.ExpiresAt,
	})
}

// Logout godoc
// @Summary     Logout
// @Description Clears the JWT cookie
// @Tags        auth
// @Produce     json
// @Success     204 "No Content"
// @Router      /auth/logout [post]
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     jwt.CookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteNoneMode,
		MaxAge:   -1,
	})

	w.WriteHeader(http.StatusNoContent)
}

// VerifyEmail godoc
// @Summary     Verify email
// @Description Verifies a user's email using a verification token
// @Tags        auth
// @Accept      json
// @Produce     json
// @Param       body body     dto.VerifyEmailRequest true "Verification token"
// @Success     204  "No Content"
// @Failure     400  {object} apperror.AppError
// @Failure     409  {object} apperror.AppError
// @Failure     500  {object} apperror.AppError
// @Router      /auth/verify-email [post]
func (h *AuthHandler) VerifyEmail(w http.ResponseWriter, r *http.Request) {
	var req dto.VerifyEmailRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidBody)
		return
	}

	if req.Token == "" {
		response.Error(w, apperror.ErrInvalidInput)
		return
	}

	if err := h.userUC.VerifyEmail(r.Context(), req.Token); err != nil {
		response.Error(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// RequestVerification godoc
// @Summary     Request verification email
// @Description Sends a verification email to the given address if the account exists and is not yet verified. Subject to cooldown.
// @Tags        auth
// @Accept      json
// @Produce     json
// @Param       body body     dto.RequestVerificationRequest true "Email"
// @Success     204  "No Content"
// @Failure     400  {object} apperror.AppError
// @Failure     429  {object} apperror.AppError
// @Failure     500  {object} apperror.AppError
// @Router      /auth/request-verification [post]
func (h *AuthHandler) RequestVerification(w http.ResponseWriter, r *http.Request) {
	var req dto.RequestVerificationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidBody)
		return
	}

	if err := h.userUC.RequestVerificationByEmail(r.Context(), req.Email); err != nil {
		response.Error(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ResendVerification godoc
// @Summary     Resend verification email
// @Description Resends the verification email for a user
// @Tags        auth
// @Accept      json
// @Produce     json
// @Security    CookieAuth
// @Param       body body     dto.ResendVerificationRequest true "User ID"
// @Success     204  "No Content"
// @Failure     400  {object} apperror.AppError
// @Failure     401  {object} apperror.AppError
// @Failure     403  {object} apperror.AppError
// @Failure     404  {object} apperror.AppError
// @Failure     409  {object} apperror.AppError
// @Failure     500  {object} apperror.AppError
// @Router      /auth/resend-verification [post]
func (h *AuthHandler) ResendVerification(w http.ResponseWriter, r *http.Request) {
	var req dto.ResendVerificationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidBody)
		return
	}

	if req.UserID == "" {
		response.Error(w, apperror.ErrInvalidInput)
		return
	}

	if err := h.userUC.ResendVerificationEmail(r.Context(), req.UserID); err != nil {
		response.Error(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
