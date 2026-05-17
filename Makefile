.PHONY: build test run lint clean

build:
	go build -o bin/quadlet-manager ./cmd/quadlet-manager

test:
	go test ./...

run: build
	./bin/quadlet-manager

lint:
	golangci-lint run ./...

clean:
	rm -rf bin/
