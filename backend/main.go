package main

import (
	"encoding/json"
	"fmt"
	"net/http"
)

type Response struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Response{
		Status:  "OK",
		Message: "MAX Backend Go Service is running",
	})
}

func main() {
	http.HandleFunc("/health", healthHandler)
	fmt.Println("Backend server listening on :8080...")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		fmt.Printf("Server failed: %s\n", err)
	}
}
