"""scripts/release_notes.sh: текст GitHub Release для тега."""

import os
import subprocess
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "release_notes.sh"


def _clean_env() -> dict[str, str]:
    """Окружение без GIT_*: фикстура не должна добраться до настоящего репозитория (хуки git)."""
    return {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}


def _git(repo: Path, *args: str) -> None:
    subprocess.run(
        [
            "git",
            "-c",
            "user.name=t",
            "-c",
            "user.email=t@example.com",
            "-c",
            "commit.gpgsign=false",
            "-c",
            "tag.gpgsign=false",
            *args,
        ],
        cwd=repo,
        check=True,
        capture_output=True,
        env=_clean_env(),
    )


def _commit(repo: Path, message: str) -> None:
    _git(repo, "commit", "--allow-empty", "-m", message)


def _notes(repo: Path, tag: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["bash", str(SCRIPT), tag], cwd=repo, capture_output=True, text=True, check=False, env=_clean_env()
    )


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    _git(tmp_path, "init", "-q", "-b", "master")
    _commit(tmp_path, "первый коммит")
    return tmp_path


def test_annotated_tag_body_and_images(repo: Path):
    _git(
        repo,
        "tag",
        "-a",
        "v2026.10.14",
        "-m",
        "Релиз 2026.10.14",
        "-m",
        "Исправлена сортировка узлов\nДобавлен экспорт статистики",
    )
    result = _notes(repo, "v2026.10.14")
    assert result.returncode == 0, result.stderr
    assert "Релиз 2026.10.14" in result.stdout
    assert "Добавлен экспорт статистики" in result.stdout
    assert "`npvpn/panel:2026.10.14`" in result.stdout
    assert "`ghcr.io/npvpn/panel:2026.10.14`" in result.stdout


def test_hotfix_tag_version(repo: Path):
    _git(repo, "tag", "-a", "v2026.10.14.1", "-m", "Хотфикс")
    result = _notes(repo, "v2026.10.14.1")
    assert "`npvpn/panel:2026.10.14.1`" in result.stdout


def test_lightweight_tag_falls_back_to_commits_since_previous_tag(repo: Path):
    _git(repo, "tag", "-a", "v2026.10.07", "-m", "Релиз 2026.10.07")
    _commit(repo, "фикс после релиза")
    _commit(repo, "ещё один фикс")
    _git(repo, "tag", "v2026.10.14")
    result = _notes(repo, "v2026.10.14")
    assert result.returncode == 0, result.stderr
    assert "- фикс после релиза" in result.stdout
    assert "- ещё один фикс" in result.stdout
    assert "первый коммит" not in result.stdout


def test_annotated_tag_with_empty_message_falls_back_to_commits(repo: Path):
    _git(repo, "tag", "-a", "v2026.10.07", "-m", "Релиз 2026.10.07")
    _commit(repo, "фикс после релиза")
    _commit(repo, "ещё один фикс")
    _git(repo, "tag", "-a", "v2026.10.14", "-m", " ")
    result = _notes(repo, "v2026.10.14")
    assert result.returncode == 0, result.stderr
    assert "- фикс после релиза" in result.stdout
    assert "- ещё один фикс" in result.stdout
    assert "`npvpn/panel:2026.10.14`" in result.stdout
    assert "`ghcr.io/npvpn/panel:2026.10.14`" in result.stdout


def test_first_lightweight_tag_without_previous(repo: Path):
    _git(repo, "tag", "v2026.10.14")
    result = _notes(repo, "v2026.10.14")
    assert result.returncode == 0, result.stderr
    assert "- первый коммит" in result.stdout


def test_unknown_tag_fails(repo: Path):
    result = _notes(repo, "v1999.01.01")
    assert result.returncode == 1
    assert "v1999.01.01" in result.stderr
