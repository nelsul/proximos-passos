package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"proximos-passos/backend/internal/domain/entity"
	"proximos-passos/backend/internal/domain/repository"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ActivityRepository struct {
	pool *pgxpool.Pool
}

func NewActivityRepository(pool *pgxpool.Pool) *ActivityRepository {
	return &ActivityRepository{pool: pool}
}

func (r *ActivityRepository) Create(ctx context.Context, activity *entity.Activity) error {
	return r.pool.QueryRow(ctx,
		`INSERT INTO activities (group_id, title, description, due_date, created_by_id)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, public_id, is_active, created_at, updated_at`,
		activity.GroupID, activity.Title, activity.Description, activity.DueDate, activity.CreatedByID,
	).Scan(&activity.ID, &activity.PublicID, &activity.IsActive, &activity.CreatedAt, &activity.UpdatedAt)
}

func (r *ActivityRepository) GetByPublicID(ctx context.Context, publicID string) (*entity.Activity, error) {
	var a entity.Activity
	err := r.pool.QueryRow(ctx,
		`SELECT a.id, a.public_id, a.group_id, g.public_id, a.title, a.description, a.due_date,
		        a.is_active, a.created_by_id, a.created_at, a.updated_at
		 FROM activities a
		 JOIN groups g ON g.id = a.group_id
		 WHERE a.public_id = $1 AND a.is_active = true`,
		publicID,
	).Scan(&a.ID, &a.PublicID, &a.GroupID, &a.GroupPublicID, &a.Title, &a.Description, &a.DueDate,
		&a.IsActive, &a.CreatedByID, &a.CreatedAt, &a.UpdatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &a, nil
}

func (r *ActivityRepository) Update(ctx context.Context, activity *entity.Activity) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE activities
		 SET title = $1, description = $2, due_date = $3, updated_at = NOW()
		 WHERE public_id = $4 AND is_active = true`,
		activity.Title, activity.Description, activity.DueDate, activity.PublicID,
	)
	return err
}

func (r *ActivityRepository) Delete(ctx context.Context, publicID string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE activities SET is_active = false, updated_at = NOW() WHERE public_id = $1`,
		publicID,
	)
	return err
}

func buildActivityFilterClause(filter repository.ActivityFilter, startParam int) (string, []any) {
	var clauses []string
	var args []any
	paramIdx := startParam

	if filter.Title != "" {
		clauses = append(clauses, fmt.Sprintf("a.title ILIKE $%d", paramIdx))
		args = append(args, "%"+filter.Title+"%")
		paramIdx++
	}

	if len(clauses) == 0 {
		return "", nil
	}
	return " AND " + strings.Join(clauses, " AND "), args
}

func (r *ActivityRepository) ListUpcoming(ctx context.Context, groupID int, limit, offset int, filter repository.ActivityFilter) ([]entity.Activity, error) {
	filterClause, filterArgs := buildActivityFilterClause(filter, 4)

	query := fmt.Sprintf(
		`SELECT a.id, a.public_id, a.group_id, g.public_id, a.title, a.description, a.due_date,
		        a.is_active, a.created_by_id, a.created_at, a.updated_at
		 FROM activities a
		 JOIN groups g ON g.id = a.group_id
		 WHERE a.group_id = $1 AND a.is_active = true AND a.due_date >= NOW()%s
		 ORDER BY a.due_date ASC
		 LIMIT $2 OFFSET $3`, filterClause)

	args := append([]any{groupID, limit, offset}, filterArgs...)
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanActivities(rows)
}

func (r *ActivityRepository) CountUpcoming(ctx context.Context, groupID int, filter repository.ActivityFilter) (int, error) {
	filterClause, filterArgs := buildActivityFilterClause(filter, 2)

	query := fmt.Sprintf(
		`SELECT COUNT(*) FROM activities a
		 WHERE a.group_id = $1 AND a.is_active = true AND a.due_date >= NOW()%s`, filterClause)

	args := append([]any{groupID}, filterArgs...)
	var count int
	err := r.pool.QueryRow(ctx, query, args...).Scan(&count)
	return count, err
}

func (r *ActivityRepository) ListPast(ctx context.Context, groupID int, limit, offset int, filter repository.ActivityFilter) ([]entity.Activity, error) {
	filterClause, filterArgs := buildActivityFilterClause(filter, 4)

	query := fmt.Sprintf(
		`SELECT a.id, a.public_id, a.group_id, g.public_id, a.title, a.description, a.due_date,
		        a.is_active, a.created_by_id, a.created_at, a.updated_at
		 FROM activities a
		 JOIN groups g ON g.id = a.group_id
		 WHERE a.group_id = $1 AND a.is_active = true AND a.due_date < NOW()%s
		 ORDER BY a.due_date DESC
		 LIMIT $2 OFFSET $3`, filterClause)

	args := append([]any{groupID, limit, offset}, filterArgs...)
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanActivities(rows)
}

func (r *ActivityRepository) CountPast(ctx context.Context, groupID int, filter repository.ActivityFilter) (int, error) {
	filterClause, filterArgs := buildActivityFilterClause(filter, 2)

	query := fmt.Sprintf(
		`SELECT COUNT(*) FROM activities a
		 WHERE a.group_id = $1 AND a.is_active = true AND a.due_date < NOW()%s`, filterClause)

	args := append([]any{groupID}, filterArgs...)
	var count int
	err := r.pool.QueryRow(ctx, query, args...).Scan(&count)
	return count, err
}

func scanActivities(rows pgx.Rows) ([]entity.Activity, error) {
	var activities []entity.Activity
	for rows.Next() {
		var a entity.Activity
		if err := rows.Scan(&a.ID, &a.PublicID, &a.GroupID, &a.GroupPublicID, &a.Title, &a.Description, &a.DueDate,
			&a.IsActive, &a.CreatedByID, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		activities = append(activities, a)
	}
	return activities, rows.Err()
}

// ==========================================
// Attachments
// ==========================================

func (r *ActivityRepository) CreateFile(ctx context.Context, file *entity.ActivityAttachment, uploadedByID int) error {
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
		`INSERT INTO activity_attachments (activity_id, file_id) VALUES ($1, $2)`,
		file.ActivityID, file.FileID,
	)
	return err
}

func (r *ActivityRepository) DeleteFile(ctx context.Context, fileID int) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE files SET is_active = false, updated_at = NOW() WHERE id = $1`,
		fileID,
	)
	return err
}

func (r *ActivityRepository) ListAttachments(ctx context.Context, activityID int) ([]entity.ActivityAttachment, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT aa.activity_id, f.id, f.public_id, f.key, f.filename, f.content_type, f.size_bytes, f.created_at
		 FROM activity_attachments aa
		 JOIN files f ON f.id = aa.file_id
		 WHERE aa.activity_id = $1 AND f.is_active = true
		 ORDER BY f.created_at ASC`,
		activityID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var attachments []entity.ActivityAttachment
	for rows.Next() {
		var a entity.ActivityAttachment
		if err := rows.Scan(&a.ActivityID, &a.FileID, &a.FilePublicID, &a.Key, &a.Filename,
			&a.ContentType, &a.SizeBytes, &a.CreatedAt); err != nil {
			return nil, err
		}
		attachments = append(attachments, a)
	}
	return attachments, rows.Err()
}

func (r *ActivityRepository) GetAttachment(ctx context.Context, activityID int, filePublicID string) (*entity.ActivityAttachment, error) {
	var a entity.ActivityAttachment
	err := r.pool.QueryRow(ctx,
		`SELECT aa.activity_id, f.id, f.public_id, f.key, f.filename, f.content_type, f.size_bytes, f.created_at
		 FROM activity_attachments aa
		 JOIN files f ON f.id = aa.file_id
		 WHERE aa.activity_id = $1 AND f.public_id = $2 AND f.is_active = true`,
		activityID, filePublicID,
	).Scan(&a.ActivityID, &a.FileID, &a.FilePublicID, &a.Key, &a.Filename,
		&a.ContentType, &a.SizeBytes, &a.CreatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &a, nil
}
