.PHONY: install playground run frontend test all

all: install

install:
	uv sync
	cd frontend && npm install

playground:
	uv run adk web app --host 127.0.0.1 --port 18081 --reload_agents

run:
	uv run uvicorn app.server:app --host 127.0.0.1 --port 8000 --reload

frontend:
	cd frontend && npm run dev

test:
	uv run pytest
