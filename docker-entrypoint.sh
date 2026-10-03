#!/bin/sh
# Deterministic startup: migrate (single instance) -> seed (idempotent) -> start.
set -e
npx prisma migrate deploy
node prisma/seed.js
exec "$@"
