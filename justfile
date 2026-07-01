# Snapcell — justfile
# https://github.com/casey/just

_default:
    @just --list

# Install dependencies
install:
    npm install

# TypeScript type-check (no emit)
check:
    npx tsc -p ./ --noEmit

# Build extension (compile TS → out/)
build:
    npx tsc -p ./

# Watch mode: recompile on change
watch:
    npx tsc -watch -p ./

# Build + package + install (one shot)
snap: build
    npx @vscode/vsce package --no-dependencies --allow-missing-repository
    code --install-extension snapcell-*.vsix --force 2>/dev/null

# Clean build artifacts
clean:
    rm -rf out/ *.vsix

# Lint TypeScript
lint:
    npx oxlint

# Run tests
test:
    npx vitest run

# Format code
fmt:
    npx oxfmt

# Check formatting (CI)
fmt-check:
    npx oxfmt --check

# Find unused files/deps
knip:
    npx knip

# Open in VS Code as extension dev host
dev:
    code --extensionDevelopmentPath=.

# Full CI: install → check → lint → test → build
ci: install check lint test build
    @echo "✅ All checks passed"

# Create a new git tag + push
release version:
    git tag -a v{{version}} -m "Release v{{version}}"
    git push origin v{{version}}
