package apperror

import "net/http"

type Code string

const (
	CodeInvalidInput         Code = "INVALID_INPUT"
	CodeInvalidBody          Code = "INVALID_REQUEST_BODY"
	CodeNotFound             Code = "RESOURCE_NOT_FOUND"
	CodeInternalError        Code = "INTERNAL_ERROR"
	CodeEmailTaken           Code = "USER_EMAIL_ALREADY_EXISTS"
	CodeUserNotFound         Code = "USER_NOT_FOUND"
	CodeInvalidCredentials   Code = "INVALID_CREDENTIALS"
	CodeUnauthorized         Code = "UNAUTHORIZED"
	CodeForbidden            Code = "FORBIDDEN"
	CodeInvalidToken         Code = "INVALID_VERIFICATION_TOKEN"
	CodeEmailAlreadyVerified Code = "EMAIL_ALREADY_VERIFIED"
	CodeEmailSendFailed      Code = "EMAIL_SEND_FAILED"
	CodeInvalidFileType      Code = "INVALID_FILE_TYPE"
	CodeFileTooLarge         Code = "FILE_TOO_LARGE"
	CodeUploadFailed         Code = "UPLOAD_FAILED"
	CodeGroupNotFound        Code = "GROUP_NOT_FOUND"
	CodeMemberNotFound       Code = "MEMBER_NOT_FOUND"
	CodeMemberAlreadyExists  Code = "MEMBER_ALREADY_EXISTS"
)

type AppError struct {
	Code       Code   `json:"code"`
	Message    string `json:"message"`
	Details    any    `json:"details"`
	HTTPStatus int    `json:"-"`
}

func (e *AppError) Error() string {
	return e.Message
}

func New(code Code, message string, httpStatus int) *AppError {
	return &AppError{
		Code:       code,
		Message:    message,
		HTTPStatus: httpStatus,
	}
}

func WithDetails(code Code, message string, httpStatus int, details any) *AppError {
	return &AppError{
		Code:       code,
		Message:    message,
		Details:    details,
		HTTPStatus: httpStatus,
	}
}

var (
	ErrInvalidInput         = New(CodeInvalidInput, "The provided input is invalid.", http.StatusBadRequest)
	ErrInvalidBody          = New(CodeInvalidBody, "The request body could not be parsed.", http.StatusBadRequest)
	ErrInternalError        = New(CodeInternalError, "An unexpected error occurred.", http.StatusInternalServerError)
	ErrUserNotFound         = New(CodeUserNotFound, "The requested user was not found.", http.StatusNotFound)
	ErrEmailTaken           = New(CodeEmailTaken, "The provided email is already registered.", http.StatusConflict)
	ErrInvalidCredentials   = New(CodeInvalidCredentials, "Invalid email or password.", http.StatusUnauthorized)
	ErrUnauthorized         = New(CodeUnauthorized, "Authentication is required.", http.StatusUnauthorized)
	ErrForbidden            = New(CodeForbidden, "You do not have permission to perform this action.", http.StatusForbidden)
	ErrInvalidToken         = New(CodeInvalidToken, "The verification token is invalid or expired.", http.StatusBadRequest)
	ErrEmailAlreadyVerified = New(CodeEmailAlreadyVerified, "This email has already been verified.", http.StatusConflict)
	ErrEmailSendFailed      = New(CodeEmailSendFailed, "Failed to send the verification email.", http.StatusInternalServerError)
	ErrInvalidFileType      = New(CodeInvalidFileType, "The file type is not allowed.", http.StatusBadRequest)
	ErrFileTooLarge         = New(CodeFileTooLarge, "The file exceeds the maximum allowed size.", http.StatusBadRequest)
	ErrUploadFailed         = New(CodeUploadFailed, "Failed to upload the file.", http.StatusInternalServerError)
	ErrGroupNotFound        = New(CodeGroupNotFound, "The requested group was not found.", http.StatusNotFound)
	ErrMemberNotFound       = New(CodeMemberNotFound, "The requested member was not found.", http.StatusNotFound)
	ErrMemberAlreadyExists  = New(CodeMemberAlreadyExists, "The user is already a member of this group.", http.StatusConflict)
)
