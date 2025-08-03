#!/bin/bash

# BufoIndex Site Cleanup Script
# Removes build artifacts and cached files for a clean state

echo "🧹 Cleaning up BufoIndex site..."

# Remove node_modules
echo "  ❌ Deleting node_modules/"
rm -rf node_modules

# Remove public directory (Hugo build output)
echo "  ❌ Deleting public/"
rm -rf public

# Remove resources directory (Hugo build output)
echo "  ❌ Deleting resources/"
rm -rf resources

# Remove Hugo build lock file
echo "  ❌ Deleting .hugo_build.lock"
rm -f .hugo_build.lock

# Remove package-lock.json
echo "  ❌ Deleting package-lock.json"
rm -f package-lock.json

# Remove Hugo cache/stats (if they exist)
echo "  ❌ Deleting hugo_stats.json"
rm -f hugo_stats.json

echo "✅ Site cleanup complete!"
echo "💡 Run ./automations/install-site.sh to reinstall everything"