package dto

import (
	"time"

	"proximos-passos/backend/internal/domain/entity"
)

type CreateUserRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role,omitempty"`
}

type UpdateUserRequest struct {
	Name      *string `json:"name,omitempty"`
	Email     *string `json:"email,omitempty"`
	AvatarURL *string `json:"avatar_url,omitempty"`
	Role      *string `json:"role,omitempty"`
}

type UserResponse struct {
	PublicID        string     `json:"id"`
	Role            string     `json:"role"`
	Name            string     `json:"name"`
	Email           string     `json:"email"`
	EmailVerifiedAt *time.Time `json:"email_verified_at,omitempty"`
	AvatarURL       *string    `json:"avatar_url,omitempty"`
	IsActive        bool       `json:"is_active"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type UserListResponse struct {
	Data       []UserResponse `json:"data"`
	PageNumber int            `json:"page_number"`
	PageSize   int            `json:"page_size"`
	TotalItems int            `json:"total_items"`
	TotalPages int            `json:"total_pages"`
}

func UserToResponse(u *entity.User) UserResponse {
	return UserResponse{
		PublicID:        u.PublicID,
		Role:            string(u.Role),
		Name:            u.Name,
		Email:           u.Email,
		EmailVerifiedAt: u.EmailVerifiedAt,
		AvatarURL:       u.AvatarURL,
		IsActive:        u.IsActive,
		CreatedAt:       u.CreatedAt,
		UpdatedAt:       u.UpdatedAt,
	}
}

func UsersToResponse(users []entity.User) []UserResponse {
	result := make([]UserResponse, len(users))
	for i := range users {
		result[i] = UserToResponse(&users[i])
	}
	return result
}
