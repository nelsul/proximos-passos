package entity

import "time"

type Institution struct {
	ID          int
	PublicID    string
	Name        string
	Acronym     string
	IsActive    bool
	CreatedByID int
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
