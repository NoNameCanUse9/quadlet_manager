.PHONY: build frontend dev-frontend dev-backend test run lint clean dev

# Build frontend and embed in Go binary
build: frontend
	mkdir -p cmd/quadlet-manager/web
	cp -r web/dist cmd/quadlet-manager/web/
	go build -o bin/quadlet-manager ./cmd/quadlet-manager
	rm -rf cmd/quadlet-manager/web

# Build frontend only
frontend:
	cd web && npm run build

# Standalone Dev mode: run Vite dev server (proxy to Go backend on :9090)
dev-frontend:
	cd web && npm run dev

# Standalone Dev mode: run Go backend (--dev disables embedded frontend) on port 9090
dev-backend:
	go run ./cmd/quadlet-manager --dev --port 9090

# Premium unified hot-reloading development environment (Concurrently runs backend with Air & frontend with Vite on port 9090)
dev:
	@mkdir -p bin
	@if [ ! -f ./bin/air ]; then \
		if command -v air >/dev/null 2>&1; then \
			echo "Using system air..."; \
			cp $$(command -v air) ./bin/air; \
		else \
			echo "Installing hot-rebuild engine (air) locally into bin/..."; \
			GOBIN=$$(pwd)/bin go install github.com/air-verse/air@latest; \
		fi; \
	fi
	@echo "=========================================================="
	@echo "🚀 Starting Quadlet Manager Dev Environment (Port 9090)"
	@echo "=========================================================="
	@trap 'kill 0' SIGINT; ./bin/air & cd web && npm run dev & wait

# Run all Go tests
test:
	go test ./internal/...

# Build and run
run: build
	./bin/quadlet-manager

lint:
	golangci-lint run ./...

clean:
	rm -rf bin/ cmd/quadlet-manager/web/
