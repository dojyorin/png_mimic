# PNG Mimic
![actions:test](https://github.com/dojyorin/png_mimic/actions/workflows/test.yaml/badge.svg)
![actions:release](https://github.com/dojyorin/png_mimic/actions/workflows/release.yaml/badge.svg)
![shields:license](https://img.shields.io/github/license/dojyorin/png_mimic)
![shields:release](https://img.shields.io/github/release/dojyorin/png_mimic)

## Details
A tool to extract raw data from PNG or generate PNG from raw data.

## Specification
Image formats supported by this tool are:

- Color Depth: 8 bits
- Color Type: RGB
- Filter: No
- Chunks: IHDR, IDAT, IEND

Only simplest minimum chunk configuration consisting of only one IDAT is supported.

### Byte Structure
Byte structure of raw data stored in IDAT chunk are:

|Start byte|End byte|Field|Details|
|:--|:--|:--|:--|
|0|3|Length|Store file size as a uint32.|
|4|4 + {Length}|Body|This is file content.|
|4 + {Length} + 1|Last|Pad|Zero padding.|

In most cases, number of pixels is set larger than body size, and since body size and number of pixels rarely match exactly, remaining pixels are padded with zeros.

## API
- `encode(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>>`
- `decode(png: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>>`