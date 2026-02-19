package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"proximos-passos/backend/internal/domain/entity"
)

type QuestionSubmissionRepository struct {
	pool *pgxpool.Pool
}

func NewQuestionSubmissionRepository(pool *pgxpool.Pool) *QuestionSubmissionRepository {
	return &QuestionSubmissionRepository{pool: pool}
}

func (r *QuestionSubmissionRepository) Create(ctx context.Context, s *entity.QuestionSubmission) error {
	return r.pool.QueryRow(ctx,
		`INSERT INTO question_submissions
			(question_id, user_id, activity_submission_id, simulated_exam_id, question_option_id, answer_text, score, answer_feedback, passed)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 RETURNING id, public_id, is_active, submitted_at, updated_at`,
		s.QuestionID, s.UserID, s.ActivitySubmissionID, s.SimulatedExamID,
		s.QuestionOptionID, s.AnswerText, s.Score, s.AnswerFeedback, s.Passed,
	).Scan(&s.ID, &s.PublicID, &s.IsActive, &s.SubmittedAt, &s.UpdatedAt)
}

const submissionSelectFields = `
	qs.id, qs.public_id, qs.question_id, qs.user_id,
	qs.activity_submission_id, qs.simulated_exam_id,
	qs.question_option_id, qs.answer_text, qs.score, qs.answer_feedback,
	qs.passed, qs.is_active, qs.submitted_at, qs.updated_at,
	q.public_id, q.type, q.statement,
	u.public_id, u.name,
	COALESCE(qo.public_id::text, ''), COALESCE(qo.text, ''), COALESCE(qo.is_correct, false)
`

const submissionFromJoins = `
	FROM question_submissions qs
	JOIN questions q ON q.id = qs.question_id
	JOIN users u ON u.id = qs.user_id
	LEFT JOIN question_options qo ON qo.id = qs.question_option_id
`

func scanSubmission(row pgx.Row) (*entity.QuestionSubmission, error) {
	var s entity.QuestionSubmission
	var optText string
	err := row.Scan(
		&s.ID, &s.PublicID, &s.QuestionID, &s.UserID,
		&s.ActivitySubmissionID, &s.SimulatedExamID,
		&s.QuestionOptionID, &s.AnswerText, &s.Score, &s.AnswerFeedback,
		&s.Passed, &s.IsActive, &s.SubmittedAt, &s.UpdatedAt,
		&s.QuestionPublicID, &s.QuestionType, &s.QuestionStatement,
		&s.UserPublicID, &s.UserName,
		&s.OptionPublicID, &optText, &s.OptionIsCorrect,
	)
	if err != nil {
		return nil, err
	}
	if optText != "" {
		s.OptionText = &optText
	}
	return &s, nil
}

func (r *QuestionSubmissionRepository) GetByPublicID(ctx context.Context, publicID string) (*entity.QuestionSubmission, error) {
	row := r.pool.QueryRow(ctx,
		`SELECT `+submissionSelectFields+submissionFromJoins+`
		 WHERE qs.public_id = $1 AND qs.is_active = true`, publicID)
	s, err := scanSubmission(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return s, nil
}

func (r *QuestionSubmissionRepository) ListByUser(ctx context.Context, userID int, limit, offset int, statement string) ([]entity.QuestionSubmission, error) {
	query := `SELECT ` + submissionSelectFields + submissionFromJoins + `
		 WHERE qs.user_id = $1 AND qs.is_active = true`
	args := []any{userID}
	argIdx := 2

	if statement != "" {
		query += fmt.Sprintf(` AND q.statement ILIKE $%d`, argIdx)
		args = append(args, "%"+statement+"%")
		argIdx++
	}

	query += fmt.Sprintf(` ORDER BY qs.submitted_at DESC LIMIT $%d OFFSET $%d`, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []entity.QuestionSubmission
	for rows.Next() {
		s, err := scanSubmission(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, *s)
	}
	return result, rows.Err()
}

func (r *QuestionSubmissionRepository) CountByUser(ctx context.Context, userID int, statement string) (int, error) {
	var count int
	if statement != "" {
		err := r.pool.QueryRow(ctx,
			`SELECT COUNT(*) FROM question_submissions qs
			 JOIN questions q ON q.id = qs.question_id
			 WHERE qs.user_id = $1 AND qs.is_active = true AND q.statement ILIKE $2`,
			userID, "%"+statement+"%").Scan(&count)
		return count, err
	}
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM question_submissions WHERE user_id = $1 AND is_active = true`, userID).Scan(&count)
	return count, err
}

func (r *QuestionSubmissionRepository) ListByQuestion(ctx context.Context, questionID int, limit, offset int) ([]entity.QuestionSubmission, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT `+submissionSelectFields+submissionFromJoins+`
		 WHERE qs.question_id = $1 AND qs.is_active = true
		 ORDER BY qs.submitted_at DESC
		 LIMIT $2 OFFSET $3`, questionID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []entity.QuestionSubmission
	for rows.Next() {
		s, err := scanSubmission(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, *s)
	}
	return result, rows.Err()
}

func (r *QuestionSubmissionRepository) CountByQuestion(ctx context.Context, questionID int) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM question_submissions WHERE question_id = $1 AND is_active = true`, questionID).Scan(&count)
	return count, err
}

func (r *QuestionSubmissionRepository) ListByActivitySubmission(ctx context.Context, activitySubmissionID int) ([]entity.QuestionSubmission, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT `+submissionSelectFields+submissionFromJoins+`
		 WHERE qs.activity_submission_id = $1 AND qs.is_active = true
		 ORDER BY qs.submitted_at DESC`, activitySubmissionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []entity.QuestionSubmission
	for rows.Next() {
		s, err := scanSubmission(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, *s)
	}
	return result, rows.Err()
}
