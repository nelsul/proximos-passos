package handler

import (
	"encoding/json"
	"math"
	"net/http"

	"proximos-passos/backend/internal/adapter/dto"
	"proximos-passos/backend/internal/adapter/middleware"
	"proximos-passos/backend/internal/adapter/response"
	"proximos-passos/backend/internal/domain/apperror"
	"proximos-passos/backend/internal/domain/entity"
	"proximos-passos/backend/internal/usecase"
)

type ActivitySubmissionHandler struct {
	uc *usecase.ActivitySubmissionUseCase
}

func NewActivitySubmissionHandler(uc *usecase.ActivitySubmissionUseCase) *ActivitySubmissionHandler {
	return &ActivitySubmissionHandler{uc: uc}
}

func (h *ActivitySubmissionHandler) RegisterRoutes(mux *http.ServeMux, authMW func(http.Handler) http.Handler) {
	// User submits to an activity
	mux.Handle("POST /activities/{id}/submissions", authMW(http.HandlerFunc(h.Submit)))
	// User gets their own submission for an activity
	mux.Handle("GET /activities/{id}/submissions/mine", authMW(http.HandlerFunc(h.GetMySubmission)))
	// List all submissions for an activity (group admin)
	mux.Handle("GET /activities/{id}/submissions", authMW(http.HandlerFunc(h.ListByActivity)))
	// Get question answer statuses for the user's activity submission
	mux.Handle("GET /activities/{id}/question-status", authMW(http.HandlerFunc(h.GetQuestionStatuses)))
	// Get a specific submission by ID
	mux.Handle("GET /activity-submissions/{id}", authMW(http.HandlerFunc(h.GetByID)))
	// Review a submission (group admin)
	mux.Handle("PUT /activity-submissions/{id}/review", authMW(http.HandlerFunc(h.Review)))
	// Update submission notes (owner, while pending or reproved)
	mux.Handle("PUT /activity-submissions/{id}", authMW(http.HandlerFunc(h.UpdateNotes)))
	// Resubmit a reproved submission (owner)
	mux.Handle("POST /activity-submissions/{id}/resubmit", authMW(http.HandlerFunc(h.Resubmit)))
	// Send a draft submission for review (owner)
	mux.Handle("POST /activity-submissions/{id}/send", authMW(http.HandlerFunc(h.SendSubmission)))
	// Submission attachments
	mux.Handle("GET /activity-submissions/{id}/question-attempts", authMW(http.HandlerFunc(h.GetSubmissionQuestionAttempts)))
	mux.Handle("GET /activity-submissions/{id}/attachments", authMW(http.HandlerFunc(h.ListAttachments)))
	mux.Handle("POST /activity-submissions/{id}/attachments", authMW(http.HandlerFunc(h.UploadAttachment)))
	mux.Handle("DELETE /activity-submissions/{id}/attachments/{fileId}", authMW(http.HandlerFunc(h.DeleteAttachment)))
	// List user's own activity submissions
	mux.Handle("GET /me/activity-submissions", authMW(http.HandlerFunc(h.ListMySubmissions)))
}

// Submit godoc
// @Summary     Submit to an activity
// @Description Creates a submission for the current user on the given activity
// @Tags        activity-submissions
// @Accept      json
// @Produce     json
// @Security    CookieAuth
// @Param       id path string true "Activity public ID"
// @Param       body body dto.SubmitActivityRequest true "Submission data"
// @Success     201 {object} dto.ActivitySubmissionResponse
// @Failure     400 {object} apperror.AppError
// @Failure     409 {object} apperror.AppError
// @Router      /activities/{id}/submissions [post]
func (h *ActivitySubmissionHandler) Submit(w http.ResponseWriter, r *http.Request) {
	activityPublicID := r.PathValue("id")
	userPublicID := middleware.UserPublicID(r.Context())
	if userPublicID == "" {
		response.Error(w, apperror.ErrUnauthorized)
		return
	}

	var req dto.SubmitActivityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		// Allow empty body (no notes)
		req = dto.SubmitActivityRequest{}
	}

	input := usecase.SubmitActivityInput{
		ActivityPublicID: activityPublicID,
		UserPublicID:     userPublicID,
		Notes:            req.Notes,
	}

	sub, err := h.uc.Submit(r.Context(), input)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, dto.ActivitySubmissionToResponse(sub))
}

// GetMySubmission godoc
// @Summary     Get my submission for an activity
// @Description Returns the current user's submission for the given activity, or null if none
// @Tags        activity-submissions
// @Produce     json
// @Security    CookieAuth
// @Param       id path string true "Activity public ID"
// @Success     200 {object} dto.ActivitySubmissionResponse
// @Router      /activities/{id}/submissions/mine [get]
func (h *ActivitySubmissionHandler) GetMySubmission(w http.ResponseWriter, r *http.Request) {
	activityPublicID := r.PathValue("id")
	userPublicID := middleware.UserPublicID(r.Context())
	if userPublicID == "" {
		response.Error(w, apperror.ErrUnauthorized)
		return
	}

	sub, err := h.uc.GetMySubmission(r.Context(), activityPublicID, userPublicID)
	if err != nil {
		response.Error(w, err)
		return
	}

	if sub == nil {
		response.JSON(w, http.StatusOK, nil)
		return
	}

	response.JSON(w, http.StatusOK, dto.ActivitySubmissionToResponse(sub))
}

// ListByActivity godoc
// @Summary     List submissions for an activity
// @Description Lists all submissions for an activity (group admin only)
// @Tags        activity-submissions
// @Produce     json
// @Security    CookieAuth
// @Param       id path string true "Activity public ID"
// @Param       page_number query int false "Page number"
// @Param       page_size query int false "Page size"
// @Success     200 {object} dto.ActivitySubmissionListResponse
// @Router      /activities/{id}/submissions [get]
func (h *ActivitySubmissionHandler) ListByActivity(w http.ResponseWriter, r *http.Request) {
	activityPublicID := r.PathValue("id")
	requesterPublicID := middleware.UserPublicID(r.Context())
	requesterRole := middleware.UserRole(r.Context())
	if requesterPublicID == "" {
		response.Error(w, apperror.ErrUnauthorized)
		return
	}

	page, size := parsePagination(r)

	subs, total, err := h.uc.ListByActivity(r.Context(), activityPublicID, requesterPublicID, requesterRole, page, size)
	if err != nil {
		response.Error(w, err)
		return
	}

	totalPages := int(math.Ceil(float64(total) / float64(size)))
	response.JSON(w, http.StatusOK, dto.ActivitySubmissionListResponse{
		Data:       dto.ActivitySubmissionsToResponse(subs),
		PageNumber: page,
		PageSize:   size,
		TotalItems: total,
		TotalPages: totalPages,
	})
}

// GetByID godoc
// @Summary     Get an activity submission
// @Description Returns a specific activity submission by ID
// @Tags        activity-submissions
// @Produce     json
// @Security    CookieAuth
// @Param       id path string true "Submission public ID"
// @Success     200 {object} dto.ActivitySubmissionResponse
// @Router      /activity-submissions/{id} [get]
func (h *ActivitySubmissionHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")
	requesterPublicID := middleware.UserPublicID(r.Context())
	if requesterPublicID == "" {
		response.Error(w, apperror.ErrUnauthorized)
		return
	}

	sub, err := h.uc.GetByPublicID(r.Context(), publicID, requesterPublicID)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.ActivitySubmissionToResponse(sub))
}

// Review godoc
// @Summary     Review an activity submission
// @Description Sets the status (approved/reproved) and optional feedback for a submission
// @Tags        activity-submissions
// @Accept      json
// @Produce     json
// @Security    CookieAuth
// @Param       id path string true "Submission public ID"
// @Param       body body dto.ReviewActivitySubmissionRequest true "Review data"
// @Success     200 {object} dto.ActivitySubmissionResponse
// @Router      /activity-submissions/{id}/review [put]
func (h *ActivitySubmissionHandler) Review(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")
	requesterPublicID := middleware.UserPublicID(r.Context())
	requesterRole := middleware.UserRole(r.Context())
	if requesterPublicID == "" {
		response.Error(w, apperror.ErrUnauthorized)
		return
	}

	var req dto.ReviewActivitySubmissionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidBody)
		return
	}

	input := usecase.ReviewActivitySubmissionInput{
		SubmissionPublicID: publicID,
		ReviewerPublicID:   requesterPublicID,
		ReviewerRole:       requesterRole,
		Status:             entity.ActivitySubmissionStatus(req.Status),
		FeedbackNotes:      req.FeedbackNotes,
	}

	sub, err := h.uc.Review(r.Context(), input)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.ActivitySubmissionToResponse(sub))
}

// ListMySubmissions godoc
// @Summary     List my activity submissions
// @Description Lists the current user's activity submissions
// @Tags        activity-submissions
// @Produce     json
// @Security    CookieAuth
// @Param       page_number query int false "Page number"
// @Param       page_size query int false "Page size"
// @Success     200 {object} dto.ActivitySubmissionListResponse
// @Router      /me/activity-submissions [get]
func (h *ActivitySubmissionHandler) ListMySubmissions(w http.ResponseWriter, r *http.Request) {
	userPublicID := middleware.UserPublicID(r.Context())
	if userPublicID == "" {
		response.Error(w, apperror.ErrUnauthorized)
		return
	}

	page, size := parsePagination(r)

	subs, total, err := h.uc.ListMySubmissions(r.Context(), userPublicID, page, size)
	if err != nil {
		response.Error(w, err)
		return
	}

	totalPages := int(math.Ceil(float64(total) / float64(size)))
	response.JSON(w, http.StatusOK, dto.ActivitySubmissionListResponse{
		Data:       dto.ActivitySubmissionsToResponse(subs),
		PageNumber: page,
		PageSize:   size,
		TotalItems: total,
		TotalPages: totalPages,
	})
}

// UpdateNotes godoc
// @Summary     Update submission notes
// @Description Updates the notes on a pending activity submission (owner only)
// @Tags        activity-submissions
// @Accept      json
// @Produce     json
// @Security    CookieAuth
// @Param       id path string true "Submission public ID"
// @Param       body body dto.UpdateActivitySubmissionNotesRequest true "Notes data"
// @Success     200 {object} dto.ActivitySubmissionResponse
// @Router      /activity-submissions/{id} [put]
func (h *ActivitySubmissionHandler) UpdateNotes(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")
	userPublicID := middleware.UserPublicID(r.Context())
	if userPublicID == "" {
		response.Error(w, apperror.ErrUnauthorized)
		return
	}

	var req dto.UpdateActivitySubmissionNotesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidBody)
		return
	}

	sub, err := h.uc.UpdateNotes(r.Context(), publicID, userPublicID, req.Notes)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.ActivitySubmissionToResponse(sub))
}

// Resubmit godoc
// @Summary     Resubmit a reproved activity submission
// @Description Resets a reproved submission back to pending so the student can resubmit
// @Tags        activity-submissions
// @Produce     json
// @Security    CookieAuth
// @Param       id path string true "Submission public ID"
// @Success     200 {object} dto.ActivitySubmissionResponse
// @Failure     409 {object} apperror.AppError
// @Router      /activity-submissions/{id}/resubmit [post]
func (h *ActivitySubmissionHandler) Resubmit(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")
	userPublicID := middleware.UserPublicID(r.Context())
	if userPublicID == "" {
		response.Error(w, apperror.ErrUnauthorized)
		return
	}

	sub, err := h.uc.Resubmit(r.Context(), publicID, userPublicID)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.ActivitySubmissionToResponse(sub))
}

// SendSubmission godoc
// @Summary     Send a draft submission for review
// @Description Changes a submission status from created to pending
// @Tags        activity-submissions
// @Produce     json
// @Security    CookieAuth
// @Param       id path string true "Submission public ID"
// @Success     200 {object} dto.ActivitySubmissionResponse
// @Failure     409 {object} apperror.AppError
// @Router      /activity-submissions/{id}/send [post]
func (h *ActivitySubmissionHandler) SendSubmission(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")
	userPublicID := middleware.UserPublicID(r.Context())
	if userPublicID == "" {
		response.Error(w, apperror.ErrUnauthorized)
		return
	}

	sub, err := h.uc.SendSubmission(r.Context(), publicID, userPublicID)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.ActivitySubmissionToResponse(sub))
}

// GetQuestionStatuses godoc
// @Summary     Get question answer statuses for an activity
// @Description Returns per-question answer status for the current user's activity submission
// @Tags        activity-submissions
// @Produce     json
// @Security    CookieAuth
// @Param       id path string true "Activity public ID"
// @Success     200 {array} dto.QuestionStatusResponse
// @Router      /activities/{id}/question-status [get]
func (h *ActivitySubmissionHandler) GetQuestionStatuses(w http.ResponseWriter, r *http.Request) {
	activityPublicID := r.PathValue("id")
	userPublicID := middleware.UserPublicID(r.Context())
	if userPublicID == "" {
		response.Error(w, apperror.ErrUnauthorized)
		return
	}

	statuses, err := h.uc.GetQuestionStatuses(r.Context(), activityPublicID, userPublicID)
	if err != nil {
		response.Error(w, err)
		return
	}

	result := make([]dto.QuestionStatusResponse, len(statuses))
	for i, s := range statuses {
		result[i] = dto.QuestionStatusResponse{
			QuestionID: s.QuestionPublicID,
			Passed:     s.Passed,
			Attempts:   s.Attempts,
			LastScore:  s.LastScore,
		}
	}

	response.JSON(w, http.StatusOK, result)
}

// ListAttachments godoc
// @Summary     List submission attachments
// @Tags        activity-submissions
// @Produce     json
// @Security    CookieAuth
// @Param       id path string true "Submission public ID"
// @Success     200 {array} dto.SubmissionAttachmentResponse
// @Router      /activity-submissions/{id}/attachments [get]
func (h *ActivitySubmissionHandler) ListAttachments(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")
	userPublicID := middleware.UserPublicID(r.Context())
	if userPublicID == "" {
		response.Error(w, apperror.ErrUnauthorized)
		return
	}

	attachments, err := h.uc.ListAttachments(r.Context(), publicID, userPublicID)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.SubmissionAttachmentsToResponse(attachments))
}

// UploadAttachment godoc
// @Summary     Upload submission attachment
// @Tags        activity-submissions
// @Accept      multipart/form-data
// @Produce     json
// @Security    CookieAuth
// @Param       id path string true "Submission public ID"
// @Param       file formData file true "Attachment file"
// @Success     201 {object} dto.SubmissionAttachmentResponse
// @Router      /activity-submissions/{id}/attachments [post]
func (h *ActivitySubmissionHandler) UploadAttachment(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")
	userPublicID := middleware.UserPublicID(r.Context())
	if userPublicID == "" {
		response.Error(w, apperror.ErrUnauthorized)
		return
	}

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		response.Error(w, apperror.ErrFileTooLarge)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		response.Error(w, apperror.ErrInvalidBody)
		return
	}
	defer file.Close()

	att, err := h.uc.UploadAttachment(r.Context(), publicID, userPublicID, header.Filename, header.Header.Get("Content-Type"), header.Size, file)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, dto.SubmissionAttachmentToResponse(att))
}

// GetSubmissionQuestionAttempts godoc
// @Summary     Get question attempts for a submission
// @Description Returns all question submissions linked to an activity submission (admin only)
// @Tags        activity-submissions
// @Produce     json
// @Security    CookieAuth
// @Param       id path string true "Submission public ID"
// @Success     200 {array} dto.QuestionSubmissionResponse
// @Router      /activity-submissions/{id}/question-attempts [get]
func (h *ActivitySubmissionHandler) GetSubmissionQuestionAttempts(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")
	requesterPublicID := middleware.UserPublicID(r.Context())
	requesterRole := middleware.UserRole(r.Context())
	if requesterPublicID == "" {
		response.Error(w, apperror.ErrUnauthorized)
		return
	}

	attempts, err := h.uc.GetSubmissionQuestionAttempts(r.Context(), publicID, requesterPublicID, requesterRole)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.QuestionSubmissionsToResponse(attempts))
}

// DeleteAttachment godoc
// @Summary     Delete submission attachment
// @Tags        activity-submissions
// @Produce     json
// @Security    CookieAuth
// @Param       id path string true "Submission public ID"
// @Param       fileId path string true "File public ID"
// @Success     204
// @Router      /activity-submissions/{id}/attachments/{fileId} [delete]
func (h *ActivitySubmissionHandler) DeleteAttachment(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")
	filePublicID := r.PathValue("fileId")
	userPublicID := middleware.UserPublicID(r.Context())
	if userPublicID == "" {
		response.Error(w, apperror.ErrUnauthorized)
		return
	}

	if err := h.uc.DeleteAttachment(r.Context(), publicID, filePublicID, userPublicID); err != nil {
		response.Error(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
