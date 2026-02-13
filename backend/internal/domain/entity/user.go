package entity

import "time"

type UserRole string

const (
	UserRoleAdmin   UserRole = "admin"
	UserRoleRegular UserRole = "regular"
)

type User struct {
	ID              int
	PublicID        string
	Role            UserRole
	Name            string
	Email           string
	EmailVerifiedAt *time.Time
	PasswordHash    string
	AvatarURL       *string
	IsActive        bool
	CreatedAt       time.Time
	UpdatedAt       time.Time
}
