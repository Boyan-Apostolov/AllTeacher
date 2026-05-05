#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "==> Cleaning old build artifacts..."
rm -rf ios/build ios/Pods ios/Podfile.lock

echo "==> Installing pods..."
cd ios && pod install --repo-update
cd ..

echo "==> Done. Now run: npx expo run:ios"
