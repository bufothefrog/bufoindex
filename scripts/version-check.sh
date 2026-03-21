#!/bin/bash
# Version consistency checker to prevent dependency mismatches

echo "🔍 Checking version consistency..."

# Check package.json vs installed versions
PACKAGE_NEXT=$(grep '"next":' package.json | grep -o '"[^"]*"' | tail -1 | tr -d '"' | sed 's/[^0-9.]*//g')
INSTALLED_NEXT=$(npm list next --depth=0 2>/dev/null | grep next@ | grep -o '[0-9.]*')

echo "Package.json Next.js: $PACKAGE_NEXT"
echo "Installed Next.js: $INSTALLED_NEXT"

if [[ "$PACKAGE_NEXT" != "$INSTALLED_NEXT"* ]]; then
    echo "❌ VERSION MISMATCH DETECTED!"
    echo "This can cause webpack module resolution errors."
    echo "Run: npm install next@^$INSTALLED_NEXT --save"
    exit 1
fi

# Check for conflicting router setups
if [[ -d "pages" && -d "app" ]]; then
    echo "❌ CONFLICTING ROUTER SETUP!"
    echo "Both app/ and pages/ directories found. Choose one routing approach."
    exit 1
fi

# Check for correct router setup
if [[ -d "app" ]]; then
    echo "✅ App Router detected"
    if [[ -f "pages/_document.js" || -f "pages/_app.js" ]]; then
        echo "⚠️  WARNING: Pages Router files found in App Router project"
    fi
else
    echo "✅ Pages Router detected"
fi

echo "✅ Version consistency check passed"