#!/bin/bash
# Nested Dimensions launcher for macOS.
#
# Double-click to open Nested Dimensions fullscreen in its own browser window where:
#   - sound starts by itself (no "Start audio" tap needed),
#   - the page keeps full speed even when another window covers it,
#   - the Mac doesn't sleep while it runs,
#   - the window opens again by itself if the browser closes or crashes.
# It uses its own browser profile, so your everyday Chrome windows, tabs and settings are untouched.
# The browser is opened by macOS itself (not from Terminal), so microphone and camera
# permission belong to Chrome; Terminal never needs them and never needs restarting.
#
# Get to it: Command-Tab to the second Chrome icon (or click it in the Dock).
# Stop it: press Control-C in this Terminal window, or close the window. Only this window.
#
# Settings (optional), e.g. run from Terminal:  ND_WINDOW=1 "./Nested Dimensions.command"
#   ND_URL       page to open          (default https://m8w.github.io/nested-dimensions/)
#   ND_WINDOW=1  a window instead of fullscreen
#   ND_WIDTH     window width          (default 1920)
#   ND_HEIGHT    window height         (default 1080)

URL="${ND_URL:-https://m8w.github.io/nested-dimensions/}"
WIDTH="${ND_WIDTH:-1920}"
HEIGHT="${ND_HEIGHT:-1080}"
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
  --disable-background-timer-throttling
  --disable-renderer-backgrounding
  --disable-backgrounding-occluded-windows
  --window-position=0,0
  --window-size="$WIDTH,$HEIGHT"
  --app="$URL"
)
[ "${ND_WINDOW:-0}" = "1" ] || FLAGS+=(--start-fullscreen)

running() { pgrep -f -- "--user-data-dir=$PROFILE" >/dev/null 2>&1; }

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
echo "  page:    $URL"
echo "  browser: $(basename "$APP" .app)"
echo "Get to it with Command-Tab (the second Chrome icon)."
echo "Keep this window open. Press Control-C here to stop."
echo

while true; do
  if ! running; then
    # opened through macOS, so the browser is its own app with its own permissions
    open -n -a "$APP" --args "${FLAGS[@]}"
    sleep 10
    running || echo "$(date '+%Y-%m-%d %H:%M:%S')  The browser didn't start. Trying again shortly."
  fi
  sleep 5
  if ! running; then
    echo "$(date '+%Y-%m-%d %H:%M:%S')  The browser closed. Opening it again in 10 seconds (Control-C to stop)."
    sleep 10
  fi
done
