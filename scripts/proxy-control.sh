#!/bin/bash
# AvatarLink proxy control.
# The launchd agent (ai.avatarlink.proxy) is the single source of truth:
# it keeps the safe model/voice/oauth proxy running on :8787, restarts it on
# crash, and starts it at login/boot. This script is a thin, friendly wrapper.
#
#   ./scripts/proxy-control.sh start | stop | restart | status | logs [N]
#
set -uo pipefail

LABEL="ai.avatarlink.proxy"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
PROJ="$HOME/Desktop/avatarlink-companion-studio"
PORT="${AVATARLINK_PROXY_PORT:-8787}"
UID_NUM="$(id -u)"
DOMAIN="gui/${UID_NUM}"

health() { curl -s -m 5 "http://127.0.0.1:${PORT}/api/tts/health" >/dev/null 2>&1; }

load_agent() {
  launchctl bootstrap "$DOMAIN" "$PLIST" 2>/dev/null \
    || launchctl load -w "$PLIST" 2>/dev/null \
    || true
}

unload_agent() {
  launchctl bootout "$DOMAIN/${LABEL}" 2>/dev/null \
    || launchctl unload -w "$PLIST" 2>/dev/null \
    || true
}

case "${1:-status}" in
  start)
    load_agent
    launchctl kickstart "$DOMAIN/${LABEL}" 2>/dev/null || true
    sleep 2
    health && echo "proxy: UP on :${PORT}" || echo "proxy: starting… check 'logs'"
    ;;
  stop)
    unload_agent
    echo "proxy: stopped (agent unloaded)"
    ;;
  restart)
    launchctl kickstart -k "$DOMAIN/${LABEL}" 2>/dev/null \
      || { unload_agent; sleep 1; load_agent; }
    sleep 2
    health && echo "proxy: UP on :${PORT}" || echo "proxy: restarting… check 'logs'"
    ;;
  status)
    if health; then echo "proxy: UP on :${PORT}"; else echo "proxy: DOWN on :${PORT}"; fi
    launchctl print "$DOMAIN/${LABEL}" 2>/dev/null \
      | grep -E "^\s*(state|pid|last exit code) " | sed 's/^/  /' \
      || echo "  (agent not loaded — run: $0 start)"
    ;;
  logs)
    tail -n "${2:-40}" "$PROJ/logs/proxy.err.log" "$PROJ/logs/proxy.out.log" 2>/dev/null \
      || echo "no logs yet at $PROJ/logs/"
    ;;
  *)
    echo "usage: $0 {start|stop|restart|status|logs [N]}"
    exit 1
    ;;
esac
