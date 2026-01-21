#!/usr/bin/env bash

set -e

rm -rf .publish
mkdir .publish
cp -r {icons,styles,animations,package.json,README.md} .publish
cd .publish
npm publish --access public

echo "Publishing package to registry..."

git push origin master
git push --tags
