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

type InstitutionHandler struct {
	uc    *usecase.InstitutionUseCase
	qRepo repository.QuestionRepository
}

func NewInstitutionHandler(uc *usecase.InstitutionUseCase, qRepo repository.QuestionRepository) *InstitutionHandler {
	return &InstitutionHandler{uc: uc, qRepo: qRepo}
}

func (h *InstitutionHandler) RegisterRoutes(mux *http.ServeMux, adminMW, authMW func(http.Handler) http.Handler) {
	mux.Handle("POST /institutions", adminMW(http.HandlerFunc(h.Create)))
	mux.Handle("GET /institutions", authMW(http.HandlerFunc(h.List)))
	mux.Handle("GET /institutions/{id}", authMW(http.HandlerFunc(h.GetByID)))
	mux.Handle("GET /institutions/{id}/details", authMW(http.HandlerFunc(h.GetDetails)))
	mux.Handle("PUT /institutions/{id}", adminMW(http.HandlerFunc(h.Update)))
	mux.Handle("DELETE /institutions/{id}", adminMW(http.HandlerFunc(h.Delete)))
}

// Create godoc
// @Summary     Create an institution
// @Description Creates a new institution (admin only)
// @Tags        institutions
// @Accept      json
// @Produce     json
// @Security    CookieAuth
// @Param       body body     dto.CreateInstitutionRequest true "Institution data"
// @Success     201  {object} dto.InstitutionResponse
// @Failure     400  {object} apperror.AppError
// @Failure     401  {object} apperror.AppError
// @Failure     403  {object} apperror.AppError
// @Failure     409  {object} apperror.AppError "Duplicate name or acronym"
// @Failure     500  {object} apperror.AppError
// @Router      /institutions [post]
func (h *InstitutionHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req dto.CreateInstitutionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidBody)
		return
	}

	userPublicID := middleware.UserPublicID(r.Context())

	input := usecase.CreateInstitutionInput{
		Name:    req.Name,
		Acronym: req.Acronym,
	}

	institution, err := h.uc.Create(r.Context(), userPublicID, input)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, dto.InstitutionToResponse(institution))
}

// List godoc
// @Summary     List institutions
// @Description Returns a paginated list of institutions (admin only)
// @Tags        institutions
// @Produce     json
// @Security    CookieAuth
// @Param       page_number query    int    false "Page number" default(1)
// @Param       page_size   query    int    false "Page size"   default(10)
// @Param       name        query    string false "Filter by name or acronym (partial match)"
// @Success     200         {object} dto.InstitutionListResponse
// @Failure     401         {object} apperror.AppError
// @Failure     403         {object} apperror.AppError
// @Failure     500         {object} apperror.AppError
// @Router      /institutions [get]
func (h *InstitutionHandler) List(w http.ResponseWriter, r *http.Request) {
	pageNumber, _ := strconv.Atoi(r.URL.Query().Get("page_number"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	filter := repository.InstitutionFilter{
		Name: r.URL.Query().Get("name"),
	}

	institutions, totalItems, totalPages, err := h.uc.List(r.Context(), pageNumber, pageSize, filter)
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

	response.JSON(w, http.StatusOK, dto.InstitutionListResponse{
		Data:       dto.InstitutionsToResponse(institutions),
		PageNumber: pageNumber,
		PageSize:   pageSize,
		TotalItems: totalItems,
		TotalPages: totalPages,
	})
}

// GetByID godoc
// @Summary     Get an institution
// @Description Returns an institution by its public ID (admin only)
// @Tags        institutions
// @Produce     json
// @Security    CookieAuth
// @Param       id  path     string true "Institution public ID (UUID)"
// @Success     200 {object} dto.InstitutionResponse
// @Failure     401 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Failure     404 {object} apperror.AppError
// @Failure     500 {object} apperror.AppError
// @Router      /institutions/{id} [get]
func (h *InstitutionHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")

	institution, err := h.uc.GetByPublicID(r.Context(), publicID)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.InstitutionToResponse(institution))
}

// Update godoc
// @Summary     Update an institution
// @Description Updates institution fields by public ID (admin only)
// @Tags        institutions
// @Accept      json
// @Produce     json
// @Security    CookieAuth
// @Param       id   path     string                       true "Institution public ID (UUID)"
// @Param       body body     dto.UpdateInstitutionRequest  true "Institution data"
// @Success     200  {object} dto.InstitutionResponse
// @Failure     400  {object} apperror.AppError
// @Failure     401  {object} apperror.AppError
// @Failure     403  {object} apperror.AppError
// @Failure     404  {object} apperror.AppError
// @Failure     409  {object} apperror.AppError
// @Failure     500  {object} apperror.AppError
// @Router      /institutions/{id} [put]
func (h *InstitutionHandler) Update(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")

	var req dto.UpdateInstitutionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidBody)
		return
	}

	input := usecase.UpdateInstitutionInput{
		Name:    req.Name,
		Acronym: req.Acronym,
	}

	institution, err := h.uc.Update(r.Context(), publicID, input)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.InstitutionToResponse(institution))
}

// Delete godoc
// @Summary     Delete an institution
// @Description Soft-deletes an institution by public ID (admin only)
// @Tags        institutions
// @Produce     json
// @Security    CookieAuth
// @Param       id  path  string true "Institution public ID (UUID)"
// @Success     204 "No Content"
// @Failure     401 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Failure     404 {object} apperror.AppError
// @Failure     500 {object} apperror.AppError
// @Router      /institutions/{id} [delete]
func (h *InstitutionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")

	if err := h.uc.Delete(r.Context(), publicID); err != nil {
		response.Error(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// GetDetails godoc
// @Summary     Get institution details
// @Description Returns an institution with question count and related topic IDs (admin only)
// @Tags        institutions
// @Produce     json
// @Security    CookieAuth
// @Param       id  path     string true "Institution public ID (UUID)"
// @Success     200 {object} dto.InstitutionDetailResponse
// @Failure     401 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Failure     404 {object} apperror.AppError
// @Failure     500 {object} apperror.AppError
// @Router      /institutions/{id}/details [get]
func (h *InstitutionHandler) GetDetails(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")

	institution, err := h.uc.GetByPublicID(r.Context(), publicID)
	if err != nil {
		response.Error(w, err)
		return
	}

	questionCount, err := h.qRepo.CountByInstitutionID(r.Context(), institution.ID)
	if err != nil {
		response.Error(w, err)
		return
	}

	topicIDs, err := h.qRepo.TopicPublicIDsByInstitutionID(r.Context(), institution.ID)
	if err != nil {
		response.Error(w, err)
		return
	}

	resp := dto.InstitutionDetailResponse{
		Institution:   dto.InstitutionToResponse(institution),
		QuestionCount: questionCount,
		TopicIDs:      topicIDs,
	}

	response.JSON(w, http.StatusOK, resp)
}
