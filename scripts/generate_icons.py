#!/usr/bin/env python3
"""Generate IonMan DNS PWA icons — lightning bolt on dark background."""

from PIL import Image, ImageDraw, ImageFont
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'icons')
os.makedirs(OUT_DIR, exist_ok=True)

# IonMan DNS brand colors
BG_COLOR = (10, 10, 15)        # #0A0A0F
PRIMARY  = (0, 212, 255)       # #00D4FF cyan
ACCENT   = (255, 7, 58)        # #FF073A red

SIZES = [48, 72, 96, 128, 144, 152, 192, 384, 512]

def draw_icon(size):
    """Draw IonMan DNS icon: dark bg + cyan lightning bolt + red glow."""
    img = Image.new('RGBA', (size, size), BG_COLOR + (255,))
    draw = ImageDraw.Draw(img)
    
    # Padding
    p = size * 0.12
    cx, cy = size / 2, size / 2
    
    # Draw a stylized lightning bolt
    # Scale factor
    s = size / 512.0
    
    # Lightning bolt polygon points (centered, scaled)
    bolt = [
        (cx - 30*s, cy - 200*s),   # top-left
        (cx + 80*s, cy - 200*s),   # top-right
        (cx + 20*s, cy - 30*s),    # middle-right notch
        (cx + 100*s, cy - 30*s),   # right wing
        (cx - 50*s, cy + 210*s),   # bottom point
        (cx + 10*s, cy + 20*s),    # middle-left notch
        (cx - 70*s, cy + 20*s),    # left wing
    ]
    
    # Outer glow (larger, semi-transparent cyan)
    glow_offset = 8 * s
    glow_bolt = [(x, y) for x, y in bolt]
    for offset in [6*s, 4*s, 2*s]:
        glow_img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        glow_draw = ImageDraw.Draw(glow_img)
        glow_pts = [(x + (x - cx) * offset / 100, y + (y - cy) * offset / 100) for x, y in bolt]
        alpha = int(40 - offset * 3)
        glow_draw.polygon(glow_pts, fill=PRIMARY[:2] + (PRIMARY[2],) + (max(alpha, 10),))
        img = Image.alpha_composite(img, glow_img)
    
    draw = ImageDraw.Draw(img)
    
    # Main bolt — cyan
    draw.polygon(bolt, fill=PRIMARY + (255,))
    
    # Small red accent dot at bottom
    dot_r = 12 * s
    dot_cx = cx + 40 * s
    dot_cy = cy - 140 * s
    draw.ellipse([dot_cx - dot_r, dot_cy - dot_r, dot_cx + dot_r, dot_cy + dot_r], fill=ACCENT + (200,))
    
    return img

def draw_maskable_icon(size):
    """Maskable icon with safe zone padding (icon in center 80%)."""
    img = Image.new('RGBA', (size, size), BG_COLOR + (255,))
    # Draw the icon at 80% size and paste centered
    inner_size = int(size * 0.7)
    inner = draw_icon(inner_size)
    offset = (size - inner_size) // 2
    img.paste(inner, (offset, offset), inner)
    return img

for s in SIZES:
    # Regular icon
    icon = draw_icon(s)
    icon.save(os.path.join(OUT_DIR, f'icon-{s}x{s}.png'))
    print(f'  ✓ icon-{s}x{s}.png')

    # Maskable (for Android adaptive icons)
    if s >= 192:
        maskable = draw_maskable_icon(s)
        maskable.save(os.path.join(OUT_DIR, f'maskable-{s}x{s}.png'))
        print(f'  ✓ maskable-{s}x{s}.png')

print(f'\nAll icons generated in {os.path.abspath(OUT_DIR)}')
