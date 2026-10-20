"""`.env.example` обязан перечислять все переменные окружения, которые читает код.

Сторож от дрейфа: новая переменная в `config.py`/`app/` без строки в примере
делает установку по README неполной, а мёртвая строка в примере вводит в заблуждение.
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# \s* пересекает переводы строк: вызовы вида config(\n    "NAME", ...) тоже ловятся.
_CODE_PATTERNS = [
    re.compile(r'\bconfig\(\s*"([A-Z][A-Z0-9_]*)"'),
    re.compile(r'os\.getenv\(\s*"([A-Z][A-Z0-9_]*)"'),
    re.compile(r'os\.environ\.get\(\s*"([A-Z][A-Z0-9_]*)"'),
    re.compile(r'os\.environ\[\s*"([A-Z][A-Z0-9_]*)"\s*\]'),
    re.compile(r'\benv\.get\(\s*"([A-Z][A-Z0-9_]*)"'),
]
_EXAMPLE_LINE = re.compile(r"^\s*#?\s*([A-Z][A-Z0-9_]*)\s*=", re.MULTILINE)

# Переменные, которые код читает, но документировать в примере не нужно.
# Каждая запись — с причиной.
_NOT_DOCUMENTED: dict[str, str] = {}


def _names_in_code() -> dict[str, str]:
    found: dict[str, str] = {}
    files = [ROOT / "config.py", ROOT / "main.py", *sorted((ROOT / "app").rglob("*.py"))]
    for path in files:
        if "node_modules" in path.parts:
            continue
        text = path.read_text(encoding="utf-8")
        for pattern in _CODE_PATTERNS:
            for match in pattern.finditer(text):
                found.setdefault(match.group(1), str(path.relative_to(ROOT)))
    return found


def _names_in_example() -> set[str]:
    return set(_EXAMPLE_LINE.findall((ROOT / ".env.example").read_text(encoding="utf-8")))


def test_multiline_config_call_is_detected():
    text = 'X = config(\n    "SOME_MULTILINE_NAME", cast=int, default=1\n)'
    assert _CODE_PATTERNS[0].findall(text) == ["SOME_MULTILINE_NAME"]


def test_every_env_variable_read_by_code_is_in_env_example():
    code = _names_in_code()
    missing = {name: where for name, where in code.items() if name not in _names_in_example()}
    for name in _NOT_DOCUMENTED:
        missing.pop(name, None)
    assert not missing, f"нет в .env.example: {missing}"


def test_env_example_has_no_variables_unknown_to_code():
    dead = _names_in_example() - set(_names_in_code())
    assert not dead, f"в .env.example есть переменные, которые код не читает: {sorted(dead)}"
