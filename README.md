# PNG Mimic
![actions:test](https://github.com/dojyorin/png_mimic/actions/workflows/test.yaml/badge.svg)
![actions:release](https://github.com/dojyorin/png_mimic/actions/workflows/release.yaml/badge.svg)
![shields:license](https://img.shields.io/github/license/dojyorin/png_mimic)
![shields:release](https://img.shields.io/github/release/dojyorin/png_mimic)
![deno:module](https://shield.deno.dev/x/png_mimic)

Mimic binary to PNG.

## Details
A PNG tool that embed binary in IDAT chunk to generate image and extract binary from IDAT chunk within image.

Due to image size, IDAT chunk size may be larger than binary size, in which case difference will be padded with zero.

When extracting binary from image, need to know length of zero padding, so use first 4 bytes of PLTE (Palette value) chunk to store length.

It uses PLTE chunk but saves in 24 bits RGB, so palette contents are not used.

Output image is square, with width and height approximately equal to square root of binary size divided 3.

## Specification

|Property|Value|
|:--|:--|
|Color|24 bits RGB|
|Alpha|No|
|Filter per Line|No|
|Chunks|`IHDR` `PLTE` `IDAT` `IEND`|

## API
See [Deno Document](https://deno.land/x/png_mimic/mod.ts) for details.