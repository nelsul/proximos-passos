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

type VideoLessonRepository struct {
	pool *pgxpool.Pool
}

func NewVideoLessonRepository(pool *pgxpool.Pool) *VideoLessonRepository {
	return &VideoLessonRepository{pool: pool}
}

func (r *VideoLessonRepository) Create(ctx context.Context, vl *entity.VideoLesson, topicIDs []int) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// If we have a file to upload, insert file record first
	if vl.FileKey != "" {
		var fileID int
		var filePublicID string
		err = tx.QueryRow(ctx,
			`INSERT INTO files (key, filename, content_type, size_bytes, uploaded_by_id)
			 VALUES ($1, $2, $3, $4, $5)
			 RETURNING id, public_id`,
			vl.FileKey, vl.Filename, vl.ContentType, vl.SizeBytes, vl.CreatedByID,
		).Scan(&fileID, &filePublicID)
		if err != nil {
			return err
		}
		vl.FileID = &fileID
		vl.FilePublicID = filePublicID
	}

	// Insert the video lesson record
	err = tx.QueryRow(ctx,
		`INSERT INTO video_lessons (title, description, file_id, file_url, duration_minutes, created_by_id)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, public_id, is_active, created_at, updated_at`,
		vl.Title, vl.Description, vl.FileID, vl.FileURL, vl.DurationMinutes, vl.CreatedByID,
	).Scan(&vl.ID, &vl.PublicID, &vl.IsActive, &vl.CreatedAt, &vl.UpdatedAt)
	if err != nil {
		return err
	}

	// Insert topic associations
	for _, topicID := range topicIDs {
		_, err = tx.Exec(ctx,
			`INSERT INTO video_lesson_topics (video_lesson_id, topic_id) VALUES ($1, $2)`,
			vl.ID, topicID,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *VideoLessonRepository) GetByPublicID(ctx context.Context, publicID string) (*entity.VideoLesson, error) {
	var vl entity.VideoLesson
	var filePublicID, fileKey, filename, contentType *string
	var sizeBytes *int64
	err := r.pool.QueryRow(ctx,
		`SELECT vl.id, vl.public_id, vl.title, vl.description,
		        vl.file_id, vl.file_url, vl.duration_minutes,
		        vl.is_active, vl.created_by_id, vl.created_at, vl.updated_at,
		        f.public_id, f.key, f.filename, f.content_type, f.size_bytes
		 FROM video_lessons vl
		 LEFT JOIN files f ON f.id = vl.file_id
		 WHERE vl.public_id = $1 AND vl.is_active = true`,
		publicID,
	).Scan(&vl.ID, &vl.PublicID, &vl.Title, &vl.Description,
		&vl.FileID, &vl.FileURL, &vl.DurationMinutes,
		&vl.IsActive, &vl.CreatedByID, &vl.CreatedAt, &vl.UpdatedAt,
		&filePublicID, &fileKey, &filename, &contentType, &sizeBytes)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	if filePublicID != nil {
		vl.FilePublicID = *filePublicID
		vl.FileKey = *fileKey
		vl.Filename = *filename
		vl.ContentType = *contentType
		vl.SizeBytes = *sizeBytes
	}

	topics, err := r.loadTopics(ctx, vl.ID)
	if err != nil {
		return nil, err
	}
	vl.Topics = topics

	return &vl, nil
}

func (r *VideoLessonRepository) Update(ctx context.Context, vl *entity.VideoLesson) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE video_lessons
		 SET title = $1, description = $2, file_url = $3, duration_minutes = $4, updated_at = NOW()
		 WHERE public_id = $5 AND is_active = true`,
		vl.Title, vl.Description, vl.FileURL, vl.DurationMinutes, vl.PublicID,
	)
	return err
}

func (r *VideoLessonRepository) ReplaceFile(ctx context.Context, vlID int, newFileID int) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE video_lessons SET file_id = $1, updated_at = NOW() WHERE id = $2 AND is_active = true`,
		newFileID, vlID,
	)
	return err
}

func (r *VideoLessonRepository) CreateFileAndReplace(ctx context.Context, vlID int, vl *entity.VideoLesson, uploadedByID int) error {
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
		vl.FileKey, vl.Filename, vl.ContentType, vl.SizeBytes, uploadedByID,
	).Scan(&fileID)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx,
		`UPDATE video_lessons SET file_id = $1, updated_at = NOW() WHERE id = $2 AND is_active = true`,
		fileID, vlID,
	)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *VideoLessonRepository) SetTopics(ctx context.Context, vlID int, topicIDs []int) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `DELETE FROM video_lesson_topics WHERE video_lesson_id = $1`, vlID)
	if err != nil {
		return err
	}

	for _, topicID := range topicIDs {
		_, err = tx.Exec(ctx,
			`INSERT INTO video_lesson_topics (video_lesson_id, topic_id) VALUES ($1, $2)`,
			vlID, topicID,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *VideoLessonRepository) Delete(ctx context.Context, publicID string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE video_lessons SET is_active = false, updated_at = NOW()
		 WHERE public_id = $1 AND is_active = true`,
		publicID,
	)
	return err
}

func (r *VideoLessonRepository) List(ctx context.Context, limit, offset int, filter repository.VideoLessonFilter) ([]entity.VideoLesson, error) {
	filterClause, filterArgs := buildVideoLessonFilterClause(filter)

	query := fmt.Sprintf(
		`SELECT vl.id, vl.public_id, vl.title, vl.description,
		        vl.file_id, vl.file_url, vl.duration_minutes,
		        vl.is_active, vl.created_by_id, vl.created_at, vl.updated_at,
		        f.public_id, f.key, f.filename, f.content_type, f.size_bytes
		 FROM video_lessons vl
		 LEFT JOIN files f ON f.id = vl.file_id
		 WHERE vl.is_active = true%s
		 ORDER BY vl.created_at DESC
		 LIMIT $%d OFFSET $%d`,
		filterClause, len(filterArgs)+1, len(filterArgs)+2,
	)

	args := append(filterArgs, limit, offset)
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var lessons []entity.VideoLesson
	for rows.Next() {
		var vl entity.VideoLesson
		var filePublicID, fileKey, filename, contentType *string
		var sizeBytes *int64
		if err := rows.Scan(&vl.ID, &vl.PublicID, &vl.Title, &vl.Description,
			&vl.FileID, &vl.FileURL, &vl.DurationMinutes,
			&vl.IsActive, &vl.CreatedByID, &vl.CreatedAt, &vl.UpdatedAt,
			&filePublicID, &fileKey, &filename, &contentType, &sizeBytes); err != nil {
			return nil, err
		}
		if filePublicID != nil {
			vl.FilePublicID = *filePublicID
			vl.FileKey = *fileKey
			vl.Filename = *filename
			vl.ContentType = *contentType
			vl.SizeBytes = *sizeBytes
		}
		lessons = append(lessons, vl)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Load topics for each lesson
	for i := range lessons {
		topics, err := r.loadTopics(ctx, lessons[i].ID)
		if err != nil {
			return nil, err
		}
		lessons[i].Topics = topics
	}

	return lessons, nil
}

func (r *VideoLessonRepository) Count(ctx context.Context, filter repository.VideoLessonFilter) (int, error) {
	filterClause, filterArgs := buildVideoLessonFilterClause(filter)

	query := fmt.Sprintf(
		`SELECT COUNT(*)
		 FROM video_lessons vl
		 WHERE vl.is_active = true%s`,
		filterClause,
	)

	var count int
	err := r.pool.QueryRow(ctx, query, filterArgs...).Scan(&count)
	return count, err
}

func buildVideoLessonFilterClause(filter repository.VideoLessonFilter) (string, []any) {
	clause := ""
	args := []any{}
	argIdx := 1

	if filter.Title != "" {
		clause += fmt.Sprintf(" AND vl.title ILIKE $%d", argIdx)
		args = append(args, "%"+filter.Title+"%")
		argIdx++
	}

	if len(filter.TopicIDs) > 0 {
		clause += fmt.Sprintf(" AND EXISTS (SELECT 1 FROM video_lesson_topics vlt WHERE vlt.video_lesson_id = vl.id AND vlt.topic_id IN (WITH RECURSIVE topic_tree AS (SELECT id FROM topics WHERE id = ANY($%d) UNION ALL SELECT t.id FROM topics t JOIN topic_tree tt ON t.parent_id = tt.id) SELECT id FROM topic_tree))", argIdx)
		args = append(args, filter.TopicIDs)
		argIdx++
	}

	return clause, args
}

func (r *VideoLessonRepository) loadTopics(ctx context.Context, vlID int) ([]entity.TopicRef, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT t.id, t.public_id, t.name
		 FROM video_lesson_topics vlt
		 JOIN topics t ON t.id = vlt.topic_id
		 WHERE vlt.video_lesson_id = $1 AND t.is_active = true
		 ORDER BY t.name ASC`,
		vlID,
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
