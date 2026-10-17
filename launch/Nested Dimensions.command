#!/bin/bash
# Nested Dimensions launcher for macOS.
#
# Double-click to open Nested Dimensions in its own browser window where:
#   - sound starts by itself (no "Start audio" tap needed),
#   - the page keeps full speed even when another window covers it,
#   - the Mac doesn't sleep while it runs,
#   - the window opens again by itself if the browser closes or crashes.
# It uses its own browser profile, so your everyday Chrome windows, tabs and settings are untouched.
# The first time, allow the microphone, camera or MIDI in that window if you use them; it remembers.
#
# Stop it: press Control-C in this Terminal window, or close the window.
#
# Settings (optional), e.g. run from Terminal:  ND_WIDTH=1280 ND_HEIGHT=720 "./Nested Dimensions.command"
#   ND_URL      page to open      (default https://m8w.github.io/nested-dimensions/)
#   ND_WIDTH    window width      (default 1920)
#   ND_HEIGHT   window height     (default 1080)
#   ND_FULL=1   open fullscreen instead of a window

URL="${ND_URL:-https://m8w.github.io/nested-dimensions/}"
WIDTH="${ND_WIDTH:-1920}"
HEIGHT="${ND_HEIGHT:-1080}"
PROFILE="$HOME/Library/Application Support/Nested Dimensions Browser"

BIN=""
for app in "Google Chrome" "Chromium" "Microsoft Edge" "Brave Browser" "Google Chrome Canary"; do
  for root in "/Applications" "$HOME/Applications"; do
    candidate="$root/$app.app/Contents/MacOS/$app"
    if [ -x "$candidate" ]; then BIN="$candidate"; break 2; fi
  done
done

if [ -z "$BIN" ]; then
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
[ "${ND_FULL:-0}" = "1" ] && FLAGS+=(--start-fullscreen)

echo "Nested Dimensions"
echo "  page:    $URL"
echo "  browser: ${BIN##*/}"
echo "Keep this window open. Press Control-C here to stop."
echo

trap 'echo; echo "Stopped."; exit 0' INT TERM

while true; do
  if pgrep -f -- "--user-data-dir=$PROFILE" >/dev/null 2>&1; then
    # already open (from an earlier launch): just watch it
    sleep 5
    continue
  fi
  # caffeinate keeps the display and the Mac awake for as long as the browser runs
  caffeinate -dims "$BIN" "${FLAGS[@]}" >/dev/null 2>&1
  echo "$(date '+%Y-%m-%d %H:%M:%S')  The browser closed. Opening it again in 10 seconds (Control-C to stop)."
  sleep 10
done
