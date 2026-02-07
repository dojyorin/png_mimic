# PNG Mimic
![actions:test](https://github.com/dojyorin/png_mimic/actions/workflows/test.yaml/badge.svg)
![actions:release](https://github.com/dojyorin/png_mimic/actions/workflows/release.yaml/badge.svg)
![shields:license](https://img.shields.io/github/license/dojyorin/png_mimic)
![shields:release](https://img.shields.io/github/release/dojyorin/png_mimic)

## Details
A PNG tool that embed binary in IDAT chunk to generate image and extract binary from IDAT chunk within image.

## Specification
- Color Depth: 8 bits
- Color Type: RGB
- Filter: No

Common:

- First 4 bytes are body size, followed by body itself, with remainder from end of body to last pixel with zero-padded.

Input:

- If multiple IDAT chunks exist, only first one is read.
- Must be least 2 pixels.

Output:

- Image is square.

## API
### `encode(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>>`
### `decode(png: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>>`