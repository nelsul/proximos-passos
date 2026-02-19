package handler

import (
	"encoding/json"
	"math"
	"net/http"
	"strconv"
	"time"

	"proximos-passos/backend/internal/adapter/dto"
	"proximos-passos/backend/internal/adapter/middleware"
	"proximos-passos/backend/internal/adapter/response"
	"proximos-passos/backend/internal/domain/apperror"
	"proximos-passos/backend/internal/domain/repository"
	"proximos-passos/backend/internal/usecase"
)

type ActivityHandler struct {
	uc *usecase.ActivityUseCase
}

func NewActivityHandler(uc *usecase.ActivityUseCase) *ActivityHandler {
	return &ActivityHandler{uc: uc}
}

func (h *ActivityHandler) RegisterRoutes(mux *http.ServeMux, authMW func(http.Handler) http.Handler) {
	mux.Handle("POST /groups/{groupId}/activities", authMW(http.HandlerFunc(h.Create)))
	mux.Handle("GET /groups/{groupId}/activities/upcoming", authMW(http.HandlerFunc(h.ListUpcoming)))
	mux.Handle("GET /groups/{groupId}/activities/past", authMW(http.HandlerFunc(h.ListPast)))
	mux.Handle("GET /activities/{id}", authMW(http.HandlerFunc(h.GetByID)))
	mux.Handle("PUT /activities/{id}", authMW(http.HandlerFunc(h.Update)))
	mux.Handle("DELETE /activities/{id}", authMW(http.HandlerFunc(h.Delete)))
	mux.Handle("POST /activities/{id}/attachments", authMW(http.HandlerFunc(h.UploadAttachment)))
	mux.Handle("DELETE /activities/{id}/attachments/{fileId}", authMW(http.HandlerFunc(h.DeleteAttachment)))

	// Activity Items
	mux.Handle("POST /activities/{id}/items", authMW(http.HandlerFunc(h.CreateItem)))
	mux.Handle("GET /activities/{id}/items", authMW(http.HandlerFunc(h.ListItems)))
	mux.Handle("PUT /activities/{id}/items/reorder", authMW(http.HandlerFunc(h.ReorderItems)))
	mux.Handle("PUT /activity-items/{itemId}", authMW(http.HandlerFunc(h.UpdateItem)))
	mux.Handle("DELETE /activity-items/{itemId}", authMW(http.HandlerFunc(h.DeleteItem)))
}

// Create godoc
// @Summary     Create an activity
// @Description Creates a new activity in a group (group admin only)
// @Tags        activities
// @Accept      json
// @Produce     json
// @Security    CookieAuth
// @Param       groupId path string true "Group public ID"
// @Param       body body dto.CreateActivityRequest true "Activity data"
// @Success     201 {object} dto.ActivityResponse
// @Failure     400 {object} apperror.AppError
// @Failure     401 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Router      /groups/{groupId}/activities [post]
func (h *ActivityHandler) Create(w http.ResponseWriter, r *http.Request) {
	groupPublicID := r.PathValue("groupId")
	requesterPublicID := middleware.UserPublicID(r.Context())
	if requesterPublicID == "" {
		response.Error(w, apperror.ErrUnauthorized)
		return
	}

	var req dto.CreateActivityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidBody)
		return
	}

	dueDate, err := time.Parse(time.RFC3339, req.DueDate)
	if err != nil {
		response.Error(w, apperror.WithDetails(apperror.CodeInvalidInput, "Invalid due_date format. Use RFC3339 (e.g., 2025-12-31T23:59:59Z).", http.StatusBadRequest, nil))
		return
	}

	input := usecase.CreateActivityInput{
		Title:       req.Title,
		Description: req.Description,
		DueDate:     dueDate,
	}

	activity, err := h.uc.Create(r.Context(), groupPublicID, requesterPublicID, input)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, dto.ActivityToResponse(activity))
}

// GetByID godoc
// @Summary     Get activity details
// @Description Returns an activity with its attachments
// @Tags        activities
// @Produce     json
// @Security    CookieAuth
// @Param       id path string true "Activity public ID"
// @Success     200 {object} dto.ActivityDetailResponse
// @Failure     404 {object} apperror.AppError
// @Router      /activities/{id} [get]
func (h *ActivityHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	activityPublicID := r.PathValue("id")
	requesterPublicID := middleware.UserPublicID(r.Context())
	requesterRole := middleware.UserRole(r.Context())
	if requesterPublicID == "" {
		response.Error(w, apperror.ErrUnauthorized)
		return
	}

	activity, attachments, err := h.uc.GetByPublicID(r.Context(), activityPublicID, requesterPublicID, requesterRole)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.ActivityDetailToResponse(activity, attachments))
}

// Update godoc
// @Summary     Update an activity
// @Description Updates an activity (group admin only)
// @Tags        activities
// @Accept      json
// @Produce     json
// @Security    CookieAuth
// @Param       id path string true "Activity public ID"
// @Param       body body dto.UpdateActivityRequest true "Activity data"
// @Success     200 {object} dto.ActivityResponse
// @Failure     400 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Router      /activities/{id} [put]
func (h *ActivityHandler) Update(w http.ResponseWriter, r *http.Request) {
	activityPublicID := r.PathValue("id")
	requesterPublicID := middleware.UserPublicID(r.Context())
	if requesterPublicID == "" {
		response.Error(w, apperror.ErrUnauthorized)
		return
	}

	var req dto.UpdateActivityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidBody)
		return
	}

	input := usecase.UpdateActivityInput{
		Title:       req.Title,
		Description: req.Description,
	}

	if req.DueDate != nil {
		dueDate, err := time.Parse(time.RFC3339, *req.DueDate)
		if err != nil {
			response.Error(w, apperror.WithDetails(apperror.CodeInvalidInput, "Invalid due_date format. Use RFC3339.", http.StatusBadRequest, nil))
			return
		}
		input.DueDate = &dueDate
	}

	activity, err := h.uc.Update(r.Context(), activityPublicID, requesterPublicID, input)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.ActivityToResponse(activity))
}

// Delete godoc
// @Summary     Delete an activity
// @Description Soft-deletes an activity (group admin only)
// @Tags        activities
// @Security    CookieAuth
// @Param       id path string true "Activity public ID"
// @Success     204
// @Failure     403 {object} apperror.AppError
// @Router      /activities/{id} [delete]
func (h *ActivityHandler) Delete(w http.ResponseWriter, r *http.Request) {
	activityPublicID := r.PathValue("id")
	requesterPublicID := middleware.UserPublicID(r.Context())
	if requesterPublicID == "" {
		response.Error(w, apperror.ErrUnauthorized)
		return
	}

	if err := h.uc.Delete(r.Context(), activityPublicID, requesterPublicID); err != nil {
		response.Error(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ListUpcoming godoc
// @Summary     List upcoming activities
// @Description Lists activities with due_date >= now, ordered by closest due date
// @Tags        activities
// @Produce     json
// @Security    CookieAuth
// @Param       groupId path string true "Group public ID"
// @Param       page_number query int false "Page number"
// @Param       page_size query int false "Page size"
// @Param       title query string false "Filter by title"
// @Success     200 {object} dto.ActivityListResponse
// @Router      /groups/{groupId}/activities/upcoming [get]
func (h *ActivityHandler) ListUpcoming(w http.ResponseWriter, r *http.Request) {
	groupPublicID := r.PathValue("groupId")
	requesterPublicID := middleware.UserPublicID(r.Context())
	requesterRole := middleware.UserRole(r.Context())
	if requesterPublicID == "" {
		response.Error(w, apperror.ErrUnauthorized)
		return
	}

	pageNumber, _ := strconv.Atoi(r.URL.Query().Get("page_number"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	if pageNumber < 1 {
		pageNumber = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}

	filter := repository.ActivityFilter{
		Title: r.URL.Query().Get("title"),
	}

	activities, total, err := h.uc.ListUpcoming(r.Context(), groupPublicID, requesterPublicID, requesterRole, pageNumber, pageSize, filter)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.ActivityListResponse{
		Data:       dto.ActivitiesToResponse(activities),
		PageNumber: pageNumber,
		PageSize:   pageSize,
		TotalItems: total,
		TotalPages: int(math.Ceil(float64(total) / float64(pageSize))),
	})
}

// ListPast godoc
// @Summary     List past activities
// @Description Lists activities with due_date < now, ordered by most recent first
// @Tags        activities
// @Produce     json
// @Security    CookieAuth
// @Param       groupId path string true "Group public ID"
// @Param       page_number query int false "Page number"
// @Param       page_size query int false "Page size"
// @Param       title query string false "Filter by title"
// @Success     200 {object} dto.ActivityListResponse
// @Router      /groups/{groupId}/activities/past [get]
func (h *ActivityHandler) ListPast(w http.ResponseWriter, r *http.Request) {
	groupPublicID := r.PathValue("groupId")
	requesterPublicID := middleware.UserPublicID(r.Context())
	requesterRole := middleware.UserRole(r.Context())
	if requesterPublicID == "" {
		response.Error(w, apperror.ErrUnauthorized)
		return
	}

	pageNumber, _ := strconv.Atoi(r.URL.Query().Get("page_number"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	if pageNumber < 1 {
		pageNumber = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}

	filter := repository.ActivityFilter{
		Title: r.URL.Query().Get("title"),
	}

	activities, total, err := h.uc.ListPast(r.Context(), groupPublicID, requesterPublicID, requesterRole, pageNumber, pageSize, filter)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.ActivityListResponse{
		Data:       dto.ActivitiesToResponse(activities),
		PageNumber: pageNumber,
		PageSize:   pageSize,
		TotalItems: total,
		TotalPages: int(math.Ceil(float64(total) / float64(pageSize))),
	})
}

// UploadAttachment godoc
// @Summary     Upload an attachment
// @Description Uploads a file attachment to an activity (group admin only)
// @Tags        activities
// @Accept      multipart/form-data
// @Produce     json
// @Security    CookieAuth
// @Param       id path string true "Activity public ID"
// @Param       file formData file true "Attachment file"
// @Success     201 {object} dto.AttachmentResponse
// @Failure     400 {object} apperror.AppError
// @Router      /activities/{id}/attachments [post]
func (h *ActivityHandler) UploadAttachment(w http.ResponseWriter, r *http.Request) {
	activityPublicID := r.PathValue("id")
	requesterPublicID := middleware.UserPublicID(r.Context())
	if requesterPublicID == "" {
		response.Error(w, apperror.ErrUnauthorized)
		return
	}

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		response.Error(w, apperror.ErrFileTooLarge)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		response.Error(w, apperror.ErrInvalidInput)
		return
	}
	defer file.Close()

	attachment, err := h.uc.UploadAttachment(r.Context(), activityPublicID, requesterPublicID, header.Filename, header.Header.Get("Content-Type"), header.Size, file)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, dto.AttachmentToResponse(attachment))
}

// DeleteAttachment godoc
// @Summary     Delete an attachment
// @Description Deletes a file attachment from an activity (group admin only)
// @Tags        activities
// @Security    CookieAuth
// @Param       id path string true "Activity public ID"
// @Param       fileId path string true "File public ID"
// @Success     204
// @Failure     403 {object} apperror.AppError
// @Router      /activities/{id}/attachments/{fileId} [delete]
func (h *ActivityHandler) DeleteAttachment(w http.ResponseWriter, r *http.Request) {
	activityPublicID := r.PathValue("id")
	filePublicID := r.PathValue("fileId")
	requesterPublicID := middleware.UserPublicID(r.Context())
	if requesterPublicID == "" {
		response.Error(w, apperror.ErrUnauthorized)
		return
	}

	if err := h.uc.DeleteAttachment(r.Context(), activityPublicID, filePublicID, requesterPublicID); err != nil {
		response.Error(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ==========================================
// Activity Items
// ==========================================

func (h *ActivityHandler) CreateItem(w http.ResponseWriter, r *http.Request) {
	activityPublicID := r.PathValue("id")
	requesterPublicID := middleware.UserPublicID(r.Context())
	if requesterPublicID == "" {
		response.Error(w, apperror.ErrUnauthorized)
		return
	}

	var req dto.CreateActivityItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidBody)
		return
	}

	input := usecase.CreateActivityItemInput{
		Title:              req.Title,
		Description:        req.Description,
		QuestionID:         req.QuestionID,
		VideoLessonID:      req.VideoLessonID,
		HandoutID:          req.HandoutID,
		OpenExerciseListID: req.OpenExerciseListID,
		SimulatedExamID:    req.SimulatedExamID,
	}

	item, err := h.uc.CreateItem(r.Context(), activityPublicID, requesterPublicID, input)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, dto.ActivityItemToResponse(item))
}

func (h *ActivityHandler) ListItems(w http.ResponseWriter, r *http.Request) {
	activityPublicID := r.PathValue("id")
	requesterPublicID := middleware.UserPublicID(r.Context())
	requesterRole := middleware.UserRole(r.Context())
	if requesterPublicID == "" {
		response.Error(w, apperror.ErrUnauthorized)
		return
	}

	items, err := h.uc.ListItems(r.Context(), activityPublicID, requesterPublicID, requesterRole)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.ActivityItemsToResponse(items))
}

func (h *ActivityHandler) UpdateItem(w http.ResponseWriter, r *http.Request) {
	itemPublicID := r.PathValue("itemId")
	requesterPublicID := middleware.UserPublicID(r.Context())
	if requesterPublicID == "" {
		response.Error(w, apperror.ErrUnauthorized)
		return
	}

	var req dto.UpdateActivityItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidBody)
		return
	}

	input := usecase.UpdateActivityItemInput{
		Title:       req.Title,
		Description: req.Description,
	}

	item, err := h.uc.UpdateItem(r.Context(), itemPublicID, requesterPublicID, input)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.ActivityItemToResponse(item))
}

func (h *ActivityHandler) DeleteItem(w http.ResponseWriter, r *http.Request) {
	itemPublicID := r.PathValue("itemId")
	requesterPublicID := middleware.UserPublicID(r.Context())
	if requesterPublicID == "" {
		response.Error(w, apperror.ErrUnauthorized)
		return
	}

	if err := h.uc.DeleteItem(r.Context(), itemPublicID, requesterPublicID); err != nil {
		response.Error(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *ActivityHandler) ReorderItems(w http.ResponseWriter, r *http.Request) {
	activityPublicID := r.PathValue("id")
	requesterPublicID := middleware.UserPublicID(r.Context())
	if requesterPublicID == "" {
		response.Error(w, apperror.ErrUnauthorized)
		return
	}

	var req dto.ReorderActivityItemsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidBody)
		return
	}

	if err := h.uc.ReorderItems(r.Context(), activityPublicID, requesterPublicID, req.OrderedIDs); err != nil {
		response.Error(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
