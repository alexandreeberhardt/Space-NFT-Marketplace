"""
extract_attributes.py
Extracts per-NFT attributes (seed, body color) from the deterministic generator
and writes scripts/attributes.json for use by uploadToIPFS.ts.
"""
import json
import os
import random
import sys

# Match generate_invaders.py constants
INVADER_COUNT = 20
CANVAS_GRID_SIZE = 20
INVADER_GRID_SIZE = 10


def get_body_color(seed: int) -> tuple:
    """Reproduce the RNG sequence from generate_invaders.py up to body_color."""
    rng = random.Random(seed)
    half_w = INVADER_GRID_SIZE // 2

    # Step 1 - generate invader grid (consumes RNG slots)
    for y in range(INVADER_GRID_SIZE):
        for x in range(half_w):
            fill_prob = 0.45
            if 2 <= y <= 6:
                fill_prob = 0.60
            rng.random()  # consume slot

    # Step 2 - eye position
    rng.randint(2, 3)

    # Step 3 - background grid (consumes many RNG slots)
    for _ in range(CANVAS_GRID_SIZE * CANVAS_GRID_SIZE):
        if rng.random() < 0.4:
            rng.randint(0, 18)
            rng.randint(0, 35)
        else:
            val = rng.randint(0, 55)
            rng.randint(max(val, 15), 95)

    # Step 4 - body color (this is what we want)
    r = rng.randint(80, 255)
    g = rng.randint(80, 255)
    b = rng.randint(80, 255)
    return (r, g, b)


def main():
    attributes = {}
    for i in range(INVADER_COUNT):
        seed = i
        r, g, b = get_body_color(seed)
        attributes[str(i + 1)] = {
            "seed": seed,
            "bodyColor": f"rgb({r},{g},{b})",
        }
        print(f"Token #{i + 1}: seed={seed}, color=rgb({r},{g},{b})")

    out_path = os.path.join(os.path.dirname(__file__), "attributes.json")
    with open(out_path, "w") as f:
        json.dump(attributes, f, indent=2)

    print(f"\nAttributes saved to {out_path}")


if __name__ == "__main__":
    main()
