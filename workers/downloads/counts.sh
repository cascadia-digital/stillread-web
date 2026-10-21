#!/bin/zsh
# Download counts from the Worker, by day.  Usage: ./counts.sh [days]   (default 30)
#
# Needs ~/.config/stillread/cloudflare.env (chmod 600, never committed) with:
#   CF_ACCOUNT_ID=...          the Cloudflare account ID
#   CF_ANALYTICS_TOKEN=...     an API token with only "Account Analytics: Read"
set -euo pipefail
days="${1:-30}"
[[ "$days" == <-> ]] || { echo "days must be a number" >&2; exit 1; }
env_file="${STILLREAD_CF_ENV:-$HOME/.config/stillread/cloudflare.env}"
[[ -f "$env_file" ]] || { echo "Missing $env_file (see README.md)." >&2; exit 1; }
[[ "$(stat -f %Lp "$env_file")" == 600 ]] || { echo "$env_file must be chmod 600." >&2; exit 1; }
source "$env_file"

query() {
  curl -sS --fail-with-body "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/analytics_engine/sql" \
    -H "Authorization: Bearer $CF_ANALYTICS_TOKEN" --data-binary "$1"
}

# _sample_interval accounts for Analytics Engine's sampling at high volume.
echo "Downloads, last $days days (download = from the website, update = from Sparkle)"
echo
query "SELECT toDate(timestamp) AS day, blob2 AS source, blob1 AS file, SUM(_sample_interval) AS count
       FROM stillread_downloads
       WHERE timestamp > NOW() - INTERVAL '$days' DAY
       GROUP BY day, source, file ORDER BY day DESC, source, file
       FORMAT TabSeparatedWithNames" | column -t -s $'\t'
echo
query "SELECT blob2 AS source, SUM(_sample_interval) AS total
       FROM stillread_downloads
       WHERE timestamp > NOW() - INTERVAL '$days' DAY
       GROUP BY source ORDER BY source
       FORMAT TabSeparatedWithNames" | column -t -s $'\t'
