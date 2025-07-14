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

.PHONY: install_uv
install_uv:
	@if ! uv --help >/dev/null 2>&1; then \
		echo "uv not found. Installing..."; \
		curl -LsSf https://astral.sh/uv/install.sh | sh; \
		echo "uv installed. Ensure ~/.cargo/bin is in your PATH."; \
	else \
		echo "uv is already installed."; \
	fi

# Install Python dependencies from pyproject.toml
.PHONY: requirements
requirements:
	@uv sync

# Check if nvm is installed, if not, install it
.PHONY: check-nvm
check-nvm:
	@if ! command -v nvm > /dev/null 2>&1; then \
		echo "nvm not found. Installing..."; \
		curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash || { \
			echo "Failed to install nvm. Please install it manually."; \
			exit 1; \
		}; \
		export NVM_DIR="$$HOME/.nvm"; \
		[ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh"; \
		[ -s "$$NVM_DIR/bash_completion" ] && . "$$NVM_DIR/bash_completion"; \
		echo "nvm installed. Version: `nvm --version`"; \
	else \
		echo "nvm is already installed. Version: `nvm --version`"; \
	fi

# Check if nodejs is installed, if not, install it
.PHONY: check-nodejs
check-nodejs: check-nvm
	@if ! node -v > /dev/null 2>&1; then \
		echo "nodejs not found. Installing..."; \
		nvm install 22 || { \
			echo "Failed to install nodejs. Please install it manually."; \
			exit 1; \
		}; \
	else \
		echo "nodejs is already installed."; \
	fi

# Check if bun is installed, if not, install it
.PHONY: check-bun
check-bun: check-nodejs
	@if ! bun --version > /dev/null 2>&1; then \
		echo "bun not found. Installing..."; \
		curl -fsSL https://bun.sh/install | bash || { \
			echo "Failed to install bun. Please install it manually."; \
			exit 1; \
		}; \
	else \
		echo "bun is already installed."; \
	fi

# Install frontend dependencies (Node.js packages)
.PHONY: install-front
install-front: check-bun
	@cd dashboard && bun install 

# Run database migrations using Alembic
.PHONY: run-migration
run-migration:
	@uv run alembic upgrade head 

# run marzban
.PHONY: run
run:
	@uv run main.py
	
# run marzban-cli
.PHONY: run-cli
run-cli:
	@uv run marzban-cli.py

# Run tests
.PHONY: test
test:
	@uv run pytest tests/
# Run tests-watch
.PHONY: test-whatch
test-whatch:
	@uv run ptw


# Run marzban with watchfiles
.PHONY: run-watch
run-watch:
	@echo "Running application with watchfiles..."
	@uv run watchfiles --filter python "uv run main.py" .

# Check code
.PHONY: check
check:
	@uv run ruff check .

# Format code
.PHONY: format
format:
	@uv run ruff format .

# Clean the environment
.PHONY: clean
clean:
	@rm -rf $(VENV_DIR)
	@echo "Virtual environment removed."

# Setup environment: check Python, install uv, and sync requirements
.PHONY: setup
setup: check-python install_uv requirements

# Format code (front-end)
.PHONY: fformat
fformat:
	@cd dashboard && bun run prettier . --write