.PHONY: build frontend dev-frontend dev-backend test run lint clean

# Build frontend and embed in Go binary
build: frontend
	mkdir -p cmd/quadlet-manager/web
	cp -r web/dist cmd/quadlet-manager/web/
	go build -o bin/quadlet-manager ./cmd/quadlet-manager
	rm -rf cmd/quadlet-manager/web

# Build frontend only
frontend:
	cd web && npm run build

# Dev mode: run Vite dev server (proxy to Go backend on :8080)
dev-frontend:
	cd web && npm run dev

# Dev mode: run Go backend (--dev disables embedded frontend)
dev-backend:
	go run ./cmd/quadlet-manager --dev --port 8080

# Run all Go tests (skip cmd/ which requires embedded frontend)
test:
	go test ./internal/...

# Build and run
run: build
	./bin/quadlet-manager

lint:
	golangci-lint run ./...

clean:
	rm -rf bin/ cmd/quadlet-manager/web/
