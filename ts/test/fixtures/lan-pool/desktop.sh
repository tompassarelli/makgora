#!/bin/sh
# Stand-in for private-desktop.sh start, after wisp's own test fixture: it starts the pair agent stand-in and stops it with the desktop.
[ "$1" = start ] || exit 2
shift
while [ $# -gt 0 ] && [ "$1" != -- ]; do shift; done
mkdir -p "$WISP_TEST_DESKTOPS"
run=$(mktemp -d "$WISP_TEST_DESKTOPS/run.XXXXXX")
touch "$run/lifecycle-owned" "$run/active"
echo "Run: $run"
agent=""
if [ "$1" = -- ]; then
  while [ $# -gt 0 ] && [ "${1%pairAgent.ts}" = "$1" ]; do shift; done
  shift
  PRIVATE_DESKTOP_RUN=$run env -u WISP_TEST_SCOPE "$WISP_TEST_BUN" "$(dirname "$0")/agent.ts" "$@" &
  agent=$!
else
  sleep 600 &
fi
trap '[ -n "$agent" ] && kill -KILL "$agent"; rm -rf "$run"; exit 0' TERM INT
wait
