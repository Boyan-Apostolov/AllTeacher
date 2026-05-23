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

# Run Expo prebuild to generate native iOS files
export PATH="/usr/local/opt/node@20/bin:$PATH"
npx expo prebuild --platform ios --no-install

# Allow git to clone public repos without credential prompts (needed for
# pods like RevenueCat that are fetched directly from GitHub in Xcode Cloud)
git config --global credential.helper ""
export GIT_TERMINAL_PROMPT=0

# Install iOS pods
cd ios
pod install
