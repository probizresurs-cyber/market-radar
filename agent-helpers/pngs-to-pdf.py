#!/usr/bin/env python3
"""
pngs-to-pdf.py — Combine a directory of PNG slide screenshots into a single PDF.

Each PNG becomes one PDF page at native resolution.

Usage:
    python3 pngs-to-pdf.py <input-dir> <output.pdf>
"""

import sys
import os
import glob
from PIL import Image


def main():
    if len(sys.argv) < 3:
        print("Usage: python3 pngs-to-pdf.py <input-dir> <output.pdf>", file=sys.stderr)
        sys.exit(1)

    input_dir = sys.argv[1]
    output_pdf = sys.argv[2]

    pngs = sorted(glob.glob(os.path.join(input_dir, "slide-*.png")))
    if not pngs:
        print(f"No slide-*.png files found in {input_dir}", file=sys.stderr)
        sys.exit(1)

    images = [Image.open(p).convert("RGB") for p in pngs]
    images[0].save(output_pdf, save_all=True, append_images=images[1:])
    print(f"Saved {output_pdf} with {len(pngs)} pages")


if __name__ == "__main__":
    main()
