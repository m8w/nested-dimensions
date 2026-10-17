#!/bin/bash
# Puts the Nested Dimensions launcher on your Desktop, ready to double-click.
# Run this in Terminal:
#   curl -fsSL https://m8w.github.io/nested-dimensions/launch/install-mac.sh | bash
set -e
SRC="https://m8w.github.io/nested-dimensions/launch/Nested%20Dimensions.command"
DEST="$HOME/Desktop/Nested Dimensions.command"
curl -fsSL "$SRC" -o "$DEST"
chmod +x "$DEST"
xattr -d com.apple.quarantine "$DEST" 2>/dev/null || true
echo "Done. \"Nested Dimensions\" is on your Desktop. Double-click it to start."
