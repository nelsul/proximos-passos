package response

import (
	"encoding/json"
	"log"
	"net/http"

	"proximos-passos/backend/internal/domain/apperror"
)

func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("failed to encode response: %v", err)
	}
}

func Error(w http.ResponseWriter, err error) {
	if appErr, ok := err.(*apperror.AppError); ok {
		JSON(w, appErr.HTTPStatus, appErr)
		return
	}

	log.Printf("internal error: %v", err)
	JSON(w, http.StatusInternalServerError, apperror.ErrInternalError)
}
