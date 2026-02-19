package apperror

import "net/http"

type Code string

const (
	CodeInvalidInput               Code = "INVALID_INPUT"
	CodeInvalidBody                Code = "INVALID_REQUEST_BODY"
	CodeNotFound                   Code = "RESOURCE_NOT_FOUND"
	CodeInternalError              Code = "INTERNAL_ERROR"
	CodeEmailTaken                 Code = "USER_EMAIL_ALREADY_EXISTS"
	CodeUserNotFound               Code = "USER_NOT_FOUND"
	CodeInvalidCredentials         Code = "INVALID_CREDENTIALS"
	CodeUnauthorized               Code = "UNAUTHORIZED"
	CodeForbidden                  Code = "FORBIDDEN"
	CodeInvalidToken               Code = "INVALID_VERIFICATION_TOKEN"
	CodeEmailAlreadyVerified       Code = "EMAIL_ALREADY_VERIFIED"
	CodeEmailSendFailed            Code = "EMAIL_SEND_FAILED"
	CodeInvalidFileType            Code = "INVALID_FILE_TYPE"
	CodeFileTooLarge               Code = "FILE_TOO_LARGE"
	CodeUploadFailed               Code = "UPLOAD_FAILED"
	CodeGroupNotFound              Code = "GROUP_NOT_FOUND"
	CodeMemberNotFound             Code = "MEMBER_NOT_FOUND"
	CodeMemberAlreadyExists        Code = "MEMBER_ALREADY_EXISTS"
	CodeSetupUnavailable           Code = "SETUP_UNAVAILABLE"
	CodeVerificationCooldown       Code = "VERIFICATION_COOLDOWN"
	CodeEmailNotVerified           Code = "EMAIL_NOT_VERIFIED"
	CodeActivityNotFound           Code = "ACTIVITY_NOT_FOUND"
	CodeAttachmentNotFound         Code = "ATTACHMENT_NOT_FOUND"
	CodeActivityTitleTaken         Code = "ACTIVITY_TITLE_TAKEN"
	CodeTopicNotFound              Code = "TOPIC_NOT_FOUND"
	CodeTopicNameTaken             Code = "TOPIC_NAME_TAKEN"
	CodeTopicHasChildren           Code = "TOPIC_HAS_CHILDREN"
	CodeHandoutNotFound            Code = "HANDOUT_NOT_FOUND"
	CodeHandoutTitleTaken          Code = "HANDOUT_TITLE_TAKEN"
	CodeVideoLessonNotFound        Code = "VIDEO_LESSON_NOT_FOUND"
	CodeVideoLessonTitleTaken      Code = "VIDEO_LESSON_TITLE_TAKEN"
	CodeOpenExerciseListNotFound   Code = "OPEN_EXERCISE_LIST_NOT_FOUND"
	CodeOpenExerciseListTitleTaken Code = "OPEN_EXERCISE_LIST_TITLE_TAKEN"
	CodeQuestionNotFound           Code = "QUESTION_NOT_FOUND"
	CodeInstitutionNotFound        Code = "INSTITUTION_NOT_FOUND"
	CodeInstitutionNameTaken       Code = "INSTITUTION_NAME_TAKEN"
	CodeExamNotFound               Code = "EXAM_NOT_FOUND"
	CodeExamDuplicate              Code = "EXAM_DUPLICATE"
	CodeActivityItemNotFound       Code = "ACTIVITY_ITEM_NOT_FOUND"
	CodeQuestionSubmissionNotFound Code = "QUESTION_SUBMISSION_NOT_FOUND"
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
	ErrInvalidInput               = New(CodeInvalidInput, "The provided input is invalid.", http.StatusBadRequest)
	ErrInvalidBody                = New(CodeInvalidBody, "The request body could not be parsed.", http.StatusBadRequest)
	ErrInternalError              = New(CodeInternalError, "An unexpected error occurred.", http.StatusInternalServerError)
	ErrUserNotFound               = New(CodeUserNotFound, "The requested user was not found.", http.StatusNotFound)
	ErrEmailTaken                 = New(CodeEmailTaken, "The provided email is already registered.", http.StatusConflict)
	ErrInvalidCredentials         = New(CodeInvalidCredentials, "Invalid email or password.", http.StatusUnauthorized)
	ErrUnauthorized               = New(CodeUnauthorized, "Authentication is required.", http.StatusUnauthorized)
	ErrForbidden                  = New(CodeForbidden, "You do not have permission to perform this action.", http.StatusForbidden)
	ErrInvalidToken               = New(CodeInvalidToken, "The verification token is invalid or expired.", http.StatusBadRequest)
	ErrEmailAlreadyVerified       = New(CodeEmailAlreadyVerified, "This email has already been verified.", http.StatusConflict)
	ErrEmailSendFailed            = New(CodeEmailSendFailed, "Failed to send the verification email.", http.StatusInternalServerError)
	ErrInvalidFileType            = New(CodeInvalidFileType, "The file type is not allowed.", http.StatusBadRequest)
	ErrFileTooLarge               = New(CodeFileTooLarge, "The file exceeds the maximum allowed size.", http.StatusBadRequest)
	ErrUploadFailed               = New(CodeUploadFailed, "Failed to upload the file.", http.StatusInternalServerError)
	ErrGroupNotFound              = New(CodeGroupNotFound, "The requested group was not found.", http.StatusNotFound)
	ErrMemberNotFound             = New(CodeMemberNotFound, "The requested member was not found.", http.StatusNotFound)
	ErrMemberAlreadyExists        = New(CodeMemberAlreadyExists, "The user is already a member of this group.", http.StatusConflict)
	ErrSetupUnavailable           = New(CodeSetupUnavailable, "Initial setup is no longer available.", http.StatusConflict)
	ErrVerificationCooldown       = New(CodeVerificationCooldown, "Please wait before requesting another verification email.", http.StatusTooManyRequests)
	ErrEmailNotVerified           = New(CodeEmailNotVerified, "Please verify your email before logging in.", http.StatusForbidden)
	ErrActivityNotFound           = New(CodeActivityNotFound, "The requested activity was not found.", http.StatusNotFound)
	ErrAttachmentNotFound         = New(CodeAttachmentNotFound, "The requested attachment was not found.", http.StatusNotFound)
	ErrActivityTitleTaken         = New(CodeActivityTitleTaken, "An activity with this title already exists in the group.", http.StatusConflict)
	ErrTopicNotFound              = New(CodeTopicNotFound, "The requested topic was not found.", http.StatusNotFound)
	ErrTopicNameTaken             = New(CodeTopicNameTaken, "A topic with this name already exists under the same parent.", http.StatusConflict)
	ErrTopicHasChildren           = New(CodeTopicHasChildren, "Cannot delete a topic that has child topics.", http.StatusConflict)
	ErrHandoutNotFound            = New(CodeHandoutNotFound, "The requested handout was not found.", http.StatusNotFound)
	ErrHandoutTitleTaken          = New(CodeHandoutTitleTaken, "A handout with this title already exists.", http.StatusConflict)
	ErrVideoLessonNotFound        = New(CodeVideoLessonNotFound, "The requested video lesson was not found.", http.StatusNotFound)
	ErrVideoLessonTitleTaken      = New(CodeVideoLessonTitleTaken, "A video lesson with this title already exists.", http.StatusConflict)
	ErrOpenExerciseListNotFound   = New(CodeOpenExerciseListNotFound, "The requested exercise list was not found.", http.StatusNotFound)
	ErrOpenExerciseListTitleTaken = New(CodeOpenExerciseListTitleTaken, "An exercise list with this title already exists.", http.StatusConflict)
	ErrQuestionNotFound           = New(CodeQuestionNotFound, "The requested question was not found.", http.StatusNotFound)
	ErrInstitutionNotFound        = New(CodeInstitutionNotFound, "The requested institution was not found.", http.StatusNotFound)
	ErrInstitutionNameTaken       = New(CodeInstitutionNameTaken, "An institution with this name or acronym already exists.", http.StatusConflict)
	ErrExamNotFound               = New(CodeExamNotFound, "The requested exam was not found.", http.StatusNotFound)
	ErrExamDuplicate              = New(CodeExamDuplicate, "An exam with this institution, year, and stage already exists.", http.StatusConflict)
	ErrActivityItemNotFound       = New(CodeActivityItemNotFound, "The requested activity item was not found.", http.StatusNotFound)
	ErrQuestionSubmissionNotFound = New(CodeQuestionSubmissionNotFound, "The requested submission was not found.", http.StatusNotFound)
)
