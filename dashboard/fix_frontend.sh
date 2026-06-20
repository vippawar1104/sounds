#!/bin/bash

echo "🔧 Fixing corrupted node_modules and cache..."

# Kill any running dev servers
echo "Stopping dev servers..."
lsof -ti :3000 | xargs kill -9 2>/dev/null || true

# Remove corrupted files
echo "Removing corrupted node_modules..."
rm -rf node_modules

echo "Removing corrupted .next cache..."
rm -rf .next

echo "Removing package-lock.json..."
rm -f package-lock.json

# Clear npm cache
echo "Clearing npm cache..."
npm cache clean --force

# Reinstall
echo "Reinstalling dependencies (this may take a few minutes)..."
npm install

echo "✅ Done! Now run: npm run dev"
