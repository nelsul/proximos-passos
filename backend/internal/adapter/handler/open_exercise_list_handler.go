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

type OpenExerciseListHandler struct {
	uc *usecase.OpenExerciseListUseCase
}

func NewOpenExerciseListHandler(uc *usecase.OpenExerciseListUseCase) *OpenExerciseListHandler {
	return &OpenExerciseListHandler{uc: uc}
}

func (h *OpenExerciseListHandler) RegisterRoutes(mux *http.ServeMux, adminMW, authMW func(http.Handler) http.Handler) {
	mux.Handle("POST /exercise-lists", adminMW(http.HandlerFunc(h.Create)))
	mux.Handle("GET /exercise-lists", authMW(http.HandlerFunc(h.List)))
	mux.Handle("GET /exercise-lists/{id}", authMW(http.HandlerFunc(h.GetByID)))
	mux.Handle("PUT /exercise-lists/{id}", adminMW(http.HandlerFunc(h.Update)))
	mux.Handle("POST /exercise-lists/{id}/file", adminMW(http.HandlerFunc(h.ReplaceFile)))
	mux.Handle("DELETE /exercise-lists/{id}", adminMW(http.HandlerFunc(h.Delete)))
}

// Create godoc
// @Summary     Create an open exercise list
// @Description Creates a new open exercise list with optional PDF file upload (admin only)
// @Tags        exercise-lists
// @Accept      multipart/form-data
// @Produce     json
// @Security    CookieAuth
// @Param       title       formData string   true  "Exercise list title"
// @Param       description formData string   false "Exercise list description"
// @Param       file_url    formData string   false "External file URL"
// @Param       topic_ids   formData []string false "Topic public IDs"
// @Param       file        formData file     false "PDF file"
// @Success     201 {object} dto.OpenExerciseListResponse
// @Failure     400 {object} apperror.AppError
// @Failure     401 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Failure     409 {object} apperror.AppError "Duplicate title"
// @Failure     500 {object} apperror.AppError
// @Router      /exercise-lists [post]
func (h *OpenExerciseListHandler) Create(w http.ResponseWriter, r *http.Request) {
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

	var fileURL *string
	if u := r.FormValue("file_url"); u != "" {
		fileURL = &u
	}

	topicIDs := r.Form["topic_ids"]

	var filename, contentType string
	var size int64
	var body interface{ Read([]byte) (int, error) }
	hasFile := false

	file, header, err := r.FormFile("file")
	if err == nil {
		defer file.Close()
		hasFile = true
		filename = header.Filename
		contentType = header.Header.Get("Content-Type")
		size = header.Size
		body = file
	}

	oel, createErr := h.uc.Create(
		r.Context(),
		userPublicID,
		title,
		description,
		fileURL,
		topicIDs,
		filename,
		contentType,
		size,
		body,
		hasFile,
	)
	if createErr != nil {
		response.Error(w, createErr)
		return
	}

	response.JSON(w, http.StatusCreated, dto.OpenExerciseListToResponse(oel))
}

// List godoc
// @Summary     List open exercise lists
// @Description Returns a paginated list of open exercise lists (admin only)
// @Tags        exercise-lists
// @Produce     json
// @Security    CookieAuth
// @Param       page_number query int    false "Page number" default(1)
// @Param       page_size   query int    false "Page size"   default(10)
// @Param       title       query string false "Filter by title (partial match)"
// @Param       topic_id    query string false "Filter by topic public ID (UUID)"
// @Success     200 {object} dto.OpenExerciseListListResponse
// @Failure     401 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Failure     500 {object} apperror.AppError
// @Router      /exercise-lists [get]
func (h *OpenExerciseListHandler) List(w http.ResponseWriter, r *http.Request) {
	pageNumber, _ := strconv.Atoi(r.URL.Query().Get("page_number"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	filter := repository.OpenExerciseListFilter{
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

	lists, totalItems, totalPages, err := h.uc.List(r.Context(), pageNumber, pageSize, filter)
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

	response.JSON(w, http.StatusOK, dto.OpenExerciseListListResponse{
		Data:       dto.OpenExerciseListsToResponse(lists),
		PageNumber: pageNumber,
		PageSize:   pageSize,
		TotalItems: totalItems,
		TotalPages: totalPages,
	})
}

// GetByID godoc
// @Summary     Get an open exercise list
// @Description Returns an open exercise list by its public ID (admin only)
// @Tags        exercise-lists
// @Produce     json
// @Security    CookieAuth
// @Param       id path string true "Exercise list public ID (UUID)"
// @Success     200 {object} dto.OpenExerciseListResponse
// @Failure     401 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Failure     404 {object} apperror.AppError
// @Failure     500 {object} apperror.AppError
// @Router      /exercise-lists/{id} [get]
func (h *OpenExerciseListHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")

	oel, err := h.uc.GetByPublicID(r.Context(), publicID)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.OpenExerciseListToResponse(oel))
}

// Update godoc
// @Summary     Update an open exercise list
// @Description Updates exercise list fields by public ID (admin only)
// @Tags        exercise-lists
// @Accept      json
// @Produce     json
// @Security    CookieAuth
// @Param       id   path     string                              true "Exercise list public ID (UUID)"
// @Param       body body     dto.UpdateOpenExerciseListRequest    true "Exercise list data"
// @Success     200  {object} dto.OpenExerciseListResponse
// @Failure     400  {object} apperror.AppError
// @Failure     401  {object} apperror.AppError
// @Failure     403  {object} apperror.AppError
// @Failure     404  {object} apperror.AppError
// @Failure     409  {object} apperror.AppError
// @Failure     500  {object} apperror.AppError
// @Router      /exercise-lists/{id} [put]
func (h *OpenExerciseListHandler) Update(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")

	var req dto.UpdateOpenExerciseListRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidBody)
		return
	}

	input := usecase.UpdateOpenExerciseListInput{
		Title:       req.Title,
		Description: req.Description,
		FileURL:     req.FileURL,
		TopicIDs:    req.TopicIDs,
	}

	oel, err := h.uc.Update(r.Context(), publicID, input)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.OpenExerciseListToResponse(oel))
}

// ReplaceFile godoc
// @Summary     Replace exercise list file
// @Description Replaces the PDF file of an existing exercise list (admin only)
// @Tags        exercise-lists
// @Accept      multipart/form-data
// @Produce     json
// @Security    CookieAuth
// @Param       id   path     string true "Exercise list public ID (UUID)"
// @Param       file formData file   true "New PDF file"
// @Success     200  {object} dto.OpenExerciseListResponse
// @Failure     400  {object} apperror.AppError
// @Failure     401  {object} apperror.AppError
// @Failure     403  {object} apperror.AppError
// @Failure     404  {object} apperror.AppError
// @Failure     500  {object} apperror.AppError
// @Router      /exercise-lists/{id}/file [post]
func (h *OpenExerciseListHandler) ReplaceFile(w http.ResponseWriter, r *http.Request) {
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

	oel, replaceErr := h.uc.ReplaceFile(
		r.Context(),
		publicID,
		userPublicID,
		header.Filename,
		header.Header.Get("Content-Type"),
		header.Size,
		file,
	)
	if replaceErr != nil {
		response.Error(w, replaceErr)
		return
	}

	response.JSON(w, http.StatusOK, dto.OpenExerciseListToResponse(oel))
}

// Delete godoc
// @Summary     Delete an open exercise list
// @Description Soft-deletes an exercise list by public ID (admin only)
// @Tags        exercise-lists
// @Security    CookieAuth
// @Param       id path string true "Exercise list public ID (UUID)"
// @Success     204
// @Failure     401 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Failure     404 {object} apperror.AppError
// @Failure     500 {object} apperror.AppError
// @Router      /exercise-lists/{id} [delete]
func (h *OpenExerciseListHandler) Delete(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")

	if err := h.uc.Delete(r.Context(), publicID); err != nil {
		response.Error(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
