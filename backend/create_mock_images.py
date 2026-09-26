"""Run once to create the placeholder "current AEM" images: python create_mock_images.py"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).parent / "static" / "mock-images"
OUT.mkdir(parents=True, exist_ok=True)
(OUT.parent / "generated").mkdir(parents=True, exist_ok=True)


def load_font(size: int):
    for name in ("arial.ttf", "DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


for name, label in [
    ("boring-headphones", "Current: Plain Product Photo"),
    ("boring-lifestyle", "Current: Generic Lifestyle Shot"),
]:
    img = Image.new("RGB", (1200, 675), "#e5e7eb")
    draw = ImageDraw.Draw(img)
    font = load_font(44)
    left, top, right, bottom = draw.textbbox((0, 0), label, font=font)
    draw.text(((1200 - (right - left)) / 2, (675 - (bottom - top)) / 2), label, fill="#9ca3af", font=font)
    img.save(OUT / f"{name}.jpg", quality=90)
    print(f"Created {OUT / f'{name}.jpg'}")
