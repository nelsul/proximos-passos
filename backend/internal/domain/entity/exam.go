package entity

import "time"

type Exam struct {
	ID            int
	PublicID      string
	InstitutionID int
	Title         string
	Description   *string
	Year          int
	IsActive      bool
	CreatedByID   int
	CreatedAt     time.Time
	UpdatedAt     time.Time

	// Joined fields
	InstitutionPublicID string
	InstitutionName     string
	InstitutionAcronym  string
}
