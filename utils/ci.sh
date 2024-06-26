#!/bin/bash

# Подтягиваем тэги
git fetch --prune --unshallow
git fetch --tags

# Смотрим, были ли изменения в папках icons и styles
LATEST_TAG=$(git describe --tags --abbrev=0)
CHANGES=$(git diff --name-only $LATEST_TAG HEAD | grep -E "(icons|styles|animations)/")
MAJOR_CHANGES=$(git diff --name-only $LATEST_TAG HEAD --diff-filter=D | grep -E "(icons|styles|animations)/")

# Если были изменения, релизим новую версию пакета
if [ -z "$CHANGES" ]
then
    echo "No changes found"
else
    echo $CHANGES
    echo "Changes found, publish..."

    npm ci

    git config --global user.email "ds@gitmax.tech"
    git config --global user.name "core-ds-bot"

    # Если были мажорные изменения, релизим мажорную версию пакета
    if [ -z "$MAJOR_CHANGES" ]
    then
        echo "release-minor"
        npm run release-minor
    else
        echo "release-major"
        npm run release-major
    fi
fi
