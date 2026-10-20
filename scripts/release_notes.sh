#!/usr/bin/env bash
# Текст GitHub Release для тега: тело аннотированного тега и блок с docker-образами.
# У облегчённого тега и у тега с пустым телом — список коммитов от предыдущего тега v*.
set -euo pipefail

tag="${1:?usage: release_notes.sh <tag>}"

if ! git rev-parse -q --verify "refs/tags/${tag}" >/dev/null; then
    echo "tag ${tag} not found" >&2
    exit 1
fi

version="${tag#v}"
body=""
if [ "$(git cat-file -t "refs/tags/${tag}")" = "tag" ]; then
    body="$(git tag -l --format='%(contents:subject)%0a%0a%(contents:body)' "${tag}")"
fi

if [ -z "$(printf '%s' "${body}" | tr -d '[:space:]')" ]; then
    prev="$(git describe --tags --abbrev=0 --match 'v*' "${tag}^" 2>/dev/null || true)"
    if [ -n "${prev}" ]; then
        range="${prev}..${tag}"
    else
        range="${tag}"
    fi
    body="$(git log --no-merges --format='- %s' "${range}")"
fi

printf '%s\n\n## Образы\n\n- `npvpn/panel:%s`\n- `ghcr.io/npvpn/panel:%s`\n' "${body}" "${version}" "${version}"
