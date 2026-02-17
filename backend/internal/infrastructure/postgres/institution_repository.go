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

type InstitutionRepository struct {
	pool *pgxpool.Pool
}

func NewInstitutionRepository(pool *pgxpool.Pool) *InstitutionRepository {
	return &InstitutionRepository{pool: pool}
}

func (r *InstitutionRepository) Create(ctx context.Context, institution *entity.Institution) error {
	return r.pool.QueryRow(ctx,
		`INSERT INTO institutions (name, acronym, created_by_id)
		 VALUES ($1, $2, $3)
		 RETURNING id, public_id, is_active, created_at, updated_at`,
		institution.Name, institution.Acronym, institution.CreatedByID,
	).Scan(&institution.ID, &institution.PublicID, &institution.IsActive, &institution.CreatedAt, &institution.UpdatedAt)
}

func (r *InstitutionRepository) GetByPublicID(ctx context.Context, publicID string) (*entity.Institution, error) {
	var i entity.Institution
	err := r.pool.QueryRow(ctx,
		`SELECT id, public_id, name, acronym, is_active, created_by_id, created_at, updated_at
		 FROM institutions
		 WHERE public_id = $1 AND is_active = true`,
		publicID,
	).Scan(&i.ID, &i.PublicID, &i.Name, &i.Acronym, &i.IsActive, &i.CreatedByID, &i.CreatedAt, &i.UpdatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &i, nil
}

func (r *InstitutionRepository) GetByID(ctx context.Context, id int) (*entity.Institution, error) {
	var i entity.Institution
	err := r.pool.QueryRow(ctx,
		`SELECT id, public_id, name, acronym, is_active, created_by_id, created_at, updated_at
		 FROM institutions
		 WHERE id = $1 AND is_active = true`,
		id,
	).Scan(&i.ID, &i.PublicID, &i.Name, &i.Acronym, &i.IsActive, &i.CreatedByID, &i.CreatedAt, &i.UpdatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &i, nil
}

func (r *InstitutionRepository) Update(ctx context.Context, institution *entity.Institution) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE institutions
		 SET name = $1, acronym = $2, updated_at = NOW()
		 WHERE public_id = $3 AND is_active = true`,
		institution.Name, institution.Acronym, institution.PublicID,
	)
	return err
}

func (r *InstitutionRepository) Delete(ctx context.Context, publicID string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE institutions SET is_active = false, updated_at = NOW()
		 WHERE public_id = $1 AND is_active = true`,
		publicID,
	)
	return err
}

func buildInstitutionFilterClause(filter repository.InstitutionFilter) (string, []any) {
	clause := ""
	args := []any{}
	argIdx := 1

	if filter.Name != "" {
		clause += fmt.Sprintf(" AND (i.name ILIKE $%d OR i.acronym ILIKE $%d)", argIdx, argIdx)
		args = append(args, "%"+filter.Name+"%")
		argIdx++
	}

	return clause, args
}

func (r *InstitutionRepository) List(ctx context.Context, limit, offset int, filter repository.InstitutionFilter) ([]entity.Institution, error) {
	filterClause, filterArgs := buildInstitutionFilterClause(filter)

	query := fmt.Sprintf(
		`SELECT id, public_id, name, acronym, is_active, created_by_id, created_at, updated_at
		 FROM institutions i
		 WHERE i.is_active = true%s
		 ORDER BY i.name ASC
		 LIMIT $%d OFFSET $%d`,
		filterClause, len(filterArgs)+1, len(filterArgs)+2,
	)

	args := append(filterArgs, limit, offset)
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var institutions []entity.Institution
	for rows.Next() {
		var i entity.Institution
		if err := rows.Scan(&i.ID, &i.PublicID, &i.Name, &i.Acronym, &i.IsActive, &i.CreatedByID, &i.CreatedAt, &i.UpdatedAt); err != nil {
			return nil, err
		}
		institutions = append(institutions, i)
	}
	return institutions, rows.Err()
}

func (r *InstitutionRepository) Count(ctx context.Context, filter repository.InstitutionFilter) (int, error) {
	filterClause, filterArgs := buildInstitutionFilterClause(filter)

	query := fmt.Sprintf(
		`SELECT COUNT(*)
		 FROM institutions i
		 WHERE i.is_active = true%s`,
		filterClause,
	)

	var count int
	err := r.pool.QueryRow(ctx, query, filterArgs...).Scan(&count)
	return count, err
}
