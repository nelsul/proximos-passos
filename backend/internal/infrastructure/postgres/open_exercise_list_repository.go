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

type OpenExerciseListRepository struct {
	pool *pgxpool.Pool
}

func NewOpenExerciseListRepository(pool *pgxpool.Pool) *OpenExerciseListRepository {
	return &OpenExerciseListRepository{pool: pool}
}

func (r *OpenExerciseListRepository) Create(ctx context.Context, oel *entity.OpenExerciseList, topicIDs []int) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// If we have a file to upload, insert file record first
	if oel.FileKey != "" {
		var fileID int
		var filePublicID string
		err = tx.QueryRow(ctx,
			`INSERT INTO files (key, filename, content_type, size_bytes, uploaded_by_id)
			 VALUES ($1, $2, $3, $4, $5)
			 RETURNING id, public_id`,
			oel.FileKey, oel.Filename, oel.ContentType, oel.SizeBytes, oel.CreatedByID,
		).Scan(&fileID, &filePublicID)
		if err != nil {
			return err
		}
		oel.FileID = &fileID
		oel.FilePublicID = filePublicID
	}

	// Insert the open exercise list record
	err = tx.QueryRow(ctx,
		`INSERT INTO open_exercise_lists (title, description, file_id, file_url, created_by_id)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, public_id, is_active, created_at, updated_at`,
		oel.Title, oel.Description, oel.FileID, oel.FileURL, oel.CreatedByID,
	).Scan(&oel.ID, &oel.PublicID, &oel.IsActive, &oel.CreatedAt, &oel.UpdatedAt)
	if err != nil {
		return err
	}

	// Insert topic associations
	for _, topicID := range topicIDs {
		_, err = tx.Exec(ctx,
			`INSERT INTO open_exercise_list_topics (open_exercise_list_id, topic_id) VALUES ($1, $2)`,
			oel.ID, topicID,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *OpenExerciseListRepository) GetByPublicID(ctx context.Context, publicID string) (*entity.OpenExerciseList, error) {
	var oel entity.OpenExerciseList
	var filePublicID, fileKey, filename, contentType *string
	var sizeBytes *int64
	err := r.pool.QueryRow(ctx,
		`SELECT oel.id, oel.public_id, oel.title, oel.description,
		        oel.file_id, oel.file_url,
		        oel.is_active, oel.created_by_id, oel.created_at, oel.updated_at,
		        f.public_id, f.key, f.filename, f.content_type, f.size_bytes
		 FROM open_exercise_lists oel
		 LEFT JOIN files f ON f.id = oel.file_id
		 WHERE oel.public_id = $1 AND oel.is_active = true`,
		publicID,
	).Scan(&oel.ID, &oel.PublicID, &oel.Title, &oel.Description,
		&oel.FileID, &oel.FileURL,
		&oel.IsActive, &oel.CreatedByID, &oel.CreatedAt, &oel.UpdatedAt,
		&filePublicID, &fileKey, &filename, &contentType, &sizeBytes)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	if filePublicID != nil {
		oel.FilePublicID = *filePublicID
		oel.FileKey = *fileKey
		oel.Filename = *filename
		oel.ContentType = *contentType
		oel.SizeBytes = *sizeBytes
	}

	topics, err := r.loadTopics(ctx, oel.ID)
	if err != nil {
		return nil, err
	}
	oel.Topics = topics

	return &oel, nil
}

func (r *OpenExerciseListRepository) Update(ctx context.Context, oel *entity.OpenExerciseList) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE open_exercise_lists
		 SET title = $1, description = $2, file_url = $3, updated_at = NOW()
		 WHERE public_id = $4 AND is_active = true`,
		oel.Title, oel.Description, oel.FileURL, oel.PublicID,
	)
	return err
}

func (r *OpenExerciseListRepository) ReplaceFile(ctx context.Context, oelID int, newFileID int) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE open_exercise_lists SET file_id = $1, updated_at = NOW() WHERE id = $2 AND is_active = true`,
		newFileID, oelID,
	)
	return err
}

func (r *OpenExerciseListRepository) CreateFileAndReplace(ctx context.Context, oelID int, oel *entity.OpenExerciseList, uploadedByID int) error {
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
		oel.FileKey, oel.Filename, oel.ContentType, oel.SizeBytes, uploadedByID,
	).Scan(&fileID)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx,
		`UPDATE open_exercise_lists SET file_id = $1, updated_at = NOW() WHERE id = $2 AND is_active = true`,
		fileID, oelID,
	)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *OpenExerciseListRepository) SetTopics(ctx context.Context, oelID int, topicIDs []int) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `DELETE FROM open_exercise_list_topics WHERE open_exercise_list_id = $1`, oelID)
	if err != nil {
		return err
	}

	for _, topicID := range topicIDs {
		_, err = tx.Exec(ctx,
			`INSERT INTO open_exercise_list_topics (open_exercise_list_id, topic_id) VALUES ($1, $2)`,
			oelID, topicID,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *OpenExerciseListRepository) Delete(ctx context.Context, publicID string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE open_exercise_lists SET is_active = false, updated_at = NOW()
		 WHERE public_id = $1 AND is_active = true`,
		publicID,
	)
	return err
}

func (r *OpenExerciseListRepository) List(ctx context.Context, limit, offset int, filter repository.OpenExerciseListFilter) ([]entity.OpenExerciseList, error) {
	filterClause, filterArgs := buildOpenExerciseListFilterClause(filter)

	query := fmt.Sprintf(
		`SELECT oel.id, oel.public_id, oel.title, oel.description,
		        oel.file_id, oel.file_url,
		        oel.is_active, oel.created_by_id, oel.created_at, oel.updated_at,
		        f.public_id, f.key, f.filename, f.content_type, f.size_bytes
		 FROM open_exercise_lists oel
		 LEFT JOIN files f ON f.id = oel.file_id
		 WHERE oel.is_active = true%s
		 ORDER BY oel.created_at DESC
		 LIMIT $%d OFFSET $%d`,
		filterClause, len(filterArgs)+1, len(filterArgs)+2,
	)

	args := append(filterArgs, limit, offset)
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var lists []entity.OpenExerciseList
	for rows.Next() {
		var oel entity.OpenExerciseList
		var filePublicID, fileKey, filename, contentType *string
		var sizeBytes *int64
		if err := rows.Scan(&oel.ID, &oel.PublicID, &oel.Title, &oel.Description,
			&oel.FileID, &oel.FileURL,
			&oel.IsActive, &oel.CreatedByID, &oel.CreatedAt, &oel.UpdatedAt,
			&filePublicID, &fileKey, &filename, &contentType, &sizeBytes); err != nil {
			return nil, err
		}
		if filePublicID != nil {
			oel.FilePublicID = *filePublicID
			oel.FileKey = *fileKey
			oel.Filename = *filename
			oel.ContentType = *contentType
			oel.SizeBytes = *sizeBytes
		}
		lists = append(lists, oel)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Load topics for each list
	for i := range lists {
		topics, err := r.loadTopics(ctx, lists[i].ID)
		if err != nil {
			return nil, err
		}
		lists[i].Topics = topics
	}

	return lists, nil
}

func (r *OpenExerciseListRepository) Count(ctx context.Context, filter repository.OpenExerciseListFilter) (int, error) {
	filterClause, filterArgs := buildOpenExerciseListFilterClause(filter)

	query := fmt.Sprintf(
		`SELECT COUNT(*)
		 FROM open_exercise_lists oel
		 WHERE oel.is_active = true%s`,
		filterClause,
	)

	var count int
	err := r.pool.QueryRow(ctx, query, filterArgs...).Scan(&count)
	return count, err
}

func buildOpenExerciseListFilterClause(filter repository.OpenExerciseListFilter) (string, []any) {
	clause := ""
	args := []any{}
	argIdx := 1

	if filter.Title != "" {
		clause += fmt.Sprintf(" AND oel.title ILIKE $%d", argIdx)
		args = append(args, "%"+filter.Title+"%")
		argIdx++
	}

	if filter.TopicID != nil {
		clause += fmt.Sprintf(" AND EXISTS (SELECT 1 FROM open_exercise_list_topics oelt WHERE oelt.open_exercise_list_id = oel.id AND oelt.topic_id = $%d)", argIdx)
		args = append(args, *filter.TopicID)
		argIdx++
	}

	return clause, args
}

func (r *OpenExerciseListRepository) loadTopics(ctx context.Context, oelID int) ([]entity.TopicRef, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT t.id, t.public_id, t.name
		 FROM open_exercise_list_topics oelt
		 JOIN topics t ON t.id = oelt.topic_id
		 WHERE oelt.open_exercise_list_id = $1 AND t.is_active = true
		 ORDER BY t.name ASC`,
		oelID,
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
