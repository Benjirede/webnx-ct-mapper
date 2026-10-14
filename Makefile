.PHONY: setup run test stop clean

# 1. First-time setup (Installs dependencies and prepares the data folder)
setup:
	npm ci
	mkdir -p data && chmod 777 data

# 2. Rebuild and launch the production Docker container stack
run:
	-docker stop ct-mapper-prod 2>/dev/null || true
	-docker rm ct-mapper-prod 2>/dev/null || true
	docker build -t webnx-ct-mapper .
	docker run -d -p 3000:3000 -v $$(pwd)/data:/app/data --name ct-mapper-prod webnx-ct-mapper
	@echo "🚀 Container is running! View the app at http://localhost:3000"

# 3. Fire the automated 5-point integration test suite against the container
test:
	./test-image.sh

# 4. Stop and remove the active container safely
stop:
	-docker stop ct-mapper-prod 2>/dev/null || true
	-docker rm ct-mapper-prod 2>/dev/null || true
	@echo "🛑 Container stopped and removed cleanly."
