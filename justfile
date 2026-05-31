# type `just` to see this list
default:
    @just --list

# first-time setup: install deps, migrate, create admin/admin superuser
init:
    uv sync
    just npm-install
    just migrate
    uv run python src/manage.py shell -c "from django.contrib.auth import get_user_model; U = get_user_model(); U.objects.filter(username='admin').exists() or U.objects.create_superuser('admin', 'admin@example.com', 'admin')"

# run Django + Radicale together (main dev command)
[parallel]
dev: runserver radicale npm-dev

# start the Django dev server
runserver:
    uv run python src/manage.py runserver

# start the Radicale CalDAV server (phone connects to this)
radicale:
    uv run radicale --config radicale.conf

# create a Radicale user (prompts for username and password)
radicale-adduser:
    uv run python scripts/radicale_adduser.py

# run the test suite (pass extra args, e.g. `just test -k auth`)
test *ARGS:
    uv run pytest {{ARGS}}

# run Django's system checks
check:
    uv run python src/manage.py check

migrate:
    uv run python src/manage.py migrate

makemigrations:
    uv run python src/manage.py makemigrations

createsuperuser:
    uv run python src/manage.py createsuperuser

npm-dev:
    cd frontend && npm run dev

npm-install:
    cd frontend && npm install

# build the React app to frontend/dist (read by django-vite in prod)
build-frontend:
    cd frontend && npm run build

# build the frontend and collect everything into STATIC_ROOT for serving
build: build-frontend
    uv run python src/manage.py collectstatic --noinput