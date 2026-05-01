#!/usr/bin/env bash
# render-deck.sh — One-shot HTML → PDF + PPTX renderer for the agent.
#
# Usage:
#   bash render-deck.sh <html-path> [out-dir]
#
# Outputs in <out-dir> (defaults to dirname of html):
#   slides/slide-001.png … slide-NNN.png
#   presentation.pdf
#   presentation.pptx
#
# Prerequisites on VPS:
#   - playwright (global) + chromium browser
#   - python-pptx, Pillow

set -euo pipefail

HTML="${1:-}"
if [[ -z "$HTML" || ! -f "$HTML" ]]; then
    echo "Usage: bash render-deck.sh <html-path> [out-dir]" >&2
    exit 1
fi

OUT_DIR="${2:-$(dirname "$HTML")}"
SLIDES_DIR="$OUT_DIR/slides"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "$SLIDES_DIR"

echo "→ Rendering HTML to PNG slides..."
node "$SCRIPT_DIR/html-to-pngs.mjs" "$HTML" "$SLIDES_DIR"

echo "→ Building PPTX..."
python3 "$SCRIPT_DIR/pngs-to-pptx.py" "$SLIDES_DIR" "$OUT_DIR/presentation.pptx"

echo "→ Building PDF..."
python3 "$SCRIPT_DIR/pngs-to-pdf.py" "$SLIDES_DIR" "$OUT_DIR/presentation.pdf"

echo ""
echo "✓ Done. Files in $OUT_DIR:"
ls -lh "$OUT_DIR/presentation.pptx" "$OUT_DIR/presentation.pdf" 2>/dev/null || true
