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

# Create a virtual environment if it doesn't exist
.PHONY: create-venv
create-venv: check-python
	@if [ ! -d "$(VENV_DIR)" ]; then \
		echo "Creating virtual environment..."; \
		python${PYTHON_VERSION} -m venv $(VENV_DIR); \
	fi

# Install Python and set up the environment
.PHONY: setup
setup: create-venv
	@echo "Environment setup complete. To activate the virtual environment, run:"
	@echo "source $(VENV_DIR)/bin/activate"

# Install Python dependencies from requirements.txt
.PHONY: requirements
requirements:
	@$(VENV_DIR)/bin/pip install -r requirements.txt 

# Install frontend dependencies (Node.js packages)
.PHONY: install-front
install-front:
	@cd app/dashboard && npm i 

# Run database migrations using Alembic
.PHONY: run-migration
run-migration:
	@alembic upgrade head 

# run marzban
.PHONY: run
run:
	@python main.py

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

