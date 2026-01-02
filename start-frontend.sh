#!/bin/bash

# Start Best Wishes Frontend
echo "Starting Best Wishes Frontend..."

cd "$(dirname "$0")/frontend"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Dependencies not found. Installing..."
    npm install
fi

# Start the development server
echo "Starting Next.js dev server on http://localhost:3000"
npm run dev
