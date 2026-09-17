# Thin wrappers over docker compose. Nothing here needs a local JDK or Node.

.DEFAULT_GOAL := help

up: ## Build and start the full stack
	docker compose up --build -d
	@echo "web  -> http://localhost:3000"
	@echo "api  -> http://localhost:8080"

down: ## Stop the stack (keeps the database)
	docker compose down

reset: ## Stop the stack and delete the database volume
	docker compose down -v

logs: ## Follow all logs
	docker compose logs -f

api-logs: ## Follow backend logs
	docker compose logs -f api

test: ## Run the backend test suite against a disposable PostgreSQL
	docker compose --profile test run --rm test; \
		status=$$?; docker compose --profile test rm -sf postgres-test >/dev/null; exit $$status

psql: ## Open a psql shell against the dev database
	docker compose exec postgres psql -U routine -d routine

secret: ## Generate a production JWT secret
	@openssl rand -base64 48

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

.PHONY: up down reset logs api-logs test psql secret help
