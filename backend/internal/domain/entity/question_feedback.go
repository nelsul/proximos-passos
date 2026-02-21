package entity

import "time"

type QuestionFeedback struct {
	ID               int       `json:"id"`
	PublicID         string    `json:"public_id"`
	QuestionID       int       `json:"-"`
	UserID           int       `json:"-"`
	DifficultyLogic  int       `json:"difficulty_logic"`
	DifficultyLabor  int       `json:"difficulty_labor"`
	DifficultyTheory int       `json:"difficulty_theory"`
	IsActive         bool      `json:"is_active"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}
