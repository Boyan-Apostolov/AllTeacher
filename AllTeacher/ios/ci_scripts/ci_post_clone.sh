#!/bin/sh
set -e

brew install node@20
brew link node@20 --force

cd /Volumes/workspace/repository/AllTeacher/ios
npm ci
