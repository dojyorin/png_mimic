# **PNG Mimic**
![actions:test](https://github.com/dojyorin/png_mimic/actions/workflows/test.yaml/badge.svg)
![actions:release](https://github.com/dojyorin/png_mimic/actions/workflows/release.yaml/badge.svg)
![shields:license](https://img.shields.io/github/license/dojyorin/png_mimic)
![shields:release](https://img.shields.io/github/release/dojyorin/png_mimic)
![deno:module](https://shield.deno.dev/x/png_mimic)

Mimic any binary to PNG.

# Details
Embed any binary into IDAT chunk and generate image.
Extract binary from IDAT chunk in image.

Due to image size, IDAT chunk size may be larger than binary size, in which case difference will be padded with zero.
When extracting binary from image, need to know length of zero padding, so use gAMA (gamma value) chunk to store length.

Output image is square, with width and height approximately equal to square root of binary size divided 3.

**Requirements**

|Property|Value|
|:--|:--|
|Color|24 bit RGB|
|Alpha|No|
|Filter per Row|No|
|Chunks|`IHDR` `gAMA` `IDAT` `IEND`|

# API
See [Deno Document](https://deno.land/x/png_mimic/mod.ts) for details.