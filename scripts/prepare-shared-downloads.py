#!/usr/bin/env python3
"""Exclude duplicate edition binaries from the Site build; the route streams Pages copies."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
for name in ('top-study.pdf', 'bottom-study.pdf', 'interview-100.pdf', 'interview-framework.pdf'):
    original = root / 'public' / 'downloads' / name
    if not original.is_file():
        raise SystemExit('Missing source edition: ' + name)
    generated = root / 'dist' / 'client' / 'downloads' / name
    if generated.exists():
        generated.unlink()
print('Edition source files preserved; Site download routes use the existing Pages copies.')
