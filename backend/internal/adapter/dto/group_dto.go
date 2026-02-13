package dto

import (
	"time"

	"proximos-passos/backend/internal/domain/entity"
)

// ==========================================
// Group DTOs
// ==========================================

type CreateGroupRequest struct {
	Name           string  `json:"name"`
	Description    *string `json:"description,omitempty"`
	AccessType     string  `json:"access_type,omitempty"`
	VisibilityType string  `json:"visibility_type,omitempty"`
}

type UpdateGroupRequest struct {
	Name           *string `json:"name,omitempty"`
	Description    *string `json:"description,omitempty"`
	AccessType     *string `json:"access_type,omitempty"`
	VisibilityType *string `json:"visibility_type,omitempty"`
}

type GroupResponse struct {
	PublicID       string    `json:"id"`
	Name           string    `json:"name"`
	Description    *string   `json:"description,omitempty"`
	AccessType     string    `json:"access_type"`
	VisibilityType string    `json:"visibility_type"`
	ThumbnailURL   *string   `json:"thumbnail_url,omitempty"`
	IsActive       bool      `json:"is_active"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type GroupListResponse struct {
	Data       []GroupResponse `json:"data"`
	PageNumber int             `json:"page_number"`
	PageSize   int             `json:"page_size"`
	TotalItems int             `json:"total_items"`
	TotalPages int             `json:"total_pages"`
}

func GroupToResponse(g *entity.Group) GroupResponse {
	return GroupResponse{
		PublicID:       g.PublicID,
		Name:           g.Name,
		Description:    g.Description,
		AccessType:     string(g.AccessType),
		VisibilityType: string(g.VisibilityType),
		ThumbnailURL:   g.ThumbnailURL,
		IsActive:       g.IsActive,
		CreatedAt:      g.CreatedAt,
		UpdatedAt:      g.UpdatedAt,
	}
}

func GroupsToResponse(groups []entity.Group) []GroupResponse {
	result := make([]GroupResponse, len(groups))
	for i := range groups {
		result[i] = GroupToResponse(&groups[i])
	}
	return result
}

// ==========================================
// Group Member DTOs
// ==========================================

type AddMemberRequest struct {
	UserPublicID string `json:"user_id"`
	Role         string `json:"role,omitempty"`
}

type UpdateMemberRoleRequest struct {
	Role string `json:"role"`
}

type GroupMemberResponse struct {
	UserPublicID string    `json:"user_id"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	AvatarURL    *string   `json:"avatar_url"`
	Role         string    `json:"role"`
	IsActive     bool      `json:"is_active"`
	JoinedAt     time.Time `json:"joined_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type GroupMemberListResponse struct {
	Data       []GroupMemberResponse `json:"data"`
	PageNumber int                   `json:"page_number"`
	PageSize   int                   `json:"page_size"`
	TotalItems int                   `json:"total_items"`
	TotalPages int                   `json:"total_pages"`
}
