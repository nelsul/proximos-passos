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

type ExamRepository struct {
	pool *pgxpool.Pool
}

func NewExamRepository(pool *pgxpool.Pool) *ExamRepository {
	return &ExamRepository{pool: pool}
}

const examSelectFields = `
e.id, e.public_id, e.institution_id, e.title, e.description, e.year,
e.is_active, e.created_by_id, e.created_at, e.updated_at,
i.public_id, i.name, i.acronym`

const examFromJoin = `
FROM exams e
JOIN institutions i ON i.id = e.institution_id`

func scanExam(scanner interface{ Scan(dest ...any) error }) (*entity.Exam, error) {
	var ex entity.Exam
	err := scanner.Scan(
		&ex.ID, &ex.PublicID, &ex.InstitutionID, &ex.Title, &ex.Description, &ex.Year,
		&ex.IsActive, &ex.CreatedByID, &ex.CreatedAt, &ex.UpdatedAt,
		&ex.InstitutionPublicID, &ex.InstitutionName, &ex.InstitutionAcronym,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &ex, nil
}

func (r *ExamRepository) Create(ctx context.Context, exam *entity.Exam) error {
	return r.pool.QueryRow(ctx,
		`INSERT INTO exams (institution_id, title, description, year, created_by_id)
 VALUES ($1, $2, $3, $4, $5)
 RETURNING id, public_id, is_active, created_at, updated_at`,
		exam.InstitutionID, exam.Title, exam.Description, exam.Year, exam.CreatedByID,
	).Scan(&exam.ID, &exam.PublicID, &exam.IsActive, &exam.CreatedAt, &exam.UpdatedAt)
}

func (r *ExamRepository) GetByPublicID(ctx context.Context, publicID string) (*entity.Exam, error) {
	row := r.pool.QueryRow(ctx,
		`SELECT `+examSelectFields+examFromJoin+`
 WHERE e.public_id = $1 AND e.is_active = true`,
		publicID,
	)
	return scanExam(row)
}

func (r *ExamRepository) Update(ctx context.Context, exam *entity.Exam) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE exams
 SET institution_id = $1, title = $2, description = $3, year = $4, updated_at = NOW()
 WHERE public_id = $5 AND is_active = true`,
		exam.InstitutionID, exam.Title, exam.Description, exam.Year, exam.PublicID,
	)
	return err
}

func (r *ExamRepository) Delete(ctx context.Context, publicID string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE exams SET is_active = false, updated_at = NOW()
 WHERE public_id = $1 AND is_active = true`,
		publicID,
	)
	return err
}

func buildExamFilterClause(filter repository.ExamFilter, startIdx int) (string, []any) {
	clause := ""
	args := []any{}
	argIdx := startIdx

	if filter.InstitutionID != "" {
		clause += fmt.Sprintf(" AND i.public_id = $%d", argIdx)
		args = append(args, filter.InstitutionID)
		argIdx++
	}

	if filter.Year != nil {
		clause += fmt.Sprintf(" AND e.year = $%d", argIdx)
		args = append(args, *filter.Year)
		argIdx++
	}

	return clause, args
}

func (r *ExamRepository) List(ctx context.Context, limit, offset int, filter repository.ExamFilter) ([]entity.Exam, error) {
	filterClause, filterArgs := buildExamFilterClause(filter, 1)

	query := fmt.Sprintf(
		`SELECT %s %s
 WHERE e.is_active = true%s
 ORDER BY i.name ASC, e.year DESC, e.title ASC
 LIMIT $%d OFFSET $%d`,
		examSelectFields, examFromJoin, filterClause, len(filterArgs)+1, len(filterArgs)+2,
	)

	args := append(filterArgs, limit, offset)
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var exams []entity.Exam
	for rows.Next() {
		ex, err := scanExam(rows)
		if err != nil {
			return nil, err
		}
		exams = append(exams, *ex)
	}
	return exams, rows.Err()
}

func (r *ExamRepository) Count(ctx context.Context, filter repository.ExamFilter) (int, error) {
	filterClause, filterArgs := buildExamFilterClause(filter, 1)

	query := fmt.Sprintf(
		`SELECT COUNT(*) FROM exams e
 JOIN institutions i ON i.id = e.institution_id
 WHERE e.is_active = true%s`,
		filterClause,
	)

	var count int
	err := r.pool.QueryRow(ctx, query, filterArgs...).Scan(&count)
	return count, err
}
