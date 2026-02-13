package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"proximos-passos/backend/internal/adapter/dto"
	"proximos-passos/backend/internal/adapter/response"
	"proximos-passos/backend/internal/domain/apperror"
	"proximos-passos/backend/internal/domain/entity"
	"proximos-passos/backend/internal/usecase"
)

type UserHandler struct {
	uc *usecase.UserUseCase
}

func NewUserHandler(uc *usecase.UserUseCase) *UserHandler {
	return &UserHandler{uc: uc}
}

func (h *UserHandler) RegisterRoutes(mux *http.ServeMux, mw func(http.Handler) http.Handler) {
	mux.Handle("POST /users", mw(http.HandlerFunc(h.Create)))
	mux.Handle("GET /users", mw(http.HandlerFunc(h.List)))
	mux.Handle("GET /users/{id}", mw(http.HandlerFunc(h.GetByID)))
	mux.Handle("PUT /users/{id}", mw(http.HandlerFunc(h.Update)))
	mux.Handle("DELETE /users/{id}", mw(http.HandlerFunc(h.Delete)))
}

// Create godoc
// @Summary     Create a user
// @Description Creates a new user account
// @Tags        users
// @Accept      json
// @Produce     json
// @Security    CookieAuth
// @Param       body body     dto.CreateUserRequest true "User data"
// @Success     201  {object} dto.UserResponse
// @Failure     400  {object} apperror.AppError
// @Failure     401  {object} apperror.AppError
// @Failure     403  {object} apperror.AppError
// @Failure     409  {object} apperror.AppError
// @Failure     500  {object} apperror.AppError
// @Router      /users [post]
func (h *UserHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req dto.CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidBody)
		return
	}

	input := usecase.CreateUserInput{
		Name:     req.Name,
		Email:    req.Email,
		Password: req.Password,
		Role:     entity.UserRole(req.Role),
	}

	user, err := h.uc.Create(r.Context(), input)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, dto.UserToResponse(user))
}

// List godoc
// @Summary     List users
// @Description Returns a paginated list of users
// @Tags        users
// @Produce     json
// @Security    CookieAuth
// @Param       page_number query    int false "Page number" default(1)
// @Param       page_size   query    int false "Page size"   default(20)
// @Success     200         {object} dto.UserListResponse
// @Failure     401         {object} apperror.AppError
// @Failure     403         {object} apperror.AppError
// @Failure     500         {object} apperror.AppError
// @Router      /users [get]
func (h *UserHandler) List(w http.ResponseWriter, r *http.Request) {
	pageNumber, _ := strconv.Atoi(r.URL.Query().Get("page_number"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	users, totalItems, err := h.uc.List(r.Context(), pageNumber, pageSize)
	if err != nil {
		response.Error(w, err)
		return
	}

	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	if pageNumber < 1 {
		pageNumber = 1
	}

	totalPages := (totalItems + pageSize - 1) / pageSize

	response.JSON(w, http.StatusOK, dto.UserListResponse{
		Data:       dto.UsersToResponse(users),
		PageNumber: pageNumber,
		PageSize:   pageSize,
		TotalItems: totalItems,
		TotalPages: totalPages,
	})
}

// GetByID godoc
// @Summary     Get a user
// @Description Returns a user by their public ID
// @Tags        users
// @Produce     json
// @Security    CookieAuth
// @Param       id  path     string true "User public ID (UUID)"
// @Success     200 {object} dto.UserResponse
// @Failure     401 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Failure     404 {object} apperror.AppError
// @Failure     500 {object} apperror.AppError
// @Router      /users/{id} [get]
func (h *UserHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")

	user, err := h.uc.GetByPublicID(r.Context(), publicID)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.UserToResponse(user))
}

// Update godoc
// @Summary     Update a user
// @Description Updates user fields by their public ID
// @Tags        users
// @Accept      json
// @Produce     json
// @Security    CookieAuth
// @Param       id   path     string               true "User public ID (UUID)"
// @Param       body body     dto.UpdateUserRequest true "Fields to update"
// @Success     200  {object} dto.UserResponse
// @Failure     400  {object} apperror.AppError
// @Failure     401  {object} apperror.AppError
// @Failure     403  {object} apperror.AppError
// @Failure     404  {object} apperror.AppError
// @Failure     500  {object} apperror.AppError
// @Router      /users/{id} [put]
func (h *UserHandler) Update(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")

	var req dto.UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidBody)
		return
	}

	input := usecase.UpdateUserInput{
		Name:      req.Name,
		Email:     req.Email,
		AvatarURL: req.AvatarURL,
	}

	if req.Role != nil {
		role := entity.UserRole(*req.Role)
		input.Role = &role
	}

	user, err := h.uc.Update(r.Context(), publicID, input)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.UserToResponse(user))
}

// Delete godoc
// @Summary     Delete a user
// @Description Soft-deletes a user by their public ID
// @Tags        users
// @Produce     json
// @Security    CookieAuth
// @Param       id  path     string true "User public ID (UUID)"
// @Success     204 "No Content"
// @Failure     401 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Failure     404 {object} apperror.AppError
// @Failure     500 {object} apperror.AppError
// @Router      /users/{id} [delete]
func (h *UserHandler) Delete(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")

	if err := h.uc.Delete(r.Context(), publicID); err != nil {
		response.Error(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
