#!/bin/bash

# Setup Security Scanning for YesDrop
# This script installs pre-commit hooks to catch credential leaks before pushing

set -e

echo "🔒 Setting up security scanning for YesDrop..."
echo ""

# Check if pre-commit is installed
if ! command -v pre-commit &> /dev/null; then
    echo "📦 Installing pre-commit..."

    # Try pip3 first, then pip
    if command -v pip3 &> /dev/null; then
        pip3 install pre-commit
    elif command -v pip &> /dev/null; then
        pip install pre-commit
    else
        echo "❌ Error: pip not found. Please install Python and pip first."
        exit 1
    fi
else
    echo "✓ pre-commit is already installed"
fi

# Check if gitleaks is installed
if ! command -v gitleaks &> /dev/null; then
    echo "📦 Installing gitleaks..."

    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install gitleaks
        else
            echo "⚠️  gitleaks not installed. For macOS, run: brew install gitleaks"
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command -v apt-get &> /dev/null; then
            sudo apt-get update && sudo apt-get install -y gitleaks
        elif command -v yum &> /dev/null; then
            sudo yum install -y gitleaks
        else
            echo "⚠️  gitleaks not installed. Please install manually from: https://github.com/gitleaks/gitleaks"
        fi
    else
        echo "⚠️  gitleaks not installed. Please install from: https://github.com/gitleaks/gitleaks"
    fi
else
    echo "✓ gitleaks is already installed"
fi

echo ""
echo "📝 Installing git hooks..."

# Install pre-commit hooks from .pre-commit-config.yaml
cd "$(git rev-parse --show-toplevel)"
pre-commit install

echo ""
echo "✅ Security setup complete!"
echo ""
echo "Pre-commit hooks will now run on every commit."
echo "To test the hooks on all files, run:"
echo "  pre-commit run --all-files"
echo ""
echo "To skip pre-commit hooks (not recommended):"
echo "  git commit --no-verify"
echo ""
echo "For more info, see: .github/SECURITY.md"
