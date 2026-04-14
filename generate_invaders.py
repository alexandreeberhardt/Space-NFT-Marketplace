import os
import random

import numpy as np
from PIL import Image, ImageDraw


OUTPUT_DIR = "./invaders"
INVADER_COUNT = 20


def generate_background_grid(canvas_grid_size, rng):
    background = np.zeros((canvas_grid_size, canvas_grid_size, 4), dtype=np.uint8)

    for y in range(canvas_grid_size):
        for x in range(canvas_grid_size):
            if rng.random() < 0.4:
                value = rng.randint(0, 18)
                blue = rng.randint(0, 35)
            else:
                value = rng.randint(0, 55)
                blue = rng.randint(max(value, 15), 95)
            background[y, x] = (0, value // 3, blue, 255)

    return background


def generate_invader_image(seed, canvas_grid_size=20, invader_grid_size=10, pixel_size=20):
    rng = random.Random(seed)
    half_w = invader_grid_size // 2
    grid = np.zeros((invader_grid_size, invader_grid_size), dtype=np.uint8)

    for y in range(invader_grid_size):
        for x in range(half_w):
            fill_prob = 0.45
            if 2 <= y <= 6:
                fill_prob = 0.60
            if rng.random() < fill_prob:
                grid[y, x] = 1

    for y in range(invader_grid_size):
        for x in range(half_w):
            grid[y, invader_grid_size - 1 - x] = grid[y, x]

    eye_y = rng.randint(2, 3)
    left_eye_x = max(1, invader_grid_size // 2 - 2)
    right_eye_x = min(invader_grid_size - 2, invader_grid_size // 2 + 1)
    grid[eye_y, left_eye_x] = 0
    grid[eye_y, right_eye_x] = 0
    if eye_y + 1 < invader_grid_size:
        grid[eye_y + 1, left_eye_x] = 0
        grid[eye_y + 1, right_eye_x] = 0

    background_grid = generate_background_grid(canvas_grid_size, rng)
    img_size = canvas_grid_size * pixel_size
    img = Image.new("RGBA", (img_size, img_size), (0, 0, 0, 255))
    draw = ImageDraw.Draw(img)

    for y in range(canvas_grid_size):
        for x in range(canvas_grid_size):
            x0 = x * pixel_size
            y0 = y * pixel_size
            x1 = x0 + pixel_size - 1
            y1 = y0 + pixel_size - 1
            draw.rectangle((x0, y0, x1, y1), fill=tuple(background_grid[y, x]))

    body_color = (
        rng.randint(80, 255),
        rng.randint(80, 255),
        rng.randint(80, 255),
        255,
    )

    offset = (canvas_grid_size - invader_grid_size) // 2

    for y in range(invader_grid_size):
        for x in range(invader_grid_size):
            if grid[y, x]:
                x0 = (x + offset) * pixel_size
                y0 = (y + offset) * pixel_size
                x1 = x0 + pixel_size - 1
                y1 = y0 + pixel_size - 1
                draw.rectangle((x0, y0, x1, y1), fill=body_color)

    return img


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    for i in range(INVADER_COUNT):
        seed = i
        img = generate_invader_image(seed)
        img.save(os.path.join(OUTPUT_DIR, f"invader_{i + 1:02d}.png"))

    print(f"Images generated in : {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
