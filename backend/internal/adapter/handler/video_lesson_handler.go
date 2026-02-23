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

type VideoLessonHandler struct {
	uc *usecase.VideoLessonUseCase
}

func NewVideoLessonHandler(uc *usecase.VideoLessonUseCase) *VideoLessonHandler {
	return &VideoLessonHandler{uc: uc}
}

func (h *VideoLessonHandler) RegisterRoutes(mux *http.ServeMux, adminMW, authMW func(http.Handler) http.Handler) {
	mux.Handle("POST /video-lessons", adminMW(http.HandlerFunc(h.Create)))
	mux.Handle("GET /video-lessons", authMW(http.HandlerFunc(h.List)))
	mux.Handle("GET /video-lessons/{id}", authMW(http.HandlerFunc(h.GetByID)))
	mux.Handle("PUT /video-lessons/{id}", adminMW(http.HandlerFunc(h.Update)))
	mux.Handle("POST /video-lessons/{id}/file", adminMW(http.HandlerFunc(h.ReplaceFile)))
	mux.Handle("DELETE /video-lessons/{id}", adminMW(http.HandlerFunc(h.Delete)))
}

// Create godoc
// @Summary     Create a video lesson
// @Description Creates a new video lesson with optional video file upload (admin only)
// @Tags        video-lessons
// @Accept      multipart/form-data
// @Produce     json
// @Security    CookieAuth
// @Param       title            formData string   true  "Video lesson title"
// @Param       description      formData string   false "Video lesson description"
// @Param       video_url        formData string   false "External video URL"
// @Param       duration_minutes formData int      true  "Duration in minutes"
// @Param       topic_ids        formData []string false "Topic public IDs"
// @Param       file             formData file     false "Video file"
// @Success     201 {object} dto.VideoLessonResponse
// @Failure     400 {object} apperror.AppError
// @Failure     401 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Failure     409 {object} apperror.AppError "Duplicate title"
// @Failure     500 {object} apperror.AppError
// @Router      /video-lessons [post]
func (h *VideoLessonHandler) Create(w http.ResponseWriter, r *http.Request) {
	userPublicID := middleware.UserPublicID(r.Context())

	if err := r.ParseMultipartForm(500 << 20); err != nil {
		response.Error(w, apperror.ErrFileTooLarge)
		return
	}

	title := r.FormValue("title")

	var description *string
	if desc := r.FormValue("description"); desc != "" {
		description = &desc
	}

	var videoURL *string
	if u := r.FormValue("video_url"); u != "" {
		videoURL = &u
	}

	durationMinutes, _ := strconv.Atoi(r.FormValue("duration_minutes"))

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

	vl, createErr := h.uc.Create(
		r.Context(),
		userPublicID,
		title,
		description,
		videoURL,
		durationMinutes,
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

	response.JSON(w, http.StatusCreated, dto.VideoLessonToResponse(vl))
}

// List godoc
// @Summary     List video lessons
// @Description Returns a paginated list of video lessons (admin only)
// @Tags        video-lessons
// @Produce     json
// @Security    CookieAuth
// @Param       page_number query int    false "Page number" default(1)
// @Param       page_size   query int    false "Page size"   default(10)
// @Param       title       query string false "Filter by title (partial match)"
// @Param       topic_id    query string false "Filter by topic public ID (UUID)"
// @Success     200 {object} dto.VideoLessonListResponse
// @Failure     401 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Failure     500 {object} apperror.AppError
// @Router      /video-lessons [get]
func (h *VideoLessonHandler) List(w http.ResponseWriter, r *http.Request) {
	pageNumber, _ := strconv.Atoi(r.URL.Query().Get("page_number"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	filter := repository.VideoLessonFilter{
		Title: r.URL.Query().Get("title"),
	}

	if topicPublicIDs := r.URL.Query()["topic_id"]; len(topicPublicIDs) > 0 {
		topicIDs, resolveErr := h.uc.ResolveTopicIDs(r.Context(), topicPublicIDs)
		if resolveErr != nil {
			response.Error(w, resolveErr)
			return
		}
		filter.TopicIDs = topicIDs
	}

	lessons, totalItems, totalPages, err := h.uc.List(r.Context(), pageNumber, pageSize, filter)
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

	response.JSON(w, http.StatusOK, dto.VideoLessonListResponse{
		Data:       dto.VideoLessonsToResponse(lessons),
		PageNumber: pageNumber,
		PageSize:   pageSize,
		TotalItems: totalItems,
		TotalPages: totalPages,
	})
}

// GetByID godoc
// @Summary     Get a video lesson
// @Description Returns a video lesson by its public ID (admin only)
// @Tags        video-lessons
// @Produce     json
// @Security    CookieAuth
// @Param       id path string true "Video lesson public ID (UUID)"
// @Success     200 {object} dto.VideoLessonResponse
// @Failure     401 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Failure     404 {object} apperror.AppError
// @Failure     500 {object} apperror.AppError
// @Router      /video-lessons/{id} [get]
func (h *VideoLessonHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")

	vl, err := h.uc.GetByPublicID(r.Context(), publicID)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.VideoLessonToResponse(vl))
}

// Update godoc
// @Summary     Update a video lesson
// @Description Updates video lesson fields by public ID (admin only)
// @Tags        video-lessons
// @Accept      json
// @Produce     json
// @Security    CookieAuth
// @Param       id   path     string                         true "Video lesson public ID (UUID)"
// @Param       body body     dto.UpdateVideoLessonRequest    true "Video lesson data"
// @Success     200  {object} dto.VideoLessonResponse
// @Failure     400  {object} apperror.AppError
// @Failure     401  {object} apperror.AppError
// @Failure     403  {object} apperror.AppError
// @Failure     404  {object} apperror.AppError
// @Failure     409  {object} apperror.AppError
// @Failure     500  {object} apperror.AppError
// @Router      /video-lessons/{id} [put]
func (h *VideoLessonHandler) Update(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")

	var req dto.UpdateVideoLessonRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidBody)
		return
	}

	input := usecase.UpdateVideoLessonInput{
		Title:           req.Title,
		Description:     req.Description,
		VideoURL:        req.VideoURL,
		DurationMinutes: req.DurationMinutes,
		TopicIDs:        req.TopicIDs,
	}

	vl, err := h.uc.Update(r.Context(), publicID, input)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.VideoLessonToResponse(vl))
}

// ReplaceFile godoc
// @Summary     Replace video lesson file
// @Description Replaces the video file of an existing video lesson (admin only)
// @Tags        video-lessons
// @Accept      multipart/form-data
// @Produce     json
// @Security    CookieAuth
// @Param       id   path     string true "Video lesson public ID (UUID)"
// @Param       file formData file   true "New video file"
// @Success     200  {object} dto.VideoLessonResponse
// @Failure     400  {object} apperror.AppError
// @Failure     401  {object} apperror.AppError
// @Failure     403  {object} apperror.AppError
// @Failure     404  {object} apperror.AppError
// @Failure     500  {object} apperror.AppError
// @Router      /video-lessons/{id}/file [post]
func (h *VideoLessonHandler) ReplaceFile(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")
	userPublicID := middleware.UserPublicID(r.Context())

	if err := r.ParseMultipartForm(500 << 20); err != nil {
		response.Error(w, apperror.ErrFileTooLarge)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		response.Error(w, apperror.ErrInvalidInput)
		return
	}
	defer file.Close()

	vl, replaceErr := h.uc.ReplaceFile(
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

	response.JSON(w, http.StatusOK, dto.VideoLessonToResponse(vl))
}

// Delete godoc
// @Summary     Delete a video lesson
// @Description Soft-deletes a video lesson by public ID (admin only)
// @Tags        video-lessons
// @Security    CookieAuth
// @Param       id path string true "Video lesson public ID (UUID)"
// @Success     204
// @Failure     401 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Failure     404 {object} apperror.AppError
// @Failure     500 {object} apperror.AppError
// @Router      /video-lessons/{id} [delete]
func (h *VideoLessonHandler) Delete(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")

	if err := h.uc.Delete(r.Context(), publicID); err != nil {
		response.Error(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
