#!/usr/bin/env bash
# Add a SENSITIVE (write-only, encrypted-at-rest) env var to the current Vercel project.
# Run inside the app dir you want to target (e.g. apps/business) after `vercel link`.
#
# Usage: ./vercel-set-sensitive.sh KEY [environment]
#        (the CLI prompts for the value; it is never echoed to shell history)
#
# Server-side secrets to mark sensitive (NOT the public NEXT_PUBLIC_* build vars):
#   apps/business : TAGIT_SERVICES_API_KEY
#   apps/admin    : PINATA_JWT, SITE_PASSWORD, A2A_API_KEY
#   apps/verify   : SDM_MASTER_KEY, SERVICES_API_KEY
set -euo pipefail
KEY="${1:?usage: vercel-set-sensitive.sh KEY [environment]}"
ENVIRONMENT="${2:-production}"
command -v vercel >/dev/null || { echo "vercel CLI not found: npm i -g vercel"; exit 1; }
vercel env add "$KEY" "$ENVIRONMENT" --sensitive
echo "✓ $KEY added as a Sensitive env var to the linked project ($ENVIRONMENT). Redeploy to apply."
