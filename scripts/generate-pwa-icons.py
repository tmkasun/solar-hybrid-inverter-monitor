#!/usr/bin/env python3
"""Render the geometry in frontend/public/icons/icon.svg (requires Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw


def render(size: int, scale: float = 1.0) -> Image.Image:
    supersampling = 4
    image = Image.new("RGB", (size * supersampling, size * supersampling), "#101b22")
    draw = ImageDraw.Draw(image)
    factor = size * supersampling / 512

    def point(x, y):
        return ((256 + (x - 256) * scale) * factor, (256 + (y - 256) * scale) * factor)

    width = round(20 * factor * scale)
    for start, end in [((256, 64), (256, 106)), ((256, 406), (256, 448)),
                       ((64, 256), (106, 256)), ((406, 256), (448, 256)),
                       ((120, 120), (150, 150)), ((362, 362), (392, 392)),
                       ((120, 392), (150, 362)), ((362, 150), (392, 120))]:
        draw.line([point(*start), point(*end)], fill="#f7c948", width=width)
        for x, y in [point(*start), point(*end)]:
            draw.ellipse((x - width / 2, y - width / 2, x + width / 2, y + width / 2), fill="#f7c948")
    draw.ellipse((*point(162, 162), *point(350, 350)), fill="#f7c948")
    bolt = [point(x, y) for x, y in [(292, 145), (204, 275), (251, 275), (224, 370), (326, 229), (273, 229)]]
    draw.polygon(bolt, fill="#75e2b4")
    draw.line(bolt + [bolt[0]], fill="#101b22", width=round(12 * factor * scale), joint="curve")
    return image.resize((size, size), Image.Resampling.LANCZOS)


if __name__ == "__main__":
    destination = Path(__file__).resolve().parents[1] / "frontend" / "public" / "icons"
    destination.mkdir(parents=True, exist_ok=True)
    for name, size, scale in [("icon-192.png", 192, 1), ("icon-512.png", 512, 1),
                              ("icon-maskable-512.png", 512, 0.78), ("apple-touch-icon.png", 180, 0.9)]:
        render(size, scale).save(destination / name, optimize=True)
