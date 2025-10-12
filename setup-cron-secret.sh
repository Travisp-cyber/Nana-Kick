#!/bin/bash

# Generate CRON_SECRET for monthly usage reset
# This script generates a secure random secret for authenticating cron jobs

echo "==================================="
echo "Nana Kick - Cron Secret Generator"
echo "==================================="
echo ""

# Check if openssl is available
if ! command -v openssl &> /dev/null; then
    echo "❌ Error: openssl is not installed"
    echo "Please install openssl first"
    exit 1
fi

# Generate secret
CRON_SECRET=$(openssl rand -base64 32)

echo "✅ Generated CRON_SECRET:"
echo ""
echo "CRON_SECRET=\"$CRON_SECRET\""
echo ""
echo "==================================="
echo "Next Steps:"
echo "==================================="
echo ""
echo "1. Add to .env.local:"
echo "   echo 'CRON_SECRET=\"$CRON_SECRET\"' >> .env.local"
echo ""
echo "2. Add to Vercel:"
echo "   - Go to Vercel Dashboard → Settings → Environment Variables"
echo "   - Add: CRON_SECRET = $CRON_SECRET"
echo "   - Apply to: Production, Preview, Development"
echo ""
echo "3. Test the cron endpoint:"
echo "   curl -X GET https://your-app.vercel.app/api/cron/reset-usage \\"
echo "     -H \"Authorization: Bearer $CRON_SECRET\""
echo ""
echo "==================================="

