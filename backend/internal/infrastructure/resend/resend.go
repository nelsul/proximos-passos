package resend

import (
	"context"
	"fmt"

	resendlib "github.com/resend/resend-go/v2"
)

type EmailService struct {
	client      *resendlib.Client
	from        string
	logoFullURL string
}

func NewEmailService(apiKey, fromEmail, logoFullURL string) *EmailService {
	return &EmailService{
		client:      resendlib.NewClient(apiKey),
		from:        fromEmail,
		logoFullURL: logoFullURL,
	}
}

func (s *EmailService) SendVerificationEmail(ctx context.Context, to, name, verificationURL string) error {
	subject := "Verifique seu email - Próximos Passos"

	html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f6f9f6; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
<div style="width: 100%%; max-width: 600px; margin: 32px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden;">

  <div style="background-color: #ffffff; padding: 32px 0; text-align: center; border-bottom: 3px solid #cfa156;">
    <img src="%s" alt="Próximos Passos" width="200" style="display: block; margin: 0 auto; border: 0;" />
  </div>

  <div style="padding: 40px 32px;">
    <h1 style="font-family: Georgia, 'Times New Roman', serif; color: #0f2e2e; font-size: 24px; margin: 0 0 16px 0;">
      Olá, %s!
    </h1>
    <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
      Sua conta foi criada na plataforma <strong style="color: #0f2e2e;">Próximos Passos</strong>.
    </p>
    <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;">
      Clique no botão abaixo para verificar seu email:
    </p>
    <div style="text-align: center; margin: 0 0 32px 0;">
      <a href="%s" style="display: inline-block; padding: 12px 24px; background-color: #cfa156; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px;">
        Verificar Email
      </a>
    </div>
    <p style="color: #333333; font-size: 14px; line-height: 1.6; margin: 0;">
      Se você não reconhece esta ação, ignore este email.
    </p>
  </div>

  <div style="background-color: #0f2e2e; padding: 24px 32px; text-align: center;">
    <p style="color: #88aaaa; font-size: 13px; line-height: 1.5; margin: 0;">
      &copy; 2026 Próximos Passos. Todos os direitos reservados.
    </p>
  </div>

</div>
</body>
</html>`, s.logoFullURL, name, verificationURL)

	_, err := s.client.Emails.SendWithContext(ctx, &resendlib.SendEmailRequest{
		From:    s.from,
		To:      []string{to},
		Subject: subject,
		Html:    html,
	})

	return err
}
