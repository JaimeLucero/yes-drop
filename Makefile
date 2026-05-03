.PHONY: help setup setup-frontend setup-backend install install-frontend install-backend run run-frontend run-backend dev lint test clean

help:
	@echo "YesDrop - Makefile Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make setup          - Full project setup (frontend + backend)"
	@echo "  make setup-frontend"
	@echo "  make setup-backend"
	@echo ""
	@echo "Install:"
	@echo "  make install      - Install all dependencies"
	@echo "  make install-frontend"
	@echo "  make install-backend"
	@echo ""
	@echo "Run:"
	@echo "  make run        - Run both frontend and backend"
	@echo "  make run-frontend"
	@echo "  make run-backend"
	@echo ""
	@echo "Other:"
	@echo "  make lint       - Run lint on frontend"
	@echo "  make clean     - Clean build artifacts"

# Setup
setup: setup-frontend setup-backend
	@echo "Setup complete!"

setup-frontend:
	@echo "Setting up frontend..."
	cp frontend/.env.local frontend/.env.local 2>/dev/null || cp frontend/.env.example frontend/.env.local 2>/dev/null || true
	@echo "Frontend .env.local ready. Update SUPABASE_URL and SUPABASE_ANON_KEY."

setup-backend:
	@echo "Setting up backend..."
	cp backend/.env backend/.env 2>/dev/null || cp backend/.env.example backend/.env 2>/dev/null || true
	@echo "Backend .env ready. Update BREVO_API_KEY and SUPABASE_JWKS_URL."

# Install
install: install-frontend install-backend

install-frontend:
	cd frontend && npm install

install-backend:
	cd backend && python3 -m venv venv && \
	. backend/venv/bin/activate && pip install -r backend/requirements.txt

# Run
run: run-frontend run-backend

run-frontend:
	cd frontend && npm run dev

run-backend:
	@if [ ! -d "backend/venv" ]; then \
		echo "Creating virtual environment..."; \
		cd backend && python3 -m venv venv; \
	fi
	@if [ ! -f "backend/venv/bin/activate" ]; then \
		echo "Installing dependencies..."; \
		cd backend && venv/bin/pip install -r requirements.txt; \
	fi
	. backend/venv/bin/activate && cd backend && uvicorn main:app --reload --port 8000

# Dev (runs both in background)
dev:
	@echo "Starting frontend (port 3000) and backend (port 8000)..."
	@(cd frontend && npm run dev &)
	@(. "$$(cd backend && pwd)/venv/bin/activate" && uvicorn main:app --reload --port 8000 &)
	@echo "Frontend: http://localhost:3000"
	@echo "Backend: http://localhost:8000"

# Lint
lint:
	cd frontend && npm run lint

# Clean
clean:
	cd frontend && rm -rf .next node_modules/.cache
	cd backend && rm -rf __pycache__ .pytest_cache *.pyc
	rm -f backend/.env