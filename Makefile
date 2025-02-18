# Makefile to check and set up Python 3.12 and a virtual environment

PYTHON_VERSION=3.12
VENV_DIR=.venv

# Check if Python 3.12 is installed, if not, install it
.PHONY: check-python
check-python:
	@if ! python${PYTHON_VERSION} --version | grep -q "$(PYTHON_VERSION)"; then \
		echo "Python $(PYTHON_VERSION) is not installed. Installing..."; \
		sudo add-apt-repository -y ppa:deadsnakes/ppa && sudo apt update && sudo apt install -y python$(PYTHON_VERSION) python$(PYTHON_VERSION)-venv || { \
			echo "Failed to install Python $(PYTHON_VERSION). Please install it manually."; \
			exit 1; \
		}; \
	else \
		echo "Python $(PYTHON_VERSION) is installed."; \
	fi

# Install Python dependencies from pyproject.toml
.PHONY: requirements
requirements:
	@uv sync

# Install frontend dependencies (Node.js packages)
.PHONY: install-front
install-front:
	@cd app/dashboard && pnpm i 

# Run database migrations using Alembic
.PHONY: run-migration
run-migration:
	@uv run alembic upgrade head 

# run marzban
.PHONY: run
run:
	@uv run main.py

# Run marzban with watchfiles
.PHONY: run-watch
run-watch:
	@if ! $(VENV_DIR)/bin/pip show watchfiles >/dev/null 2>&1; then \
		echo "watchfiles is not installed. Installing..."; \
		$(VENV_DIR)/bin/pip install watchfiles; \
	fi
	@echo "Running application with watchfiles..."
	@$(VENV_DIR)/bin/watchfiles --filter python "python main.py" .


# Clean the environment
.PHONY: clean
clean:
	@rm -rf $(VENV_DIR)
	@echo "Virtual environment removed."

install_uv:
	curl -LsSf https://astral.sh/uv/install.sh | sh
