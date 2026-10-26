#!/bin/zsh
# Download counts by day.  Usage: ./counts.sh [days]   (default 30)
# Uses your wrangler login (npx wrangler login), so no token is needed.
set -euo pipefail
cd "${0:A:h}"
days="${1:-30}"
[[ "$days" == <-> ]] || { echo "days must be a number" >&2; exit 1; }
export WRANGLER_SEND_METRICS=false

q() {
  # No 2>/dev/null: if wrangler errors, its message should show, not a bare Python KeyError.
  npx wrangler d1 execute stillread-downloads --remote --json --command "$1" | python3 -c '
import json, sys
data = json.load(sys.stdin)
if not isinstance(data, list):
    print("wrangler did not return the expected result list:", file=sys.stderr)
    print(json.dumps(data, indent=2), file=sys.stderr)
    sys.exit(1)
rows = data[0]["results"]
if not rows: print("  (none yet)"); sys.exit()
cols = list(rows[0])
w = [max(len(c), *(len(str(r[c])) for r in rows)) for c in cols]
print("  " + "  ".join(c.ljust(n) for c, n in zip(cols, w)))
for r in rows: print("  " + "  ".join(str(r[c]).ljust(n) for c, n in zip(cols, w)))'
  echo
}

echo "Downloads, last $days days (download = from the website, update = from Sparkle)\n"
q "SELECT day, source, file, count FROM downloads WHERE day >= date('now', '-$days days') ORDER BY day DESC, source, file"
q "SELECT source, SUM(count) AS total FROM downloads WHERE day >= date('now', '-$days days') GROUP BY source ORDER BY source"
