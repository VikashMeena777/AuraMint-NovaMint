# Screenshot capture integrity smoke test

Tested locally with Python and Pillow 11.3.0. Existing image files were not modified. No external service or credentials were used.

## Scope and method

For each of the five named captures:
- Checked the PNG signature, every chunk CRC, presence of IEND, truncation, and trailing bytes.
- Ran Pillow verify(), reopened the image, and fully decoded it using load().
- Measured dimensions, alpha range, exact distinct RGB colors, dominant-color fraction, and per-channel standard deviation.
- Tested for an exactly uniform frame and full transparency.

This is a mechanical integrity check, NOT a visual acceptance review. A nonuniform error page, skeleton, stale page, or incorrect layout can pass these checks. Text legibility, clipping, composition, icons, page identity, authentication state, and full-page coverage are not established.

## Results

| File | Dimensions | Distinct RGB colors | Most common color share | Integrity / exact uniformity |
|---|---|---:|---:|---|
| mobile-dashboard.png | 390 × 844 | 7,769 | 37.7655% | Pass / nonuniform |
| mobile-home.png | 390 × 844 | 9,212 | 51.6023% | Pass / nonuniform |
| desktop-home.png | 1440 × 900 | 16,334 | 52.7001% | Pass / nonuniform |
| desktop-home-full.png | 1430 × 5033 | 13,965 | 52.6057% | Pass / nonuniform |
| desktop-login.png | 1440 × 900 | 20,833 | 37.6146% | Pass / nonuniform |

All five are RGB PNGs, decode fully, pass every chunk CRC, have IEND with no trailing bytes, and are fully opaque. None is a single-color or transparent blank frame. These tests do not rule out other kinds of visually empty or incorrect capture.

### Dimension flag, not a demonstrated application defect

The test expected a 1440-pixel-wide desktop full-page capture based on the recorded viewport. `desktop-home-full.png` is instead 1430 pixels wide, 10 pixels narrower than `desktop-home.png`. It was therefore flagged by the dimension assertion. Scrollbar exclusion is one possible explanation, but no cause can be established from these files alone. Do not label it corruption, clipping, or a product defect without additional evidence. All four viewport-sized captures match the recorded dimensions.

## File fingerprints (SHA-256)

- mobile-dashboard.png: `31f9f5c5f921b28d1cd5858f07d738cf52b5b7be65f4dc724765c853ef6b298d`
- mobile-home.png: `64830a55d4e1ad71d0ac566c17e3bc27be5fef9558569d3bfa11139e6dbe2c83`
- desktop-home.png: `bc9d6fba08ccae48fa4be55134c0bf5b0d8a72d4abd5768a90cecf538a0d8592`
- desktop-home-full.png: `0c02cb07f249be49b5032e9bf71db6c7f6dbf78f36f12be81d2956717ba2508e`
- desktop-login.png: `59e64a5e1a11997b6da01d3e69c05dd05f7b83ef2279c49361740053025e7c9a`

## Acceptance status

Appearance review remains BLOCKED: prior main-agent and reviewer image reads explicitly omitted image content. This smoke test does not close visual review, native Enter/physical mobile interaction confirmation, provider checkout/webhook verification, or production acceptance.
