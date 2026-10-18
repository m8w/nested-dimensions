#!/bin/bash
# Nested Dimensions launcher for macOS.
#
# Double-click to open the Nested Dimensions control panel and the visuals windows that were open
# last time (window 1 the first time), in their own browser where:
#   - sound starts by itself (no "Start audio" click needed),
#   - pages keep full speed even when another window covers them,
#   - the Mac doesn't sleep while it runs,
#   - everything opens again by itself if the browser closes or crashes.
# The control panel edits every visuals window, even one that's fullscreen in its own Space,
# and opens more windows (each with its own scene, audio and background).
# It uses its own browser profile, so your everyday Chrome is untouched. The browser is opened by
# macOS itself (not from Terminal), so microphone and camera permission belong to that browser.
#
# Double-click again while it's running: the control panel comes back.
# Stop it: press Control-C in this Terminal window (only this one), or close the window.
#
# Settings (optional), e.g. run from Terminal:  ND_URL=http://localhost:8000/ "./Nested Dimensions.command"
#   ND_URL   site to open (default https://m8w.github.io/nested-dimensions/)

SITE="${ND_URL:-https://m8w.github.io/nested-dimensions/}"
SITE="${SITE%/}/"
SITE="${SITE%index.html/}"
PANEL="${SITE}control.html?launch=1"
PROFILE="$HOME/Library/Application Support/Nested Dimensions Browser"

APP=""
for name in "Google Chrome" "Chromium" "Microsoft Edge" "Brave Browser" "Google Chrome Canary"; do
  for root in "/Applications" "$HOME/Applications"; do
    if [ -d "$root/$name.app" ]; then APP="$root/$name.app"; break 2; fi
  done
done

if [ -z "$APP" ]; then
  echo "Nested Dimensions needs Google Chrome (Chromium, Edge or Brave also work)."
  echo "Install Chrome from https://www.google.com/chrome/ and double-click this file again."
  read -r -p "Press Return to close. " _
  exit 1
fi

mkdir -p "$PROFILE"
FLAGS=(
  --user-data-dir="$PROFILE"
  --no-first-run
  --no-default-browser-check
  --autoplay-policy=no-user-gesture-required
  --disable-popup-blocking
  --disable-background-timer-throttling
  --disable-renderer-backgrounding
  --disable-backgrounding-occluded-windows
  --window-position=0,0
  --window-size=580,1000
)

running() { pgrep -f -- "--user-data-dir=$PROFILE" >/dev/null 2>&1; }
panel() { open -n -a "$APP" --args "${FLAGS[@]}" --app="$PANEL"; }

if running && [ "${1:-}" != "--watch" ]; then
  # already running from an earlier launch: just bring the control panel back
  panel
  echo "Nested Dimensions is already running. The control panel is open again."
  sleep 2
  exit 0
fi

# keep the display and the Mac awake while this runs
caffeinate -dims &
AWAKE=$!

stop() {
  echo
  echo "Stopping Nested Dimensions."
  pkill -f -- "--user-data-dir=$PROFILE" 2>/dev/null
  kill "$AWAKE" 2>/dev/null
  exit 0
}
trap stop INT TERM HUP

echo "Nested Dimensions"
echo "  site:    $SITE"
echo "  browser: $(basename "$APP" .app)"
echo "The control panel opens with the visuals windows. Double-click the launcher again to bring the panel back."
echo "Keep this window open. Press Control-C here to stop."
echo

while true; do
  if ! running; then
    panel
    sleep 10
    running || echo "$(date '+%Y-%m-%d %H:%M:%S')  The browser didn't start. Trying again shortly."
  fi
  sleep 5
  if ! running; then
    echo "$(date '+%Y-%m-%d %H:%M:%S')  The browser closed. Opening it again in 10 seconds (Control-C to stop)."
    sleep 10
  fi
done
