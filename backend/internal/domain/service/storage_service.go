package service

import (
	"context"
	"io"
)

type StorageService interface {
	Upload(ctx context.Context, key, contentType string, body io.Reader) (string, error)
	Delete(ctx context.Context, key string) error
	GetPublicURL(key string) string
}
