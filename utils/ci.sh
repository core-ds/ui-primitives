#!/bin/bash

# Подтягиваем тэги
git fetch --prune --unshallow
git fetch --tags

npm ci

git config --global user.email "ds@gitmax.tech"
git config --global user.name "core-ds-bot"

npm run release-minor