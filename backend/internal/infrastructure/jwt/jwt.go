package jwt

import (
	"time"

	"proximos-passos/backend/internal/domain/entity"

	jwtlib "github.com/golang-jwt/jwt/v5"
)

const CookieName = "token"

type Claims struct {
	UserPublicID string          `json:"sub"`
	Name         string          `json:"name"`
	Email        string          `json:"email"`
	Role         entity.UserRole `json:"role"`
	jwtlib.RegisteredClaims
}

type VerificationClaims struct {
	UserPublicID string `json:"sub"`
	Purpose      string `json:"purpose"`
	jwtlib.RegisteredClaims
}

type Service struct {
	secret     []byte
	expiration time.Duration
}

func NewService(secret string, expiration time.Duration) *Service {
	return &Service{
		secret:     []byte(secret),
		expiration: expiration,
	}
}

func (s *Service) Generate(user *entity.User) (string, time.Time, error) {
	expiresAt := time.Now().Add(s.expiration)

	claims := Claims{
		UserPublicID: user.PublicID,
		Name:         user.Name,
		Email:        user.Email,
		Role:         user.Role,
		RegisteredClaims: jwtlib.RegisteredClaims{
			ExpiresAt: jwtlib.NewNumericDate(expiresAt),
			IssuedAt:  jwtlib.NewNumericDate(time.Now()),
		},
	}

	token := jwtlib.NewWithClaims(jwtlib.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.secret)
	if err != nil {
		return "", time.Time{}, err
	}

	return signed, expiresAt, nil
}

func (s *Service) Parse(tokenStr string) (*Claims, error) {
	token, err := jwtlib.ParseWithClaims(tokenStr, &Claims{}, func(t *jwtlib.Token) (any, error) {
		return s.secret, nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, jwtlib.ErrTokenInvalidClaims
	}

	return claims, nil
}

func (s *Service) GenerateVerificationToken(userPublicID string, expiration time.Duration) (string, error) {
	claims := VerificationClaims{
		UserPublicID: userPublicID,
		Purpose:      "email_verification",
		RegisteredClaims: jwtlib.RegisteredClaims{
			ExpiresAt: jwtlib.NewNumericDate(time.Now().Add(expiration)),
			IssuedAt:  jwtlib.NewNumericDate(time.Now()),
		},
	}

	token := jwtlib.NewWithClaims(jwtlib.SigningMethodHS256, claims)
	return token.SignedString(s.secret)
}

func (s *Service) ParseVerificationToken(tokenStr string) (*VerificationClaims, error) {
	token, err := jwtlib.ParseWithClaims(tokenStr, &VerificationClaims{}, func(t *jwtlib.Token) (any, error) {
		return s.secret, nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*VerificationClaims)
	if !ok || !token.Valid || claims.Purpose != "email_verification" {
		return nil, jwtlib.ErrTokenInvalidClaims
	}

	return claims, nil
}
