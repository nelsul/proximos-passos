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

type ExamHandler struct {
	uc *usecase.ExamUseCase
}

func NewExamHandler(uc *usecase.ExamUseCase) *ExamHandler {
	return &ExamHandler{uc: uc}
}

func (h *ExamHandler) RegisterRoutes(mux *http.ServeMux, mw func(http.Handler) http.Handler) {
	mux.Handle("POST /exams", mw(http.HandlerFunc(h.Create)))
	mux.Handle("GET /exams", mw(http.HandlerFunc(h.List)))
	mux.Handle("GET /exams/{id}", mw(http.HandlerFunc(h.GetByID)))
	mux.Handle("PUT /exams/{id}", mw(http.HandlerFunc(h.Update)))
	mux.Handle("DELETE /exams/{id}", mw(http.HandlerFunc(h.Delete)))
}

// Create godoc
// @Summary     Create an exam
// @Description Creates a new exam (admin only)
// @Tags        exams
// @Accept      json
// @Produce     json
// @Security    CookieAuth
// @Param       body body     dto.CreateExamRequest true "Exam data"
// @Success     201  {object} dto.ExamResponse
// @Failure     400  {object} apperror.AppError
// @Failure     401  {object} apperror.AppError
// @Failure     403  {object} apperror.AppError
// @Failure     404  {object} apperror.AppError "Institution not found"
// @Failure     409  {object} apperror.AppError "Duplicate exam"
// @Failure     500  {object} apperror.AppError
// @Router      /exams [post]
func (h *ExamHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req dto.CreateExamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidBody)
		return
	}

	userPublicID := middleware.UserPublicID(r.Context())

	input := usecase.CreateExamInput{
		InstitutionID: req.InstitutionID,
		Title:         req.Title,
		Description:   req.Description,
		Year:          req.Year,
	}

	exam, err := h.uc.Create(r.Context(), userPublicID, input)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, dto.ExamToResponse(exam))
}

// List godoc
// @Summary     List exams
// @Description Returns a paginated list of exams (admin only)
// @Tags        exams
// @Produce     json
// @Security    CookieAuth
// @Param       page_number    query    int    false "Page number" default(1)
// @Param       page_size      query    int    false "Page size"   default(20)
// @Param       institution_id query    string false "Filter by institution ID (UUID)"
// @Param       year           query    int    false "Filter by year"
// @Success     200            {object} dto.ExamListResponse
// @Failure     401            {object} apperror.AppError
// @Failure     403            {object} apperror.AppError
// @Failure     500            {object} apperror.AppError
// @Router      /exams [get]
func (h *ExamHandler) List(w http.ResponseWriter, r *http.Request) {
	pageNumber, _ := strconv.Atoi(r.URL.Query().Get("page_number"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	filter := repository.ExamFilter{
		InstitutionID: r.URL.Query().Get("institution_id"),
	}

	if yearStr := r.URL.Query().Get("year"); yearStr != "" {
		if year, err := strconv.Atoi(yearStr); err == nil {
			filter.Year = &year
		}
	}

	exams, totalItems, totalPages, err := h.uc.List(r.Context(), pageNumber, pageSize, filter)
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

	response.JSON(w, http.StatusOK, dto.ExamListResponse{
		Data:       dto.ExamsToResponse(exams),
		PageNumber: pageNumber,
		PageSize:   pageSize,
		TotalItems: totalItems,
		TotalPages: totalPages,
	})
}

// GetByID godoc
// @Summary     Get an exam
// @Description Returns an exam by its public ID (admin only)
// @Tags        exams
// @Produce     json
// @Security    CookieAuth
// @Param       id  path     string true "Exam public ID (UUID)"
// @Success     200 {object} dto.ExamResponse
// @Failure     401 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Failure     404 {object} apperror.AppError
// @Failure     500 {object} apperror.AppError
// @Router      /exams/{id} [get]
func (h *ExamHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")

	exam, err := h.uc.GetByPublicID(r.Context(), publicID)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.ExamToResponse(exam))
}

// Update godoc
// @Summary     Update an exam
// @Description Updates exam fields by public ID (admin only)
// @Tags        exams
// @Accept      json
// @Produce     json
// @Security    CookieAuth
// @Param       id   path     string               true "Exam public ID (UUID)"
// @Param       body body     dto.UpdateExamRequest true "Exam data"
// @Success     200  {object} dto.ExamResponse
// @Failure     400  {object} apperror.AppError
// @Failure     401  {object} apperror.AppError
// @Failure     403  {object} apperror.AppError
// @Failure     404  {object} apperror.AppError
// @Failure     409  {object} apperror.AppError
// @Failure     500  {object} apperror.AppError
// @Router      /exams/{id} [put]
func (h *ExamHandler) Update(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")

	var req dto.UpdateExamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidBody)
		return
	}

	input := usecase.UpdateExamInput{
		InstitutionID: req.InstitutionID,
		Title:         req.Title,
		Description:   req.Description,
		Year:          req.Year,
	}

	exam, err := h.uc.Update(r.Context(), publicID, input)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.ExamToResponse(exam))
}

// Delete godoc
// @Summary     Delete an exam
// @Description Soft-deletes an exam by public ID (admin only)
// @Tags        exams
// @Produce     json
// @Security    CookieAuth
// @Param       id  path  string true "Exam public ID (UUID)"
// @Success     204 "No Content"
// @Failure     401 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Failure     404 {object} apperror.AppError
// @Failure     500 {object} apperror.AppError
// @Router      /exams/{id} [delete]
func (h *ExamHandler) Delete(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")

	if err := h.uc.Delete(r.Context(), publicID); err != nil {
		response.Error(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
