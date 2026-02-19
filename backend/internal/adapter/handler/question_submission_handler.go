package handler

import (
	"encoding/json"
	"math"
	"net/http"
	"strconv"

	"proximos-passos/backend/internal/adapter/dto"
	"proximos-passos/backend/internal/adapter/middleware"
	"proximos-passos/backend/internal/adapter/response"
	"proximos-passos/backend/internal/domain/apperror"
	"proximos-passos/backend/internal/usecase"
)

type QuestionSubmissionHandler struct {
	uc *usecase.QuestionSubmissionUseCase
}

func NewQuestionSubmissionHandler(uc *usecase.QuestionSubmissionUseCase) *QuestionSubmissionHandler {
	return &QuestionSubmissionHandler{uc: uc}
}

func (h *QuestionSubmissionHandler) RegisterRoutes(mux *http.ServeMux, authMW func(http.Handler) http.Handler) {
	mux.Handle("POST /questions/{id}/submissions", authMW(http.HandlerFunc(h.Submit)))
	mux.Handle("GET /questions/{id}/submissions", authMW(http.HandlerFunc(h.ListByQuestion)))
	mux.Handle("GET /me/submissions", authMW(http.HandlerFunc(h.ListMySubmissions)))
	mux.Handle("GET /me/submissions/{id}", authMW(http.HandlerFunc(h.GetByID)))
}

func (h *QuestionSubmissionHandler) Submit(w http.ResponseWriter, r *http.Request) {
	questionID := r.PathValue("id")
	if questionID == "" {
		response.Error(w, apperror.ErrInvalidInput)
		return
	}

	var req dto.SubmitAnswerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidBody)
		return
	}

	userPublicID := middleware.UserPublicID(r.Context())

	input := usecase.SubmitAnswerInput{
		QuestionPublicID: questionID,
		UserPublicID:     userPublicID,
		OptionPublicID:   req.QuestionOptionID,
		AnswerText:       req.AnswerText,
	}

	sub, err := h.uc.Submit(r.Context(), input)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, dto.QuestionSubmissionToResponse(sub))
}

func (h *QuestionSubmissionHandler) ListByQuestion(w http.ResponseWriter, r *http.Request) {
	questionID := r.PathValue("id")
	if questionID == "" {
		response.Error(w, apperror.ErrInvalidInput)
		return
	}

	page, size := parsePagination(r)

	subs, total, err := h.uc.ListByQuestion(r.Context(), questionID, page, size)
	if err != nil {
		response.Error(w, err)
		return
	}

	totalPages := int(math.Ceil(float64(total) / float64(size)))
	response.JSON(w, http.StatusOK, dto.QuestionSubmissionListResponse{
		Data:       dto.QuestionSubmissionsToResponse(subs),
		PageNumber: page,
		PageSize:   size,
		TotalItems: total,
		TotalPages: totalPages,
	})
}

func (h *QuestionSubmissionHandler) ListMySubmissions(w http.ResponseWriter, r *http.Request) {
	userPublicID := middleware.UserPublicID(r.Context())

	page, size := parsePagination(r)
	statement := r.URL.Query().Get("statement")

	subs, total, err := h.uc.ListMySubmissions(r.Context(), userPublicID, page, size, statement)
	if err != nil {
		response.Error(w, err)
		return
	}

	totalPages := int(math.Ceil(float64(total) / float64(size)))
	response.JSON(w, http.StatusOK, dto.QuestionSubmissionListResponse{
		Data:       dto.QuestionSubmissionsToResponse(subs),
		PageNumber: page,
		PageSize:   size,
		TotalItems: total,
		TotalPages: totalPages,
	})
}

func (h *QuestionSubmissionHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")
	if publicID == "" {
		response.Error(w, apperror.ErrInvalidInput)
		return
	}

	sub, err := h.uc.GetByPublicID(r.Context(), publicID)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.QuestionSubmissionToResponse(sub))
}

func parsePagination(r *http.Request) (int, int) {
	page := 1
	size := 20
	if p := r.URL.Query().Get("page_number"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			page = v
		}
	}
	if s := r.URL.Query().Get("page_size"); s != "" {
		if v, err := strconv.Atoi(s); err == nil && v > 0 && v <= 100 {
			size = v
		}
	}
	return page, size
}
