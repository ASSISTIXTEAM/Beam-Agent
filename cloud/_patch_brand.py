#!/usr/bin/env python3
from pathlib import Path

live = Path(__file__).resolve().parent / "live" / "lib" / "brand.php"
ship = Path(__file__).resolve().parent / "ship" / "lib" / "brand.php"
text = live.read_text(encoding="utf-8")
old = """    return match ($key) {
        'FLAIR' => 'FLAIR',
        'PINE' => 'PINE',
        'VISION', 'SIGHT' => 'Sight',
        'GUEST' => 'FLAIR',
        default => 'FLAIR',
    };"""
new = """    return match ($key) {
        'TIDE' => 'Tide',
        'FLARE', 'FLAIR' => 'Flare',
        'PINE' => 'Pine',
        'VISION', 'SIGHT' => 'Sight',
        'GUEST' => 'Tide',
        default => 'Tide',
    };"""
if old in text:
    text = text.replace(old, new)
    print("brand label patched")
else:
    print("brand label pattern miss")
ship.write_text(text, encoding="utf-8")
print("wrote", ship.stat().st_size)
