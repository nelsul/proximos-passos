package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"proximos-passos/backend/internal/domain/entity"
	"proximos-passos/backend/internal/domain/repository"
)

type HandoutRepository struct {
	pool *pgxpool.Pool
}

func NewHandoutRepository(pool *pgxpool.Pool) *HandoutRepository {
	return &HandoutRepository{pool: pool}
}

func (r *HandoutRepository) Create(ctx context.Context, handout *entity.Handout, topicIDs []int) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Insert the file record
	var fileID int
	var filePublicID string
	err = tx.QueryRow(ctx,
		`INSERT INTO files (key, filename, content_type, size_bytes, uploaded_by_id)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, public_id`,
		handout.FileKey, handout.Filename, handout.ContentType, handout.SizeBytes, handout.CreatedByID,
	).Scan(&fileID, &filePublicID)
	if err != nil {
		return err
	}

	handout.FileID = fileID
	handout.FilePublicID = filePublicID

	// Insert the handout record
	err = tx.QueryRow(ctx,
		`INSERT INTO handouts (title, description, file_id, created_by_id)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, public_id, is_active, created_at, updated_at`,
		handout.Title, handout.Description, handout.FileID, handout.CreatedByID,
	).Scan(&handout.ID, &handout.PublicID, &handout.IsActive, &handout.CreatedAt, &handout.UpdatedAt)
	if err != nil {
		return err
	}

	// Insert topic associations
	for _, topicID := range topicIDs {
		_, err = tx.Exec(ctx,
			`INSERT INTO handout_topics (handout_id, topic_id) VALUES ($1, $2)`,
			handout.ID, topicID,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *HandoutRepository) GetByPublicID(ctx context.Context, publicID string) (*entity.Handout, error) {
	var h entity.Handout
	err := r.pool.QueryRow(ctx,
		`SELECT h.id, h.public_id, h.title, h.description,
		        h.file_id, h.is_active, h.created_by_id, h.created_at, h.updated_at,
		        f.public_id, f.key, f.filename, f.content_type, f.size_bytes
		 FROM handouts h
		 JOIN files f ON f.id = h.file_id
		 WHERE h.public_id = $1 AND h.is_active = true`,
		publicID,
	).Scan(&h.ID, &h.PublicID, &h.Title, &h.Description,
		&h.FileID, &h.IsActive, &h.CreatedByID, &h.CreatedAt, &h.UpdatedAt,
		&h.FilePublicID, &h.FileKey, &h.Filename, &h.ContentType, &h.SizeBytes)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	topics, err := r.loadTopics(ctx, h.ID)
	if err != nil {
		return nil, err
	}
	h.Topics = topics

	return &h, nil
}

func (r *HandoutRepository) Update(ctx context.Context, handout *entity.Handout) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE handouts
		 SET title = $1, description = $2, updated_at = NOW()
		 WHERE public_id = $3 AND is_active = true`,
		handout.Title, handout.Description, handout.PublicID,
	)
	return err
}

func (r *HandoutRepository) ReplaceFile(ctx context.Context, handoutID int, newFileID int) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE handouts SET file_id = $1, updated_at = NOW() WHERE id = $2 AND is_active = true`,
		newFileID, handoutID,
	)
	return err
}

func (r *HandoutRepository) CreateFileAndReplace(ctx context.Context, handoutID int, handout *entity.Handout, uploadedByID int) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var fileID int
	err = tx.QueryRow(ctx,
		`INSERT INTO files (key, filename, content_type, size_bytes, uploaded_by_id)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id`,
		handout.FileKey, handout.Filename, handout.ContentType, handout.SizeBytes, uploadedByID,
	).Scan(&fileID)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx,
		`UPDATE handouts SET file_id = $1, updated_at = NOW() WHERE id = $2 AND is_active = true`,
		fileID, handoutID,
	)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *HandoutRepository) SetTopics(ctx context.Context, handoutID int, topicIDs []int) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `DELETE FROM handout_topics WHERE handout_id = $1`, handoutID)
	if err != nil {
		return err
	}

	for _, topicID := range topicIDs {
		_, err = tx.Exec(ctx,
			`INSERT INTO handout_topics (handout_id, topic_id) VALUES ($1, $2)`,
			handoutID, topicID,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *HandoutRepository) Delete(ctx context.Context, publicID string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE handouts SET is_active = false, updated_at = NOW()
		 WHERE public_id = $1 AND is_active = true`,
		publicID,
	)
	return err
}

func (r *HandoutRepository) List(ctx context.Context, limit, offset int, filter repository.HandoutFilter) ([]entity.Handout, error) {
	filterClause, filterArgs := buildHandoutFilterClause(filter)

	query := fmt.Sprintf(
		`SELECT h.id, h.public_id, h.title, h.description,
		        h.file_id, h.is_active, h.created_by_id, h.created_at, h.updated_at,
		        f.public_id, f.key, f.filename, f.content_type, f.size_bytes
		 FROM handouts h
		 JOIN files f ON f.id = h.file_id
		 WHERE h.is_active = true%s
		 ORDER BY h.created_at DESC
		 LIMIT $%d OFFSET $%d`,
		filterClause, len(filterArgs)+1, len(filterArgs)+2,
	)

	args := append(filterArgs, limit, offset)
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var handouts []entity.Handout
	for rows.Next() {
		var h entity.Handout
		if err := rows.Scan(&h.ID, &h.PublicID, &h.Title, &h.Description,
			&h.FileID, &h.IsActive, &h.CreatedByID, &h.CreatedAt, &h.UpdatedAt,
			&h.FilePublicID, &h.FileKey, &h.Filename, &h.ContentType, &h.SizeBytes); err != nil {
			return nil, err
		}
		handouts = append(handouts, h)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Load topics for each handout
	for i := range handouts {
		topics, err := r.loadTopics(ctx, handouts[i].ID)
		if err != nil {
			return nil, err
		}
		handouts[i].Topics = topics
	}

	return handouts, nil
}

func (r *HandoutRepository) Count(ctx context.Context, filter repository.HandoutFilter) (int, error) {
	filterClause, filterArgs := buildHandoutFilterClause(filter)

	query := fmt.Sprintf(
		`SELECT COUNT(*)
		 FROM handouts h
		 WHERE h.is_active = true%s`,
		filterClause,
	)

	var count int
	err := r.pool.QueryRow(ctx, query, filterArgs...).Scan(&count)
	return count, err
}

func buildHandoutFilterClause(filter repository.HandoutFilter) (string, []any) {
	clause := ""
	args := []any{}
	argIdx := 1

	if filter.Title != "" {
		clause += fmt.Sprintf(" AND h.title ILIKE $%d", argIdx)
		args = append(args, "%"+filter.Title+"%")
		argIdx++
	}

	if filter.TopicID != nil {
		clause += fmt.Sprintf(" AND EXISTS (SELECT 1 FROM handout_topics ht2 WHERE ht2.handout_id = h.id AND ht2.topic_id IN (WITH RECURSIVE topic_tree AS (SELECT id FROM topics WHERE id = $%d UNION ALL SELECT t.id FROM topics t JOIN topic_tree tt ON t.parent_id = tt.id) SELECT id FROM topic_tree))", argIdx)
		args = append(args, *filter.TopicID)
		argIdx++
	}

	return clause, args
}

func (r *HandoutRepository) loadTopics(ctx context.Context, handoutID int) ([]entity.TopicRef, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT t.id, t.public_id, t.name
		 FROM handout_topics ht
		 JOIN topics t ON t.id = ht.topic_id
		 WHERE ht.handout_id = $1 AND t.is_active = true
		 ORDER BY t.name ASC`,
		handoutID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var topics []entity.TopicRef
	for rows.Next() {
		var t entity.TopicRef
		if err := rows.Scan(&t.ID, &t.PublicID, &t.Name); err != nil {
			return nil, err
		}
		topics = append(topics, t)
	}
	return topics, rows.Err()
}
