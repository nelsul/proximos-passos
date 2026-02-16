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

type TopicRepository struct {
	pool *pgxpool.Pool
}

func NewTopicRepository(pool *pgxpool.Pool) *TopicRepository {
	return &TopicRepository{pool: pool}
}

func (r *TopicRepository) Create(ctx context.Context, topic *entity.Topic) error {
	return r.pool.QueryRow(ctx,
		`INSERT INTO topics (parent_id, name, description, created_by_id)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, public_id, is_active, created_at, updated_at`,
		topic.ParentID, topic.Name, topic.Description, topic.CreatedByID,
	).Scan(&topic.ID, &topic.PublicID, &topic.IsActive, &topic.CreatedAt, &topic.UpdatedAt)
}

func (r *TopicRepository) GetByPublicID(ctx context.Context, publicID string) (*entity.Topic, error) {
	var t entity.Topic
	err := r.pool.QueryRow(ctx,
		`SELECT t.id, t.public_id, t.parent_id, t.name, t.description,
		        t.is_active, t.created_by_id, t.created_at, t.updated_at,
		        p.public_id
		 FROM topics t
		 LEFT JOIN topics p ON p.id = t.parent_id
		 WHERE t.public_id = $1 AND t.is_active = true`,
		publicID,
	).Scan(&t.ID, &t.PublicID, &t.ParentID, &t.Name, &t.Description,
		&t.IsActive, &t.CreatedByID, &t.CreatedAt, &t.UpdatedAt,
		&t.ParentPublicID)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &t, nil
}

func (r *TopicRepository) GetByID(ctx context.Context, id int) (*entity.Topic, error) {
	var t entity.Topic
	err := r.pool.QueryRow(ctx,
		`SELECT t.id, t.public_id, t.parent_id, t.name, t.description,
		        t.is_active, t.created_by_id, t.created_at, t.updated_at,
		        p.public_id
		 FROM topics t
		 LEFT JOIN topics p ON p.id = t.parent_id
		 WHERE t.id = $1 AND t.is_active = true`,
		id,
	).Scan(&t.ID, &t.PublicID, &t.ParentID, &t.Name, &t.Description,
		&t.IsActive, &t.CreatedByID, &t.CreatedAt, &t.UpdatedAt,
		&t.ParentPublicID)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &t, nil
}

func (r *TopicRepository) Update(ctx context.Context, topic *entity.Topic) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE topics
		 SET parent_id = $1, name = $2, description = $3, updated_at = NOW()
		 WHERE public_id = $4 AND is_active = true`,
		topic.ParentID, topic.Name, topic.Description, topic.PublicID,
	)
	return err
}

func (r *TopicRepository) Delete(ctx context.Context, publicID string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE topics SET is_active = false, updated_at = NOW()
		 WHERE public_id = $1 AND is_active = true`,
		publicID,
	)
	return err
}

func (r *TopicRepository) DeleteCascade(ctx context.Context, id int) error {
	_, err := r.pool.Exec(ctx,
		`WITH RECURSIVE descendants AS (
			SELECT id FROM topics WHERE id = $1
			UNION ALL
			SELECT t.id FROM topics t JOIN descendants d ON t.parent_id = d.id WHERE t.is_active = true
		 )
		 UPDATE topics SET is_active = false, updated_at = NOW()
		 WHERE id IN (SELECT id FROM descendants) AND is_active = true`,
		id,
	)
	return err
}

func (r *TopicRepository) ReparentChildren(ctx context.Context, parentID int, newParentID *int) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE topics SET parent_id = $1, updated_at = NOW()
		 WHERE parent_id = $2 AND is_active = true`,
		newParentID, parentID,
	)
	return err
}

func buildTopicFilterClause(filter repository.TopicFilter) (string, []any) {
	clause := ""
	args := []any{}
	argIdx := 1

	if filter.Name != "" {
		clause += fmt.Sprintf(" AND t.name ILIKE $%d", argIdx)
		args = append(args, "%"+filter.Name+"%")
		argIdx++
	}

	if filter.ParentID != nil {
		if *filter.ParentID == "" {
			clause += " AND t.parent_id IS NULL"
		} else {
			clause += fmt.Sprintf(" AND p2.public_id = $%d", argIdx)
			args = append(args, *filter.ParentID)
			argIdx++
		}
	}

	return clause, args
}

func (r *TopicRepository) List(ctx context.Context, limit, offset int, filter repository.TopicFilter) ([]entity.Topic, error) {
	filterClause, filterArgs := buildTopicFilterClause(filter)

	needsParentJoin := filter.ParentID != nil && *filter.ParentID != ""
	parentJoin := ""
	if needsParentJoin {
		parentJoin = " JOIN topics p2 ON p2.id = t.parent_id"
	}

	query := fmt.Sprintf(
		`SELECT t.id, t.public_id, t.parent_id, t.name, t.description,
		        t.is_active, t.created_by_id, t.created_at, t.updated_at,
		        p.public_id
		 FROM topics t
		 LEFT JOIN topics p ON p.id = t.parent_id
		 %s
		 WHERE t.is_active = true%s
		 ORDER BY t.name ASC
		 LIMIT $%d OFFSET $%d`,
		parentJoin, filterClause, len(filterArgs)+1, len(filterArgs)+2,
	)

	args := append(filterArgs, limit, offset)
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var topics []entity.Topic
	for rows.Next() {
		var t entity.Topic
		if err := rows.Scan(&t.ID, &t.PublicID, &t.ParentID, &t.Name, &t.Description,
			&t.IsActive, &t.CreatedByID, &t.CreatedAt, &t.UpdatedAt,
			&t.ParentPublicID); err != nil {
			return nil, err
		}
		topics = append(topics, t)
	}
	return topics, rows.Err()
}

func (r *TopicRepository) Count(ctx context.Context, filter repository.TopicFilter) (int, error) {
	filterClause, filterArgs := buildTopicFilterClause(filter)

	needsParentJoin := filter.ParentID != nil && *filter.ParentID != ""
	parentJoin := ""
	if needsParentJoin {
		parentJoin = " JOIN topics p2 ON p2.id = t.parent_id"
	}

	query := fmt.Sprintf(
		`SELECT COUNT(*)
		 FROM topics t
		 %s
		 WHERE t.is_active = true%s`,
		parentJoin, filterClause,
	)

	var count int
	err := r.pool.QueryRow(ctx, query, filterArgs...).Scan(&count)
	return count, err
}
