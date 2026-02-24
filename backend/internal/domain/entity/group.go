package entity

import "time"

type GroupAccessType string

const (
	GroupAccessOpen   GroupAccessType = "open"
	GroupAccessClosed GroupAccessType = "closed"
)

type GroupVisibilityType string

const (
	GroupVisibilityPublic  GroupVisibilityType = "public"
	GroupVisibilityPrivate GroupVisibilityType = "private"
)

type MemberRole string

const (
	MemberRoleAdmin      MemberRole = "admin"
	MemberRoleSupervisor MemberRole = "supervisor"
	MemberRoleMember     MemberRole = "member"
)

type Group struct {
	ID             int
	PublicID       string
	Name           string
	Description    *string
	AccessType     GroupAccessType
	VisibilityType GroupVisibilityType
	ThumbnailURL   *string
	IsActive       bool
	CreatedByID    int
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type GroupMember struct {
	GroupID      int
	UserID       int
	UserPublicID string // populated via JOIN when listing
	Role         MemberRole
	AcceptedByID *int
	IsActive     bool
	CreatedByID  int
	JoinedAt     time.Time
	UpdatedAt    time.Time

	// User details populated via JOIN when listing
	UserName      string
	UserEmail     string
	UserAvatarURL *string
}
