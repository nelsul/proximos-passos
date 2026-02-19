package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"proximos-passos/backend/internal/adapter/dto"
	"proximos-passos/backend/internal/adapter/middleware"
	"proximos-passos/backend/internal/adapter/response"
	"proximos-passos/backend/internal/domain/apperror"
	"proximos-passos/backend/internal/domain/repository"
	"proximos-passos/backend/internal/usecase"
)

type QuestionHandler struct {
	uc *usecase.QuestionUseCase
}

func NewQuestionHandler(uc *usecase.QuestionUseCase) *QuestionHandler {
	return &QuestionHandler{uc: uc}
}

func (h *QuestionHandler) RegisterRoutes(mux *http.ServeMux, adminMW, authMW func(http.Handler) http.Handler) {
	mux.Handle("POST /questions", adminMW(http.HandlerFunc(h.Create)))
	mux.Handle("GET /questions", authMW(http.HandlerFunc(h.List)))
	mux.Handle("GET /questions/{id}", authMW(http.HandlerFunc(h.GetByID)))
	mux.Handle("PUT /questions/{id}", adminMW(http.HandlerFunc(h.Update)))
	mux.Handle("POST /questions/{id}/images", adminMW(http.HandlerFunc(h.AddImages)))
	mux.Handle("DELETE /questions/{id}/images/{imageId}", adminMW(http.HandlerFunc(h.RemoveImage)))
	mux.Handle("DELETE /questions/{id}", adminMW(http.HandlerFunc(h.Delete)))
}

// Create godoc
// @Summary     Create a question
// @Description Creates a new question with optional image uploads (admin only)
// @Tags        questions
// @Accept      multipart/form-data
// @Produce     json
// @Security    CookieAuth
// @Param       type                formData string   true  "Question type (open_ended or closed_ended)"
// @Param       statement           formData string   true  "Question statement"
// @Param       expected_answer_text formData string  false "Expected answer text"
// @Param       passing_score       formData int      false "Passing score (0-100)"
// @Param       exam_id             formData string   false "Exam public ID"
// @Param       topic_ids           formData []string false "Topic public IDs"
// @Param       images              formData file     false "Image files"
// @Success     201 {object} dto.QuestionResponse
// @Failure     400 {object} apperror.AppError
// @Failure     401 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Failure     500 {object} apperror.AppError
// @Router      /questions [post]
func (h *QuestionHandler) Create(w http.ResponseWriter, r *http.Request) {
	userPublicID := middleware.UserPublicID(r.Context())

	if err := r.ParseMultipartForm(50 << 20); err != nil {
		response.Error(w, apperror.ErrFileTooLarge)
		return
	}

	qType := r.FormValue("type")
	statement := r.FormValue("statement")

	var expectedAnswerText *string
	if eat := r.FormValue("expected_answer_text"); eat != "" {
		expectedAnswerText = &eat
	}

	var passingScore *int
	if ps := r.FormValue("passing_score"); ps != "" {
		v, err := strconv.Atoi(ps)
		if err == nil {
			passingScore = &v
		}
	}

	examPublicID := r.FormValue("exam_id")
	topicIDs := r.Form["topic_ids"]
	imageFiles := r.MultipartForm.File["images"]

	// Parse options from form data
	var optionInputs []usecase.OptionInput
	for i := 0; ; i++ {
		text := r.FormValue(fmt.Sprintf("options[%d][text]", i))
		if text == "" {
			// Also try simple repeated field format
			break
		}
		isCorrect := r.FormValue(fmt.Sprintf("options[%d][is_correct]", i))
		textVal := strings.TrimSpace(text)
		oi := usecase.OptionInput{
			Text:      &textVal,
			IsCorrect: isCorrect == "true",
		}
		// Check for option image files
		optImgKey := fmt.Sprintf("option_images[%d]", i)
		if optImgFiles, ok := r.MultipartForm.File[optImgKey]; ok && len(optImgFiles) > 0 {
			oi.ImageFiles = optImgFiles
		}
		optionInputs = append(optionInputs, oi)
	}

	// Also try JSON-encoded options field
	if len(optionInputs) == 0 {
		if optionsJSON := r.FormValue("options"); optionsJSON != "" {
			var opts []dto.QuestionOptionInput
			if err := json.Unmarshal([]byte(optionsJSON), &opts); err == nil {
				for idx, o := range opts {
					oi := usecase.OptionInput{
						Text:      o.Text,
						IsCorrect: o.IsCorrect,
					}
					// Check for option image files
					optImgKey := fmt.Sprintf("option_images[%d]", idx)
					if optImgFiles, ok := r.MultipartForm.File[optImgKey]; ok && len(optImgFiles) > 0 {
						oi.ImageFiles = optImgFiles
					}
					optionInputs = append(optionInputs, oi)
				}
			}
		}
	}

	q, createErr := h.uc.Create(
		r.Context(),
		userPublicID,
		qType,
		statement,
		expectedAnswerText,
		passingScore,
		examPublicID,
		topicIDs,
		imageFiles,
		optionInputs,
	)
	if createErr != nil {
		response.Error(w, createErr)
		return
	}

	response.JSON(w, http.StatusCreated, dto.QuestionToResponse(q))
}

// List godoc
// @Summary     List questions
// @Description Returns a paginated list of questions (admin only)
// @Tags        questions
// @Produce     json
// @Security    CookieAuth
// @Param       page_number query int    false "Page number" default(1)
// @Param       page_size   query int    false "Page size"   default(20)
// @Param       statement   query string false "Filter by statement (partial match)"
// @Param       type        query string false "Filter by type (open_ended or closed_ended)"
// @Param       topic_id    query string false "Filter by topic public ID (UUID)"
// @Param       exam_id     query string false "Filter by exam public ID (UUID)"
// @Success     200 {object} dto.QuestionListResponse
// @Failure     401 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Failure     500 {object} apperror.AppError
// @Router      /questions [get]
func (h *QuestionHandler) List(w http.ResponseWriter, r *http.Request) {
	pageNumber, _ := strconv.Atoi(r.URL.Query().Get("page_number"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	filter := repository.QuestionFilter{
		Statement: r.URL.Query().Get("statement"),
		Type:      r.URL.Query().Get("type"),
	}

	if topicPublicID := r.URL.Query().Get("topic_id"); topicPublicID != "" {
		topicID, resolveErr := h.uc.ResolveTopicID(r.Context(), topicPublicID)
		if resolveErr != nil {
			response.Error(w, resolveErr)
			return
		}
		filter.TopicID = &topicID
	}

	if examPublicID := r.URL.Query().Get("exam_id"); examPublicID != "" {
		examID, resolveErr := h.uc.ResolveExamID(r.Context(), examPublicID)
		if resolveErr != nil {
			response.Error(w, resolveErr)
			return
		}
		filter.ExamID = &examID
	}

	if institutionPublicID := r.URL.Query().Get("institution_id"); institutionPublicID != "" {
		institutionID, resolveErr := h.uc.ResolveInstitutionID(r.Context(), institutionPublicID)
		if resolveErr != nil {
			response.Error(w, resolveErr)
			return
		}
		filter.InstitutionID = &institutionID
	}

	questions, totalItems, totalPages, err := h.uc.List(r.Context(), pageNumber, pageSize, filter)
	if err != nil {
		response.Error(w, err)
		return
	}

	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	if pageNumber < 1 {
		pageNumber = 1
	}

	response.JSON(w, http.StatusOK, dto.QuestionListResponse{
		Data:       dto.QuestionsToResponse(questions),
		PageNumber: pageNumber,
		PageSize:   pageSize,
		TotalItems: totalItems,
		TotalPages: totalPages,
	})
}

// GetByID godoc
// @Summary     Get a question
// @Description Returns a question by its public ID (admin only)
// @Tags        questions
// @Produce     json
// @Security    CookieAuth
// @Param       id path string true "Question public ID (UUID)"
// @Success     200 {object} dto.QuestionResponse
// @Failure     401 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Failure     404 {object} apperror.AppError
// @Failure     500 {object} apperror.AppError
// @Router      /questions/{id} [get]
func (h *QuestionHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")

	q, err := h.uc.GetByPublicID(r.Context(), publicID)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.QuestionToResponse(q))
}

// Update godoc
// @Summary     Update a question
// @Description Updates question fields by public ID (admin only)
// @Tags        questions
// @Accept      multipart/form-data
// @Produce     json
// @Security    CookieAuth
// @Param       id   path     string true "Question public ID (UUID)"
// @Success     200  {object} dto.QuestionResponse
// @Failure     400  {object} apperror.AppError
// @Failure     401  {object} apperror.AppError
// @Failure     403  {object} apperror.AppError
// @Failure     404  {object} apperror.AppError
// @Failure     500  {object} apperror.AppError
// @Router      /questions/{id} [put]
func (h *QuestionHandler) Update(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")

	contentType := r.Header.Get("Content-Type")

	var input usecase.UpdateQuestionInput

	if strings.HasPrefix(contentType, "multipart/form-data") {
		if err := r.ParseMultipartForm(50 << 20); err != nil {
			response.Error(w, apperror.ErrFileTooLarge)
			return
		}

		if v := r.FormValue("type"); v != "" {
			input.Type = &v
		}
		if v := r.FormValue("statement"); v != "" {
			input.Statement = &v
		}
		if v := r.FormValue("expected_answer_text"); v != "" {
			input.ExpectedAnswerText = &v
		}
		if v := r.FormValue("passing_score"); v != "" {
			ps, err := strconv.Atoi(v)
			if err == nil {
				input.PassingScore = &ps
			}
		}
		if v := r.FormValue("exam_id"); v != "" {
			input.ExamID = &v
		}
		if ids := r.Form["topic_ids"]; len(ids) > 0 {
			input.TopicIDs = ids
		}

		// Parse options JSON + image files
		if optionsJSON := r.FormValue("options"); optionsJSON != "" {
			var opts []dto.QuestionOptionInput
			if err := json.Unmarshal([]byte(optionsJSON), &opts); err == nil {
				for idx, o := range opts {
					oi := usecase.OptionInput{
						Text:      o.Text,
						IsCorrect: o.IsCorrect,
						ImageIDs:  o.ImageIDs,
					}
					optImgKey := fmt.Sprintf("option_images[%d]", idx)
					if optImgFiles, ok := r.MultipartForm.File[optImgKey]; ok && len(optImgFiles) > 0 {
						oi.ImageFiles = optImgFiles
					}
					input.Options = append(input.Options, oi)
				}
			}
		}
	} else {
		// JSON body
		var req dto.UpdateQuestionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			response.Error(w, apperror.ErrInvalidBody)
			return
		}

		input = usecase.UpdateQuestionInput{
			Type:               req.Type,
			Statement:          req.Statement,
			ExpectedAnswerText: req.ExpectedAnswerText,
			PassingScore:       req.PassingScore,
			ExamID:             req.ExamID,
			TopicIDs:           req.TopicIDs,
		}

		if req.Options != nil {
			for _, o := range req.Options {
				input.Options = append(input.Options, usecase.OptionInput{
					Text:      o.Text,
					IsCorrect: o.IsCorrect,
					ImageIDs:  o.ImageIDs,
				})
			}
		}
	}

	q, err := h.uc.Update(r.Context(), publicID, input)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.QuestionToResponse(q))
}

// AddImages godoc
// @Summary     Add images to a question
// @Description Uploads and adds images to an existing question (admin only)
// @Tags        questions
// @Accept      multipart/form-data
// @Produce     json
// @Security    CookieAuth
// @Param       id     path     string true "Question public ID (UUID)"
// @Param       images formData file   true "Image files"
// @Success     200  {object} dto.QuestionResponse
// @Failure     400  {object} apperror.AppError
// @Failure     401  {object} apperror.AppError
// @Failure     403  {object} apperror.AppError
// @Failure     404  {object} apperror.AppError
// @Failure     500  {object} apperror.AppError
// @Router      /questions/{id}/images [post]
func (h *QuestionHandler) AddImages(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")
	userPublicID := middleware.UserPublicID(r.Context())

	if err := r.ParseMultipartForm(50 << 20); err != nil {
		response.Error(w, apperror.ErrFileTooLarge)
		return
	}

	imageFiles := r.MultipartForm.File["images"]
	if len(imageFiles) == 0 {
		response.Error(w, apperror.ErrInvalidInput)
		return
	}

	q, err := h.uc.AddImages(r.Context(), publicID, userPublicID, imageFiles)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.QuestionToResponse(q))
}

// RemoveImage godoc
// @Summary     Remove an image from a question
// @Description Removes a specific image from a question (admin only)
// @Tags        questions
// @Security    CookieAuth
// @Param       id      path string true "Question public ID (UUID)"
// @Param       imageId path string true "Image file public ID (UUID)"
// @Success     200 {object} dto.QuestionResponse
// @Failure     401 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Failure     404 {object} apperror.AppError
// @Failure     500 {object} apperror.AppError
// @Router      /questions/{id}/images/{imageId} [delete]
func (h *QuestionHandler) RemoveImage(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")
	imageID := r.PathValue("imageId")

	q, err := h.uc.RemoveImage(r.Context(), publicID, imageID)
	if err != nil {
		response.Error(w, err)
		return
	}

	response.JSON(w, http.StatusOK, dto.QuestionToResponse(q))
}

// Delete godoc
// @Summary     Delete a question
// @Description Soft-deletes a question by public ID (admin only)
// @Tags        questions
// @Security    CookieAuth
// @Param       id path string true "Question public ID (UUID)"
// @Success     204
// @Failure     401 {object} apperror.AppError
// @Failure     403 {object} apperror.AppError
// @Failure     404 {object} apperror.AppError
// @Failure     500 {object} apperror.AppError
// @Router      /questions/{id} [delete]
func (h *QuestionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	publicID := r.PathValue("id")

	if err := h.uc.Delete(r.Context(), publicID); err != nil {
		response.Error(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
