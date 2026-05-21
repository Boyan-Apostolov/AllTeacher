#!/bin/sh
set -e

# Install Node
brew install node@20
brew link node@20 --force

# Install JS dependencies
cd /Volumes/workspace/repository/AllTeacher/ios
npm ci

# Install iOS native dependencies
cd ios
pod install
