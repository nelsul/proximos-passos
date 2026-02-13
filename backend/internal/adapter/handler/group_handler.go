package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"proximos-passos/backend/internal/adapter/dto"
	"proximos-passos/backend/internal/adapter/middleware"
	"proximos-passos/backend/internal/adapter/response"
	"proximos-passos/backend/internal/domain/apperror"
	"proximos-passos/backend/internal/domain/entity"
	"proximos-passos/backend/internal/domain/repository"
	"proximos-passos/backend/internal/usecase"
)

type GroupHandler struct {
	uc *usecase.GroupUseCase
}

func NewGroupHandler(uc *usecase.GroupUseCase) *GroupHandler {
	return &GroupHandler{uc: uc}
}

func (h *GroupHandler) RegisterRoutes(mux *http.ServeMux, adminMW, authMW func(http.Handler) http.Handler) {
	mux.Handle("GET /groups", authMW(http.HandlerFunc(h.List)))
	mux.Handle("GET /groups/{id}", authMW(http.HandlerFunc(h.GetByID)))
	mux.Handle("POST /groups", authMW(http.HandlerFunc(h.Create)))
	mux.Handle("PUT /groups/{id}", adminMW(http.HandlerFunc(h.Update)))
	mux.Handle("DELETE /groups/{id}", adminMW(http.HandlerFunc(h.Delete)))
	mux.Handle("PUT /groups/{id}/thumbnail", adminMW(http.HandlerFunc(h.UploadThumbnail)))
	mux.Handle("DELETE /groups/{id}/thumbnail", adminMW(http.HandlerFunc(h.DeleteThumbnail)))
}

func (h *GroupHandler) RegisterSelfRoutes(mux *http.ServeMux, mw func(http.Handler) http.Handler) {
	mux.Handle("GET /me/groups", mw(http.HandlerFunc(h.ListMyGroups)))
}

func (h *GroupHandler) RegisterMemberRoutes(mux *http.ServeMux, adminMW, authMW func(http.Handler) http.Handler) {
	mux.Handle("POST /groups/{id}/members", adminMW(http.HandlerFunc(h.AddMember)))
	mux.Handle("GET /groups/{id}/members", authMW(http.HandlerFunc(h.ListMembers)))
	mux.Handle("PUT /groups/{id}/members/{userId}", adminMW(http.HandlerFunc(h.UpdateMemberRole)))
	mux.Handle("DELETE /groups/{id}/members/{userId}", adminMW(http.HandlerFunc(h.RemoveMember)))
}

// Create godoc
// @Summary     Create a group
// @Description Creates a new group
// @Tags        groups
// @Accept      json
// @Produce     json
// @Security    CookieAuth
// @Param       body body     dto.CreateGroupRequest true "Group data"
// @Success     201  {object} dto.GroupResponse
// @Failure     400  {object} apperror.AppError
// @Failure     401  {object} apperror.AppError
// @Failure     403  {object} apperror.AppError
// @Failure     500  {object} apperror.AppError
// @Router      /groups [post]
func (h *GroupHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req dto.CreateGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidBody)
		return
	}

	creatorPublicID := middleware.UserPublicID(r.Context())
	if creatorPublicID == "" {
		response.Error(w, apperror.ErrUnauthorized)
		return
	}

	input := usecase.CreateGroupInput{
		Name:            req.Name,
		Description:     req.Description,
		AccessType:      entity.GroupAccessType(req.AccessType),
		VisibilityType:  entity.GroupVisibilityType(req.VisibilityType),
		CreatorPublicID: creatorPublicID,
	}

	group, err := h.uc.Create(r.Context(), input)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, dto.GroupToResponse(group))
}

// List godoc
// @Summary     List groups
// @Description Returns a paginated list of groups
// @Tags        groups
// @Produce     json
// @Security    CookieAuth
// @Param       page_number query    int false "Page number" default(1)
// @Param       page_size   query    int false "Page size"   default(20)
// @Success     200         {object} dto.GroupListResponse
// @Failure     401         {object} apperror.AppError
// @Failure     403         {object} apperror.AppError
// @Failure     500         {object} apperror.AppError
// @Router      /groups [get]
func (h *GroupHandler) List(w http.ResponseWriter, r *http.Request) {
	pageNumber, _ := strconv.Atoi(r.URL.Query().Get("page_number"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	userRole := middleware.UserRole(r.Context())

	filter := repository.GroupFilter{
		Name:       r.URL.Query().Get("name"),
		AccessType: r.URL.Query().Get("access_type"),
	}

	groups, totalItems, err := h.uc.List(r.Context(), pageNumber, pageSize, userRole, filter)
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

	response.JSON(w, http.StatusOK, dto.GroupListResponse{
		Data:       dto.GroupsToResponse(groups),
		PageNumber: pageNumber,
		PageSize:   pageSize,
		TotalItems: totalItems,
		TotalPages: totalPages,
	})
}

// GetByID godoc
// @Summary     Get a group
// @Description Returns a group by its public ID
// @Tags        groups
// @Produce     json
// @Security    CookieAuth
// @Param       id  path     string true "Group public ID (UUID)"
// @Success     200 {object} dto.GroupResponse
// @Failure     401 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Failure     404 {object} apperror.AppError
// @Failure     500 {object} apperror.AppError
// @Router      /groups/{id} [get]
func (h *GroupHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")
	userRole := middleware.UserRole(r.Context())

	group, err := h.uc.GetByPublicID(r.Context(), publicID, userRole)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.GroupToResponse(group))
}

// ListMyGroups godoc
// @Summary     List my groups
// @Description Returns a paginated list of groups the authenticated user is a member of
// @Tags        me
// @Produce     json
// @Security    CookieAuth
// @Param       page_number query    int false "Page number" default(1)
// @Param       page_size   query    int false "Page size"   default(20)
// @Success     200         {object} dto.GroupListResponse
// @Failure     401         {object} apperror.AppError
// @Failure     500         {object} apperror.AppError
// @Router      /me/groups [get]
func (h *GroupHandler) ListMyGroups(w http.ResponseWriter, r *http.Request) {
	userPublicID := middleware.UserPublicID(r.Context())
	if userPublicID == "" {
		response.Error(w, apperror.ErrUnauthorized)
		return
	}

	pageNumber, _ := strconv.Atoi(r.URL.Query().Get("page_number"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	filter := repository.GroupFilter{
		Name:           r.URL.Query().Get("name"),
		AccessType:     r.URL.Query().Get("access_type"),
		VisibilityType: r.URL.Query().Get("visibility_type"),
	}

	groups, totalItems, err := h.uc.ListMyGroups(r.Context(), userPublicID, pageNumber, pageSize, filter)
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

	response.JSON(w, http.StatusOK, dto.GroupListResponse{
		Data:       dto.GroupsToResponse(groups),
		PageNumber: pageNumber,
		PageSize:   pageSize,
		TotalItems: totalItems,
		TotalPages: totalPages,
	})
}

// Update godoc
// @Summary     Update a group
// @Description Updates group fields by its public ID
// @Tags        groups
// @Accept      json
// @Produce     json
// @Security    CookieAuth
// @Param       id   path     string                true "Group public ID (UUID)"
// @Param       body body     dto.UpdateGroupRequest true "Fields to update"
// @Success     200  {object} dto.GroupResponse
// @Failure     400  {object} apperror.AppError
// @Failure     401  {object} apperror.AppError
// @Failure     403  {object} apperror.AppError
// @Failure     404  {object} apperror.AppError
// @Failure     500  {object} apperror.AppError
// @Router      /groups/{id} [put]
func (h *GroupHandler) Update(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")

	var req dto.UpdateGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidBody)
		return
	}

	input := usecase.UpdateGroupInput{
		Name:        req.Name,
		Description: req.Description,
	}

	if req.AccessType != nil {
		at := entity.GroupAccessType(*req.AccessType)
		input.AccessType = &at
	}

	if req.VisibilityType != nil {
		vt := entity.GroupVisibilityType(*req.VisibilityType)
		input.VisibilityType = &vt
	}

	group, err := h.uc.Update(r.Context(), publicID, input)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.GroupToResponse(group))
}

// Delete godoc
// @Summary     Delete a group
// @Description Soft-deletes a group by its public ID
// @Tags        groups
// @Produce     json
// @Security    CookieAuth
// @Param       id  path     string true "Group public ID (UUID)"
// @Success     204 "No Content"
// @Failure     401 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Failure     404 {object} apperror.AppError
// @Failure     500 {object} apperror.AppError
// @Router      /groups/{id} [delete]
func (h *GroupHandler) Delete(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")

	if err := h.uc.Delete(r.Context(), publicID); err != nil {
		response.Error(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// UploadThumbnail godoc
// @Summary     Upload group thumbnail
// @Description Uploads a thumbnail image for a group
// @Tags        groups
// @Accept      multipart/form-data
// @Produce     json
// @Security    CookieAuth
// @Param       id        path     string true "Group public ID (UUID)"
// @Param       thumbnail formData file   true "Thumbnail image (max 5MB, jpeg/png/webp/gif)"
// @Success     200       {object} dto.GroupResponse
// @Failure     400       {object} apperror.AppError
// @Failure     401       {object} apperror.AppError
// @Failure     403       {object} apperror.AppError
// @Failure     404       {object} apperror.AppError
// @Failure     500       {object} apperror.AppError
// @Router      /groups/{id}/thumbnail [put]
func (h *GroupHandler) UploadThumbnail(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")

	if err := r.ParseMultipartForm(5 << 20); err != nil {
		response.Error(w, apperror.ErrFileTooLarge)
		return
	}

	file, header, err := r.FormFile("thumbnail")
	if err != nil {
		response.Error(w, apperror.ErrInvalidInput)
		return
	}
	defer file.Close()

	group, err := h.uc.UploadThumbnail(r.Context(), publicID, header.Filename, header.Header.Get("Content-Type"), header.Size, file)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.GroupToResponse(group))
}

// DeleteThumbnail godoc
// @Summary     Delete group thumbnail
// @Description Removes the thumbnail of a group
// @Tags        groups
// @Produce     json
// @Security    CookieAuth
// @Param       id  path     string true "Group public ID (UUID)"
// @Success     200 {object} dto.GroupResponse
// @Failure     401 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Failure     404 {object} apperror.AppError
// @Failure     500 {object} apperror.AppError
// @Router      /groups/{id}/thumbnail [delete]
func (h *GroupHandler) DeleteThumbnail(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")

	group, err := h.uc.DeleteThumbnail(r.Context(), publicID)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.GroupToResponse(group))
}

// AddMember godoc
// @Summary     Add a member to a group
// @Description Adds a user as a member of a group
// @Tags        group-members
// @Accept      json
// @Produce     json
// @Security    CookieAuth
// @Param       id   path     string              true "Group public ID (UUID)"
// @Param       body body     dto.AddMemberRequest true "Member data"
// @Success     201  {object} dto.GroupMemberResponse
// @Failure     400  {object} apperror.AppError
// @Failure     401  {object} apperror.AppError
// @Failure     403  {object} apperror.AppError
// @Failure     404  {object} apperror.AppError
// @Failure     409  {object} apperror.AppError
// @Failure     500  {object} apperror.AppError
// @Router      /groups/{id}/members [post]
func (h *GroupHandler) AddMember(w http.ResponseWriter, r *http.Request) {
	groupPublicID := r.PathValue("id")

	var req dto.AddMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidBody)
		return
	}

	creatorPublicID := middleware.UserPublicID(r.Context())
	if creatorPublicID == "" {
		response.Error(w, apperror.ErrUnauthorized)
		return
	}

	input := usecase.AddMemberInput{
		UserPublicID:    req.UserPublicID,
		Role:            entity.MemberRole(req.Role),
		CreatorPublicID: creatorPublicID,
	}

	member, err := h.uc.AddMember(r.Context(), groupPublicID, input)
	if err != nil {
		response.Error(w, err)
		return
	}

	// Fetch user details for the response
	user, userErr := h.uc.GetUserByPublicID(r.Context(), req.UserPublicID)
	var name, email string
	var avatarURL *string
	if userErr == nil && user != nil {
		name = user.Name
		email = user.Email
		avatarURL = user.AvatarURL
	}

	response.JSON(w, http.StatusCreated, dto.GroupMemberResponse{
		UserPublicID: req.UserPublicID,
		Name:         name,
		Email:        email,
		AvatarURL:    avatarURL,
		Role:         string(member.Role),
		IsActive:     member.IsActive,
		JoinedAt:     member.JoinedAt,
		UpdatedAt:    member.UpdatedAt,
	})
}

// ListMembers godoc
// @Summary     List group members
// @Description Returns a paginated list of members for a group
// @Tags        group-members
// @Produce     json
// @Security    CookieAuth
// @Param       id          path     string true  "Group public ID (UUID)"
// @Param       page_number query    int    false  "Page number" default(1)
// @Param       page_size   query    int    false  "Page size"   default(20)
// @Success     200         {object} dto.GroupMemberListResponse
// @Failure     401         {object} apperror.AppError
// @Failure     403         {object} apperror.AppError
// @Failure     404         {object} apperror.AppError
// @Failure     500         {object} apperror.AppError
// @Router      /groups/{id}/members [get]
func (h *GroupHandler) ListMembers(w http.ResponseWriter, r *http.Request) {
	groupPublicID := r.PathValue("id")
	pageNumber, _ := strconv.Atoi(r.URL.Query().Get("page_number"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	requesterPublicID := middleware.UserPublicID(r.Context())
	requesterRole := middleware.UserRole(r.Context())

	members, totalItems, err := h.uc.ListMembers(r.Context(), groupPublicID, requesterPublicID, requesterRole, pageNumber, pageSize)
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

	memberResponses := make([]dto.GroupMemberResponse, len(members))
	for i, m := range members {
		memberResponses[i] = dto.GroupMemberResponse{
			UserPublicID: m.UserPublicID,
			Name:         m.UserName,
			Email:        m.UserEmail,
			AvatarURL:    m.UserAvatarURL,
			Role:         string(m.Role),
			IsActive:     m.IsActive,
			JoinedAt:     m.JoinedAt,
			UpdatedAt:    m.UpdatedAt,
		}
	}

	response.JSON(w, http.StatusOK, dto.GroupMemberListResponse{
		Data:       memberResponses,
		PageNumber: pageNumber,
		PageSize:   pageSize,
		TotalItems: totalItems,
		TotalPages: totalPages,
	})
}

// UpdateMemberRole godoc
// @Summary     Update member role
// @Description Updates the role of a group member
// @Tags        group-members
// @Accept      json
// @Produce     json
// @Security    CookieAuth
// @Param       id     path     string                      true "Group public ID (UUID)"
// @Param       userId path     string                      true "User public ID (UUID)"
// @Param       body   body     dto.UpdateMemberRoleRequest true "New role"
// @Success     204    "No Content"
// @Failure     400    {object} apperror.AppError
// @Failure     401    {object} apperror.AppError
// @Failure     403    {object} apperror.AppError
// @Failure     404    {object} apperror.AppError
// @Failure     500    {object} apperror.AppError
// @Router      /groups/{id}/members/{userId} [put]
func (h *GroupHandler) UpdateMemberRole(w http.ResponseWriter, r *http.Request) {
	groupPublicID := r.PathValue("id")
	userPublicID := r.PathValue("userId")

	var req dto.UpdateMemberRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidBody)
		return
	}

	input := usecase.UpdateMemberRoleInput{
		Role: entity.MemberRole(req.Role),
	}

	if err := h.uc.UpdateMemberRole(r.Context(), groupPublicID, userPublicID, input); err != nil {
		response.Error(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// RemoveMember godoc
// @Summary     Remove a member from a group
// @Description Soft-removes a member from a group
// @Tags        group-members
// @Produce     json
// @Security    CookieAuth
// @Param       id     path     string true "Group public ID (UUID)"
// @Param       userId path     string true "User public ID (UUID)"
// @Success     204    "No Content"
// @Failure     401    {object} apperror.AppError
// @Failure     403    {object} apperror.AppError
// @Failure     404    {object} apperror.AppError
// @Failure     500    {object} apperror.AppError
// @Router      /groups/{id}/members/{userId} [delete]
func (h *GroupHandler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	groupPublicID := r.PathValue("id")
	userPublicID := r.PathValue("userId")

	if err := h.uc.RemoveMember(r.Context(), groupPublicID, userPublicID); err != nil {
		response.Error(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
