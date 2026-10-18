#!/bin/bash
# Puts the Nested Dimensions launcher on your Desktop, ready to double-click.
# Run this in Terminal (running it again updates the launcher):
#   curl -fsSL "https://m8w.github.io/nested-dimensions/launch/install-mac.sh?v=4" | bash
set -e
SRC="https://m8w.github.io/nested-dimensions/launch/Nested%20Dimensions.command?v=$(date +%s)"
DEST="$HOME/Desktop/Nested Dimensions.command"
curl -fsSL "$SRC" -o "$DEST"
chmod +x "$DEST"
xattr -d com.apple.quarantine "$DEST" 2>/dev/null || true
echo "Done. \"Nested Dimensions\" is on your Desktop. Double-click it to start."
