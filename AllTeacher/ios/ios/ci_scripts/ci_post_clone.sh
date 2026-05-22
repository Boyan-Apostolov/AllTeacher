#!/bin/sh
set -e

# Install Node
brew install node@20
export PATH="/usr/local/opt/node@20/bin:$PATH"

echo "Node: $(node --version)"
echo "NPM: $(npm --version)"

# Install JS dependencies
cd /Volumes/workspace/repository/AllTeacher/ios
npm ci

# Patch expo-device: TARGET_OS_SIMULATOR is a C macro, not valid in Swift with Xcode 26
DEVICE_FILE="node_modules/expo-device/ios/UIDevice.swift"
if [ -f "$DEVICE_FILE" ]; then
  echo "Patching expo-device UIDevice.swift for Xcode 26 compatibility..."
  perl -i -pe 's/TARGET_OS_SIMULATOR != 0/ProcessInfo.processInfo.environment["SIMULATOR_DEVICE_NAME"] != nil/g' "$DEVICE_FILE"
  echo "Patch applied."
else
  echo "WARNING: expo-device UIDevice.swift not found at $DEVICE_FILE"
fi

# Install iOS pods
cd ios
export PATH="/usr/local/opt/node@20/bin:$PATH"
pod install
