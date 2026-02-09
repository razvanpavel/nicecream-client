#!/usr/bin/env bash
set -euo pipefail

BUMP_TYPE="${1:-patch}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ "$BUMP_TYPE" != "patch" && "$BUMP_TYPE" != "minor" && "$BUMP_TYPE" != "major" ]]; then
  echo "Usage: $0 [patch|minor|major]"
  exit 1
fi

CURRENT_VERSION=$(node -p "require('$PROJECT_ROOT/package.json').version")
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

case "$BUMP_TYPE" in
  patch) PATCH=$((PATCH + 1)) ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
echo "Bumping $CURRENT_VERSION → $NEW_VERSION"

# Update package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('$PROJECT_ROOT/package.json', 'utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync('$PROJECT_ROOT/package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Update app.json
node -e "
const fs = require('fs');
const app = JSON.parse(fs.readFileSync('$PROJECT_ROOT/app.json', 'utf8'));
app.expo.version = '$NEW_VERSION';
fs.writeFileSync('$PROJECT_ROOT/app.json', JSON.stringify(app, null, 2) + '\n');
"

git add "$PROJECT_ROOT/package.json" "$PROJECT_ROOT/app.json"
git commit -m "chore: bump version to $NEW_VERSION"
git tag -a "v$NEW_VERSION" -m "Release $NEW_VERSION"

echo "Created commit and tag v$NEW_VERSION"
echo "To push: git push && git push --tags"
