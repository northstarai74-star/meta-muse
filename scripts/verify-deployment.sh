#!/bin/bash
# Verify deployment configuration

echo "🔍 Checking deployment configuration..."
echo ""

echo "✅ Checking package.json build script:"
grep "vercel-build" package.json
echo ""

echo "✅ Checking Prisma schema:"
grep "provider.*postgresql" prisma/schema.prisma
echo ""

echo "✅ Checking migrations exist:"
ls -la prisma/migrations/ | wc -l
echo "Migrations found"
echo ""

echo "✅ Environment variables to set on Vercel:"
echo "  - DATABASE_URL (Supabase connection string)"
echo "  - SESSION_SECRET"
echo "  - ENCRYPTION_KEY"
echo "  - ADMIN_EMAIL"
echo "  - ADMIN_PASSWORD"
echo "  - OPENROUTER_API_KEY (optional)"
echo ""

echo "✅ Build locally to test:"
echo "  npm run build"
echo ""

echo "✅ Next step: Add variables to Vercel and redeploy"
