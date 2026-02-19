package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"proximos-passos/backend/internal/domain/entity"
)

type ActivitySubmissionRepository struct {
	pool *pgxpool.Pool
}

func NewActivitySubmissionRepository(pool *pgxpool.Pool) *ActivitySubmissionRepository {
	return &ActivitySubmissionRepository{pool: pool}
}

const actSubSelectFields = `
	asub.id, asub.public_id, asub.activity_id, asub.user_id,
	asub.status, asub.notes, asub.feedback_notes,
	asub.reviewed_at, asub.reviewed_by_id,
	asub.is_active, asub.submitted_at, asub.updated_at,
	a.public_id, a.title,
	u.public_id, u.name,
	r.public_id, r.name
`

const actSubFromJoins = `
	FROM activity_submissions asub
	JOIN activities a ON a.id = asub.activity_id
	JOIN users u ON u.id = asub.user_id
	LEFT JOIN users r ON r.id = asub.reviewed_by_id
`

func scanActivitySubmission(row pgx.Row) (*entity.ActivitySubmission, error) {
	var s entity.ActivitySubmission
	err := row.Scan(
		&s.ID, &s.PublicID, &s.ActivityID, &s.UserID,
		&s.Status, &s.Notes, &s.FeedbackNotes,
		&s.ReviewedAt, &s.ReviewedByID,
		&s.IsActive, &s.SubmittedAt, &s.UpdatedAt,
		&s.ActivityPublicID, &s.ActivityTitle,
		&s.UserPublicID, &s.UserName,
		&s.ReviewerPublicID, &s.ReviewerName,
	)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *ActivitySubmissionRepository) Create(ctx context.Context, s *entity.ActivitySubmission) error {
	return r.pool.QueryRow(ctx,
		`INSERT INTO activity_submissions (activity_id, user_id, notes)
		 VALUES ($1, $2, $3)
		 RETURNING id, public_id, status, is_active, submitted_at, updated_at`,
		s.ActivityID, s.UserID, s.Notes,
	).Scan(&s.ID, &s.PublicID, &s.Status, &s.IsActive, &s.SubmittedAt, &s.UpdatedAt)
}

func (r *ActivitySubmissionRepository) GetByPublicID(ctx context.Context, publicID string) (*entity.ActivitySubmission, error) {
	row := r.pool.QueryRow(ctx,
		`SELECT `+actSubSelectFields+actSubFromJoins+`
		 WHERE asub.public_id = $1 AND asub.is_active = true`, publicID)
	s, err := scanActivitySubmission(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return s, nil
}

func (r *ActivitySubmissionRepository) GetByActivityAndUser(ctx context.Context, activityID, userID int) (*entity.ActivitySubmission, error) {
	row := r.pool.QueryRow(ctx,
		`SELECT `+actSubSelectFields+actSubFromJoins+`
		 WHERE asub.activity_id = $1 AND asub.user_id = $2 AND asub.is_active = true`,
		activityID, userID)
	s, err := scanActivitySubmission(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return s, nil
}

func (r *ActivitySubmissionRepository) ListByActivity(ctx context.Context, activityID int, limit, offset int) ([]entity.ActivitySubmission, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT `+actSubSelectFields+actSubFromJoins+`
		 WHERE asub.activity_id = $1 AND asub.is_active = true
		 ORDER BY asub.submitted_at DESC
		 LIMIT $2 OFFSET $3`, activityID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []entity.ActivitySubmission
	for rows.Next() {
		s, err := scanActivitySubmission(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, *s)
	}
	return result, rows.Err()
}

func (r *ActivitySubmissionRepository) CountByActivity(ctx context.Context, activityID int) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM activity_submissions WHERE activity_id = $1 AND is_active = true`,
		activityID).Scan(&count)
	return count, err
}

func (r *ActivitySubmissionRepository) ListByUser(ctx context.Context, userID int, limit, offset int) ([]entity.ActivitySubmission, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT `+actSubSelectFields+actSubFromJoins+`
		 WHERE asub.user_id = $1 AND asub.is_active = true
		 ORDER BY asub.submitted_at DESC
		 LIMIT $2 OFFSET $3`, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []entity.ActivitySubmission
	for rows.Next() {
		s, err := scanActivitySubmission(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, *s)
	}
	return result, rows.Err()
}

func (r *ActivitySubmissionRepository) CountByUser(ctx context.Context, userID int) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM activity_submissions WHERE user_id = $1 AND is_active = true`,
		userID).Scan(&count)
	return count, err
}

func (r *ActivitySubmissionRepository) UpdateStatus(ctx context.Context, s *entity.ActivitySubmission) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE activity_submissions
		 SET status = $1, feedback_notes = $2, reviewed_at = NOW(), reviewed_by_id = $3, updated_at = NOW()
		 WHERE id = $4`,
		s.Status, s.FeedbackNotes, s.ReviewedByID, s.ID)
	return err
}

func (r *ActivitySubmissionRepository) UpdateNotes(ctx context.Context, id int, notes *string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE activity_submissions SET notes = $1, updated_at = NOW() WHERE id = $2`,
		notes, id)
	return err
}

func (r *ActivitySubmissionRepository) CreateFile(ctx context.Context, file *entity.ActivitySubmissionAttachment, uploadedByID int) error {
	var fileID int
	var filePublicID string
	var createdAt interface{}

	err := r.pool.QueryRow(ctx,
		`INSERT INTO files (key, filename, content_type, size_bytes, uploaded_by_id)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, public_id, created_at`,
		file.Key, file.Filename, file.ContentType, file.SizeBytes, uploadedByID,
	).Scan(&fileID, &filePublicID, &createdAt)
	if err != nil {
		return err
	}

	file.FileID = fileID
	file.FilePublicID = filePublicID

	_, err = r.pool.Exec(ctx,
		`INSERT INTO activity_submission_attachments (activity_submission_id, file_id) VALUES ($1, $2)`,
		file.SubmissionID, file.FileID,
	)
	return err
}

func (r *ActivitySubmissionRepository) DeleteFile(ctx context.Context, fileID int) error {
	_, err := r.pool.Exec(ctx,
		`DELETE FROM activity_submission_attachments WHERE file_id = $1`, fileID)
	if err != nil {
		return err
	}
	_, err = r.pool.Exec(ctx,
		`UPDATE files SET is_active = false, updated_at = NOW() WHERE id = $1`, fileID)
	return err
}

func (r *ActivitySubmissionRepository) ListAttachments(ctx context.Context, submissionID int) ([]entity.ActivitySubmissionAttachment, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT asa.activity_submission_id, f.id, f.public_id, f.key, f.filename, f.content_type, f.size_bytes, f.created_at
		 FROM activity_submission_attachments asa
		 JOIN files f ON f.id = asa.file_id
		 WHERE asa.activity_submission_id = $1 AND f.is_active = true
		 ORDER BY f.created_at ASC`,
		submissionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var attachments []entity.ActivitySubmissionAttachment
	for rows.Next() {
		var a entity.ActivitySubmissionAttachment
		if err := rows.Scan(&a.SubmissionID, &a.FileID, &a.FilePublicID, &a.Key, &a.Filename,
			&a.ContentType, &a.SizeBytes, &a.CreatedAt); err != nil {
			return nil, err
		}
		attachments = append(attachments, a)
	}
	return attachments, rows.Err()
}

func (r *ActivitySubmissionRepository) GetAttachment(ctx context.Context, submissionID int, filePublicID string) (*entity.ActivitySubmissionAttachment, error) {
	var a entity.ActivitySubmissionAttachment
	err := r.pool.QueryRow(ctx,
		`SELECT asa.activity_submission_id, f.id, f.public_id, f.key, f.filename, f.content_type, f.size_bytes, f.created_at
		 FROM activity_submission_attachments asa
		 JOIN files f ON f.id = asa.file_id
		 WHERE asa.activity_submission_id = $1 AND f.public_id = $2 AND f.is_active = true`,
		submissionID, filePublicID,
	).Scan(&a.SubmissionID, &a.FileID, &a.FilePublicID, &a.Key, &a.Filename,
		&a.ContentType, &a.SizeBytes, &a.CreatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &a, nil
}
