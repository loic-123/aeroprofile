#!/usr/bin/env bash
# Launch AeroProfile locally: backend API + frontend dev server.
# Usage: ./run_local.sh
#
# Prerequisites:
#   pip install -e .
#   cd frontend && npm install

set -e

echo "🚴 AeroProfile — lancement local"
echo "================================="

# Build frontend if dist/ doesn't exist
if [ ! -d "frontend/dist" ]; then
    echo "📦 Build frontend..."
    (cd frontend && npm run build)
fi

# Start backend (serves API + built frontend)
echo "🔧 Démarrage backend sur http://localhost:8000"
echo "   Frontend: http://localhost:8000"
echo "   API:      http://localhost:8000/api/health"
echo ""
echo "   Ctrl+C pour arrêter."
echo ""

uvicorn aeroprofile.api.app:app --host 0.0.0.0 --port 8000 --reload
