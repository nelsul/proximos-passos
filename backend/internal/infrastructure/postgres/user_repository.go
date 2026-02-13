package postgres

import (
	"context"
	"errors"
	"strings"

	"proximos-passos/backend/internal/domain/apperror"
	"proximos-passos/backend/internal/domain/entity"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UserRepository struct {
	pool *pgxpool.Pool
}

func NewUserRepository(pool *pgxpool.Pool) *UserRepository {
	return &UserRepository{pool: pool}
}

func (r *UserRepository) Create(ctx context.Context, user *entity.User) error {
	err := r.pool.QueryRow(ctx,
		`INSERT INTO users (name, email, password_hash, role)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, public_id, is_active, created_at, updated_at`,
		user.Name, user.Email, user.PasswordHash, user.Role,
	).Scan(&user.ID, &user.PublicID, &user.IsActive, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" && strings.Contains(pgErr.ConstraintName, "email") {
			return apperror.ErrEmailTaken
		}
		return err
	}

	return nil
}

func (r *UserRepository) GetByPublicID(ctx context.Context, publicID string) (*entity.User, error) {
	var user entity.User
	err := r.pool.QueryRow(ctx,
		`SELECT id, public_id, role, name, email, email_verified_at,
		        password_hash, avatar_url, is_active, created_at, updated_at
		 FROM users
		 WHERE public_id = $1 AND is_active = true`,
		publicID,
	).Scan(
		&user.ID, &user.PublicID, &user.Role, &user.Name, &user.Email,
		&user.EmailVerifiedAt, &user.PasswordHash, &user.AvatarURL,
		&user.IsActive, &user.CreatedAt, &user.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "22P02" {
			return nil, nil
		}
		return nil, err
	}

	return &user, nil
}

func (r *UserRepository) List(ctx context.Context, limit, offset int) ([]entity.User, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, public_id, role, name, email, email_verified_at,
		        password_hash, avatar_url, is_active, created_at, updated_at
		 FROM users
		 WHERE is_active = true
		 ORDER BY created_at DESC
		 LIMIT $1 OFFSET $2`,
		limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []entity.User
	for rows.Next() {
		var u entity.User
		if err := rows.Scan(
			&u.ID, &u.PublicID, &u.Role, &u.Name, &u.Email,
			&u.EmailVerifiedAt, &u.PasswordHash, &u.AvatarURL,
			&u.IsActive, &u.CreatedAt, &u.UpdatedAt,
		); err != nil {
			return nil, err
		}
		users = append(users, u)
	}

	return users, rows.Err()
}

func (r *UserRepository) Count(ctx context.Context) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE is_active = true`).Scan(&count)
	return count, err
}

func (r *UserRepository) Update(ctx context.Context, user *entity.User) error {
	result, err := r.pool.Exec(ctx,
		`UPDATE users
		 SET name = $1, email = $2, avatar_url = $3, role = $4
		 WHERE public_id = $5 AND is_active = true`,
		user.Name, user.Email, user.AvatarURL, user.Role, user.PublicID,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" && strings.Contains(pgErr.ConstraintName, "email") {
			return apperror.ErrEmailTaken
		}
		return err
	}

	if result.RowsAffected() == 0 {
		return apperror.ErrUserNotFound
	}

	return nil
}

func (r *UserRepository) Delete(ctx context.Context, publicID string) error {
	result, err := r.pool.Exec(ctx,
		`UPDATE users SET is_active = false WHERE public_id = $1 AND is_active = true`,
		publicID,
	)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return apperror.ErrUserNotFound
	}

	return nil
}
