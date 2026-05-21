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

# Install iOS pods
cd ios
export PATH="/usr/local/opt/node@20/bin:$PATH"
pod install
