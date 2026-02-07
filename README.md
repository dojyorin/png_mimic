# PNG Mimic
![actions:test](https://github.com/dojyorin/png_mimic/actions/workflows/test.yaml/badge.svg)
![actions:release](https://github.com/dojyorin/png_mimic/actions/workflows/release.yaml/badge.svg)
![shields:license](https://img.shields.io/github/license/dojyorin/png_mimic)
![shields:release](https://img.shields.io/github/release/dojyorin/png_mimic)

## Details
A tool to extract raw data from PNG or generate PNG from raw data.

## Example
```ts
import {encode, decode} from "jsr:@dojyorin/png-mimic";

// Prepare any binary.
const bin = crypto.getRandomValues(new Uint8Array(65536));

// A PNG image containing original binary will be generated.
const png = await encode(bin);

// Extract original binary from PNG image.
const bin_ = await decode(png);

// Output PNG image is `Uint8Array` so it can be written to file or displayed as a DataURL.
await Deno.writeFile("./example.png", png);

// Of course, it can also be run in browser.
const img = document.createElement("img");
img.src = `data:image/png;base64,${png.toBase64()}`;
```

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