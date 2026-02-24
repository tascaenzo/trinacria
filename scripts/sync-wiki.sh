#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${GITHUB_REPOSITORY:-}" ]]; then
  echo "GITHUB_REPOSITORY is required"
  exit 1
fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "GITHUB_TOKEN is required"
  exit 1
fi

WORKDIR="$(mktemp -d)"
WIKI_URL="https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.wiki.git"

cleanup() {
  rm -rf "${WORKDIR}"
}
trap cleanup EXIT

echo "[wiki-sync] Cloning wiki repository..."
if ! git clone "${WIKI_URL}" "${WORKDIR}/wiki"; then
  echo "[wiki-sync] Wiki repo not found or disabled. Skipping sync."
  echo "[wiki-sync] Enable Wiki in repository settings, then rerun the workflow."
  exit 0
fi

cd "${WORKDIR}/wiki"

echo "[wiki-sync] Cleaning old generated content..."
find . -mindepth 1 -maxdepth 1 \
  ! -name '.git' \
  ! -name '.gitignore' \
  -exec rm -rf {} +

echo "[wiki-sync] Copying docs content..."
cp -R "${GITHUB_WORKSPACE}/docs/assets" ./assets
cp -R "${GITHUB_WORKSPACE}/docs/en" ./en
cp -R "${GITHUB_WORKSPACE}/docs/it" ./it

cat > Home.md <<'EOF'
# Trinacria Wiki

This wiki is automatically synced from the repository `docs/` folder.

## Documentation

- [English Index](en/README)
- [Italian Index](it/README)
EOF

if [[ -f "_Sidebar.md" ]]; then
  rm -f "_Sidebar.md"
fi

cat > _Sidebar.md <<'EOF'
## Trinacria Docs

- [Home](Home)
- [English](en/README)
- [Italiano](it/README)
EOF

if [[ -n "$(git status --porcelain)" ]]; then
  echo "[wiki-sync] Changes detected, committing..."
  git config user.name "github-actions[bot]"
  git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
  git add .
  git commit -m "docs(wiki): sync from repository docs"
  git push origin HEAD
  echo "[wiki-sync] Wiki updated."
else
  echo "[wiki-sync] No changes to sync."
fi
