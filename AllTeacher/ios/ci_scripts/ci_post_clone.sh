#!/bin/sh
set -e

brew install node@20
brew link node@20 --force

cd $CI_WORKSPACE/AllTeacher/ios
npm ci
