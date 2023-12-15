#!/bin/bash

# Stop script on any error
set -e

# Print each command before executing it
set -x

echo "Starting build process..."

echo "Installing npm dependencies..."
npm install


# Install Poetry using pip
echo "Installing Poetry..."
pip install poetry

echo "Exporting Poetry dependencies to requirements.txt..."
poetry export -f requirements.txt --output requirements.txt --without-hashes

echo "Installing Python dependencies from requirements.txt..."
pip install -r requirements.txt

echo "Installing Python dependencies and eth-ape..."
pip install eth-ape
ape plugins install . --upgrade
ape compile


echo "Building sdk/js workspace..."
npm run build --workspace=sdk/js

echo "Building ui/lib workspace..."
npm run build --workspace=ui/lib

echo "Building ui/app workspace..."
npm run build --workspace=ui/app


echo "Build process for ui/app completed. Listing contents of ui/app/dist:"
ls ui/app/dist

echo "Build script completed."
