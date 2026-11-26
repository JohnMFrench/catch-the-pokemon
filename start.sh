#!/usr/bin/env bash
# Play Catch the Pokémon: serves the game and opens it in the browser.
# Binds to all interfaces so a phone on the same Wi-Fi can join in.
set -euo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-8088}"

lan_ip() {
  # the address this machine uses to reach the outside world = its LAN address
  ip -4 route get 1.1.1.1 2>/dev/null |
    awk '{ for (i = 1; i <= NF; i++) if ($i == "src") { print $(i + 1); exit } }'
}

IP="$(lan_ip || true)"
if [ -z "${IP:-}" ]; then
  IP="$(hostname -I 2>/dev/null | awk '{ print $1 }')"
fi
if [ -z "${IP:-}" ]; then
  IP="<this-computer-ip>"
fi

cat <<EOF

  Catch the Pokémon

    this computer : http://127.0.0.1:${PORT}/
    phone / tablet: http://${IP}:${PORT}/     <- same Wi-Fi, turn it sideways

  Ctrl+C to stop. Only this folder is shared, nothing else.

EOF

open_it() {
  sleep 0.7
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "http://127.0.0.1:${PORT}/" >/dev/null 2>&1 || true
  elif command -v open >/dev/null 2>&1; then open "http://127.0.0.1:${PORT}/" >/dev/null 2>&1 || true
  fi
}
open_it &

exec python3 -m http.server "$PORT" --bind 0.0.0.0
