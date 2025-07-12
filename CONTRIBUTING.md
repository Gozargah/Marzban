

# Contribute to Marzban

Thanks for considering contributing to **Marzban**!

## 🙋 Questions

Please **don’t use GitHub Issues** to ask questions. Instead, use one of the following platforms:

* 💬 Telegram: [@Gozargah\_Marzban](https://t.me/gozargah_marzban)
* 🗣️ GitHub Discussions: [Marzban Discussions](https://github.com/gozargah/marzban/discussions)

## 🐞 Reporting Issues

When reporting a bug or issue, please include:

* ✅ What you expected to happen
* ❌ What actually happened (include server logs or browser errors)
* ⚙️ Your `xray` JSON config and `.env` settings (censor sensitive info)
* 🔢 Your Marzban version and Docker version (if applicable)

---

# 🚀 Submitting a Pull Request

If there's no open issue for your idea, consider opening one for discussion **before submitting a PR**.

You can contribute to any issue that:

* Has no PR linked
* Has no maintainer assigned

No need to ask for permission!

## 🔀 Branching Strategy

* Always branch off of the `next` branch
* Keep `master` stable and production-ready

---

# 📁 Project Structure

```text
.
├── app          # Backend code (FastAPI - Python)
├── cli          # CLI code (Typer - Python)
├── dashboard    # Frontend code (React - TypeScript)
└── tests        # API tests
```

---

## 🧠 Backend (FastAPI)

The backend is built with **FastAPI** and **SQLAlchemy**:

* **Pydantic models**: `app/models`
* **Database models & operations**: `app/db`
* **backend logic should go in**: `app/operations`
* **Migrations (Alembic)**: `app/db/migrations`

🧩 **Note**: Ensure **all backend logic is organized and implemented in the `operations` module**. This keeps route handling, database access, and service logic clearly separated and easier to maintain.

### 📘 API Docs (Swagger / ReDoc)

Enable the `DOCS` flag in your `.env` file to access:

* Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
* ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)

### 🎯 Code Formatting

Format and lint code with:

```bash
make check
make format
```

### 🗃️ Database Migrations

To apply Alembic migrations to your database, run:

```bash
make run-migration
```

---

## 💻 Frontend (React + Tailwind)

> ⚠️ **We no longer upload pre-built frontend files.**

The frontend is located in the `dashboard` directory and is built using:

* **React + TypeScript**
* **Tailwind CSS (Shadcn UI)**

To build:

```bash
bun install
```

Remove the `dashboard/build` directory and restart the Python backend — the frontend will auto-rebuild (except in debug mode).

### 🧩 Component Guidelines

* Follow **Tailwind + Shadcn** best practices
* Keep components **single-purpose**
* Prioritize **readability** and **maintainability**

---

## 🛠️ Marzban CLI

Marzban’s CLI is built using [Textual](https://textual.textualize.io/).

* CLI codebase: `cli/`

---

## 🐛 Debug Mode

To run the project in debug mode with auto-reload, you can set the environment variable DEBUG to true. then by running the main.py, the backend and frontend will run separately on different ports.

Note that you must first install the necessary npm packages by running npm install inside the dashboard directory before running in debug mode.

Install frontend dependencies:

```bash
make install-front
```

Run the backend (`main.py`)

> ⚠️ In debug mode, the frontend will **not rebuild automatically** if you delete `dashboard/build`.

---

Feel free to reach out via [Telegram](https://t.me/gozargah_marzban) or GitHub Discussions if you have any questions. Happy contributing! 🚀
