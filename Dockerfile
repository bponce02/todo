# syntax=docker/dockerfile:1.7

# ---------- Stage 1: build the React/Vite bundle ----------
FROM node:22-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: install Python deps with uv ----------
FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim AS builder
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

# ---------- Stage 3: runtime ----------
FROM python:3.14-slim AS runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH=/app/src \
    DJANGO_SETTINGS_MODULE=personal_management.settings \
    DJANGO_DEBUG=False \
    SQLITE_PATH=/data/db.sqlite3

RUN groupadd --system app && useradd --system --gid app --home /app app \
 && mkdir -p /app /data \
 && chown -R app:app /app /data

WORKDIR /app

COPY --from=builder --chown=app:app /app/.venv /app/.venv
COPY --chown=app:app src/ /app/src/
COPY --from=frontend --chown=app:app /build/dist /app/frontend/dist

# Collect static assets at build time so the image is immutable at runtime.
# A throwaway secret is fine here: collectstatic doesn't touch crypto.
RUN DJANGO_SECRET_KEY=build-time-only python /app/src/manage.py collectstatic --noinput

USER app
VOLUME ["/data"]
EXPOSE 8000

# Migrate on boot (SQLite, idempotent), then hand off to gunicorn.
CMD ["sh", "-c", "python /app/src/manage.py migrate --noinput && exec gunicorn personal_management.wsgi:application --bind 0.0.0.0:8000 --workers ${GUNICORN_WORKERS:-3} --access-logfile -"]
