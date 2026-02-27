#!/usr/bin/env python3
"""
Copy icons from the parent project into client-windows/assets/icons/
Run from the client-windows/ directory:
  python prepare-icons.py
"""
import os, shutil, pathlib

SRC   = pathlib.Path('../public/icons')
DST   = pathlib.Path('assets/icons')

TRAY_NEED = ['tray-connected.png', 'tray-disconnected.png']

DST.mkdir(parents=True, exist_ok=True)

# Copy PNG icons from parent project
copied = 0
for f in SRC.glob('*.png'):
    shutil.copy2(f, DST / f.name)
    print(f'  copied {f.name}')
    copied += 1

# Copy icon-192x192.png as tray icons if dedicated tray icons don't exist
src_tray = DST / 'icon-192x192.png'
for tray_name in TRAY_NEED:
    dst_tray = DST / tray_name
    if not dst_tray.exists() and src_tray.exists():
        shutil.copy2(src_tray, dst_tray)
        print(f'  created placeholder {tray_name}')

print(f'\n✓ {copied} icons copied to {DST}')
print('Note: Convert icon-512x512.png → icon.ico using https://convertio.co or:')
print('  magick icon-512x512.png -resize 256x256 assets/icons/icon.ico')
