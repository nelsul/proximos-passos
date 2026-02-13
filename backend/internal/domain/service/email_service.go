package service

import "context"

type EmailService interface {
	SendVerificationEmail(ctx context.Context, to, name, verificationURL string) error
}
