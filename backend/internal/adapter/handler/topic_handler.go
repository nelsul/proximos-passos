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

type TopicHandler struct {
	uc *usecase.TopicUseCase
}

func NewTopicHandler(uc *usecase.TopicUseCase) *TopicHandler {
	return &TopicHandler{uc: uc}
}

func (h *TopicHandler) RegisterRoutes(mux *http.ServeMux, adminMW, authMW func(http.Handler) http.Handler) {
	mux.Handle("POST /topics", adminMW(http.HandlerFunc(h.Create)))
	mux.Handle("GET /topics", authMW(http.HandlerFunc(h.List)))
	mux.Handle("GET /topics/{id}", authMW(http.HandlerFunc(h.GetByID)))
	mux.Handle("PUT /topics/{id}", adminMW(http.HandlerFunc(h.Update)))
	mux.Handle("DELETE /topics/{id}", adminMW(http.HandlerFunc(h.Delete)))
}

// Create godoc
// @Summary     Create a topic
// @Description Creates a new topic (admin only)
// @Tags        topics
// @Accept      json
// @Produce     json
// @Security    CookieAuth
// @Param       body body     dto.CreateTopicRequest true "Topic data"
// @Success     201  {object} dto.TopicResponse
// @Failure     400  {object} apperror.AppError
// @Failure     401  {object} apperror.AppError
// @Failure     403  {object} apperror.AppError
// @Failure     404  {object} apperror.AppError "Parent topic not found"
// @Failure     409  {object} apperror.AppError "Duplicate name under same parent"
// @Failure     500  {object} apperror.AppError
// @Router      /topics [post]
func (h *TopicHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req dto.CreateTopicRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidBody)
		return
	}

	userPublicID := middleware.UserPublicID(r.Context())

	input := usecase.CreateTopicInput{
		Name:        req.Name,
		Description: req.Description,
		ParentID:    req.ParentID,
	}

	topic, err := h.uc.Create(r.Context(), userPublicID, input)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, dto.TopicToResponse(topic))
}

// List godoc
// @Summary     List topics
// @Description Returns a paginated list of topics (admin only)
// @Tags        topics
// @Produce     json
// @Security    CookieAuth
// @Param       page_number query    int    false "Page number" default(1)
// @Param       page_size   query    int    false "Page size"   default(20)
// @Param       name        query    string false "Filter by name (partial match)"
// @Param       parent_id   query    string false "Filter by parent topic ID (UUID), use empty string for root topics"
// @Success     200         {object} dto.TopicListResponse
// @Failure     401         {object} apperror.AppError
// @Failure     403         {object} apperror.AppError
// @Failure     500         {object} apperror.AppError
// @Router      /topics [get]
func (h *TopicHandler) List(w http.ResponseWriter, r *http.Request) {
	pageNumber, _ := strconv.Atoi(r.URL.Query().Get("page_number"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	filter := repository.TopicFilter{
		Name: r.URL.Query().Get("name"),
	}

	if r.URL.Query().Has("parent_id") {
		parentID := r.URL.Query().Get("parent_id")
		filter.ParentID = &parentID
	}

	topics, totalItems, totalPages, err := h.uc.List(r.Context(), pageNumber, pageSize, filter)
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

	response.JSON(w, http.StatusOK, dto.TopicListResponse{
		Data:       dto.TopicsToResponse(topics),
		PageNumber: pageNumber,
		PageSize:   pageSize,
		TotalItems: totalItems,
		TotalPages: totalPages,
	})
}

// GetByID godoc
// @Summary     Get a topic
// @Description Returns a topic by its public ID (admin only)
// @Tags        topics
// @Produce     json
// @Security    CookieAuth
// @Param       id  path     string true "Topic public ID (UUID)"
// @Success     200 {object} dto.TopicResponse
// @Failure     401 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Failure     404 {object} apperror.AppError
// @Failure     500 {object} apperror.AppError
// @Router      /topics/{id} [get]
func (h *TopicHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")

	topic, err := h.uc.GetByPublicID(r.Context(), publicID)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.TopicToResponse(topic))
}

// Update godoc
// @Summary     Update a topic
// @Description Updates topic fields by public ID (admin only)
// @Tags        topics
// @Accept      json
// @Produce     json
// @Security    CookieAuth
// @Param       id   path     string                true "Topic public ID (UUID)"
// @Param       body body     dto.UpdateTopicRequest true "Topic data"
// @Success     200  {object} dto.TopicResponse
// @Failure     400  {object} apperror.AppError
// @Failure     401  {object} apperror.AppError
// @Failure     403  {object} apperror.AppError
// @Failure     404  {object} apperror.AppError
// @Failure     409  {object} apperror.AppError
// @Failure     500  {object} apperror.AppError
// @Router      /topics/{id} [put]
func (h *TopicHandler) Update(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")

	var req dto.UpdateTopicRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidBody)
		return
	}

	input := usecase.UpdateTopicInput{
		Name:        req.Name,
		Description: req.Description,
		ParentID:    req.ParentID,
	}

	topic, err := h.uc.Update(r.Context(), publicID, input)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.TopicToResponse(topic))
}

// Delete godoc
// @Summary     Delete a topic
// @Description Soft-deletes a topic by public ID (admin only).
// @Description Use ?mode=cascade to delete the topic and all descendants.
// @Description Use ?mode=reparent to move children to the topic's parent before deleting.
// @Tags        topics
// @Produce     json
// @Security    CookieAuth
// @Param       id   path  string true  "Topic public ID (UUID)"
// @Param       mode query string false "Delete mode: cascade | reparent" Enums(cascade, reparent)
// @Success     204 "No Content"
// @Failure     401 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Failure     404 {object} apperror.AppError
// @Failure     409 {object} apperror.AppError "Topic has children (no mode specified)"
// @Failure     500 {object} apperror.AppError
// @Router      /topics/{id} [delete]
func (h *TopicHandler) Delete(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")
	mode := r.URL.Query().Get("mode")

	if err := h.uc.Delete(r.Context(), publicID, mode); err != nil {
		response.Error(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
