package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"proximos-passos/backend/internal/adapter/dto"
	"proximos-passos/backend/internal/adapter/middleware"
	"proximos-passos/backend/internal/adapter/response"
	"proximos-passos/backend/internal/domain/apperror"
	"proximos-passos/backend/internal/domain/repository"
	"proximos-passos/backend/internal/usecase"
)

type HandoutHandler struct {
	uc *usecase.HandoutUseCase
}

func NewHandoutHandler(uc *usecase.HandoutUseCase) *HandoutHandler {
	return &HandoutHandler{uc: uc}
}

func (h *HandoutHandler) RegisterRoutes(mux *http.ServeMux, adminMW, authMW func(http.Handler) http.Handler) {
	mux.Handle("POST /handouts", adminMW(http.HandlerFunc(h.Create)))
	mux.Handle("GET /handouts", authMW(http.HandlerFunc(h.List)))
	mux.Handle("GET /handouts/{id}", authMW(http.HandlerFunc(h.GetByID)))
	mux.Handle("PUT /handouts/{id}", adminMW(http.HandlerFunc(h.Update)))
	mux.Handle("POST /handouts/{id}/file", adminMW(http.HandlerFunc(h.ReplaceFile)))
	mux.Handle("DELETE /handouts/{id}", adminMW(http.HandlerFunc(h.Delete)))
}

// Create godoc
// @Summary     Create a handout
// @Description Creates a new handout with a PDF file upload (admin only)
// @Tags        handouts
// @Accept      multipart/form-data
// @Produce     json
// @Security    CookieAuth
// @Param       title       formData string   true  "Handout title"
// @Param       description formData string   false "Handout description"
// @Param       topic_ids   formData []string false "Topic public IDs"
// @Param       file        formData file     true  "PDF file"
// @Success     201 {object} dto.HandoutResponse
// @Failure     400 {object} apperror.AppError
// @Failure     401 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Failure     409 {object} apperror.AppError "Duplicate title"
// @Failure     500 {object} apperror.AppError
// @Router      /handouts [post]
func (h *HandoutHandler) Create(w http.ResponseWriter, r *http.Request) {
	userPublicID := middleware.UserPublicID(r.Context())

	if err := r.ParseMultipartForm(50 << 20); err != nil {
		response.Error(w, apperror.ErrFileTooLarge)
		return
	}

	title := r.FormValue("title")

	var description *string
	if desc := r.FormValue("description"); desc != "" {
		description = &desc
	}

	topicIDs := r.Form["topic_ids"]

	file, header, err := r.FormFile("file")
	if err != nil {
		response.Error(w, apperror.ErrInvalidInput)
		return
	}
	defer file.Close()

	handout, err := h.uc.Create(
		r.Context(),
		userPublicID,
		title,
		description,
		topicIDs,
		header.Filename,
		header.Header.Get("Content-Type"),
		header.Size,
		file,
	)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, dto.HandoutToResponse(handout))
}

// List godoc
// @Summary     List handouts
// @Description Returns a paginated list of handouts (admin only)
// @Tags        handouts
// @Produce     json
// @Security    CookieAuth
// @Param       page_number query int    false "Page number" default(1)
// @Param       page_size   query int    false "Page size"   default(10)
// @Param       title       query string false "Filter by title (partial match)"
// @Param       topic_id    query string false "Filter by topic public ID (UUID)"
// @Success     200 {object} dto.HandoutListResponse
// @Failure     401 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Failure     500 {object} apperror.AppError
// @Router      /handouts [get]
func (h *HandoutHandler) List(w http.ResponseWriter, r *http.Request) {
	pageNumber, _ := strconv.Atoi(r.URL.Query().Get("page_number"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	filter := repository.HandoutFilter{
		Title: r.URL.Query().Get("title"),
	}

	if topicPublicID := r.URL.Query().Get("topic_id"); topicPublicID != "" {
		topicID, resolveErr := h.uc.ResolveTopicID(r.Context(), topicPublicID)
		if resolveErr != nil {
			response.Error(w, resolveErr)
			return
		}
		filter.TopicID = &topicID
	}

	handouts, totalItems, totalPages, err := h.uc.List(r.Context(), pageNumber, pageSize, filter)
	if err != nil {
		response.Error(w, err)
		return
	}

	if pageSize <= 0 {
		pageSize = 10
	}
	if pageSize > 100 {
		pageSize = 100
	}
	if pageNumber < 1 {
		pageNumber = 1
	}

	response.JSON(w, http.StatusOK, dto.HandoutListResponse{
		Data:       dto.HandoutsToResponse(handouts),
		PageNumber: pageNumber,
		PageSize:   pageSize,
		TotalItems: totalItems,
		TotalPages: totalPages,
	})
}

// GetByID godoc
// @Summary     Get a handout
// @Description Returns a handout by its public ID (admin only)
// @Tags        handouts
// @Produce     json
// @Security    CookieAuth
// @Param       id path string true "Handout public ID (UUID)"
// @Success     200 {object} dto.HandoutResponse
// @Failure     401 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Failure     404 {object} apperror.AppError
// @Failure     500 {object} apperror.AppError
// @Router      /handouts/{id} [get]
func (h *HandoutHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")

	handout, err := h.uc.GetByPublicID(r.Context(), publicID)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.HandoutToResponse(handout))
}

// Update godoc
// @Summary     Update a handout
// @Description Updates handout fields by public ID (admin only)
// @Tags        handouts
// @Accept      json
// @Produce     json
// @Security    CookieAuth
// @Param       id   path     string                   true "Handout public ID (UUID)"
// @Param       body body     dto.UpdateHandoutRequest  true "Handout data"
// @Success     200  {object} dto.HandoutResponse
// @Failure     400  {object} apperror.AppError
// @Failure     401  {object} apperror.AppError
// @Failure     403  {object} apperror.AppError
// @Failure     404  {object} apperror.AppError
// @Failure     409  {object} apperror.AppError
// @Failure     500  {object} apperror.AppError
// @Router      /handouts/{id} [put]
func (h *HandoutHandler) Update(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")

	var req dto.UpdateHandoutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidBody)
		return
	}

	input := usecase.UpdateHandoutInput{
		Title:       req.Title,
		Description: req.Description,
		TopicIDs:    req.TopicIDs,
	}

	handout, err := h.uc.Update(r.Context(), publicID, input)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.HandoutToResponse(handout))
}

// ReplaceFile godoc
// @Summary     Replace handout file
// @Description Replaces the PDF file of an existing handout (admin only)
// @Tags        handouts
// @Accept      multipart/form-data
// @Produce     json
// @Security    CookieAuth
// @Param       id   path     string true "Handout public ID (UUID)"
// @Param       file formData file   true "New PDF file"
// @Success     200  {object} dto.HandoutResponse
// @Failure     400  {object} apperror.AppError
// @Failure     401  {object} apperror.AppError
// @Failure     403  {object} apperror.AppError
// @Failure     404  {object} apperror.AppError
// @Failure     500  {object} apperror.AppError
// @Router      /handouts/{id}/file [post]
func (h *HandoutHandler) ReplaceFile(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")
	userPublicID := middleware.UserPublicID(r.Context())

	if err := r.ParseMultipartForm(50 << 20); err != nil {
		response.Error(w, apperror.ErrFileTooLarge)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		response.Error(w, apperror.ErrInvalidInput)
		return
	}
	defer file.Close()

	handout, err := h.uc.ReplaceFile(
		r.Context(),
		publicID,
		userPublicID,
		header.Filename,
		header.Header.Get("Content-Type"),
		header.Size,
		file,
	)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.HandoutToResponse(handout))
}

// Delete godoc
// @Summary     Delete a handout
// @Description Soft-deletes a handout by public ID (admin only)
// @Tags        handouts
// @Security    CookieAuth
// @Param       id path string true "Handout public ID (UUID)"
// @Success     204
// @Failure     401 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Failure     404 {object} apperror.AppError
// @Failure     500 {object} apperror.AppError
// @Router      /handouts/{id} [delete]
func (h *HandoutHandler) Delete(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")

	if err := h.uc.Delete(r.Context(), publicID); err != nil {
		response.Error(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
