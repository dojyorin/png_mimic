const BYTE_PER_PIXEL = 3;
const FIXED_CHUNK_LENGTH = 12;

const FILTER_TYPE = 0;

const MAGIC_LENGTH = 8;
const MAGIC_HEX = "89504E470D0A1A0A";
const IEND_LENGTH = 12;
const IEND_HEX = "0000000049454E44AE426082";

const IHDR_LENGTH = 25;
const IHDR_START_BYTE = MAGIC_LENGTH;
const IHDR_TYPE_START_BYTE = IHDR_START_BYTE + 4;
const IHDR_CONTENT_START_BYTE = IHDR_START_BYTE + 8;
const IHDR_CONTENT_END_BYTE = IHDR_START_BYTE + IHDR_LENGTH - 4;

function crc32(data: Uint8Array) {
    let hash = 0xFFFFFFFF;

    for (const n of data) {
        for (let i = 0; i < 8; i++) {
            hash = ((hash ^ n >>> i) & 1 ? 0xEDB88320 : 0) ^ hash >>> 1;
        }
    }

    return hash ^ 0xFFFFFFFF;
}

/**
 * Generate png image from binary.
 * @example
 * ```ts
 * const bin = await Deno.readFile("./example");
 * const png = await encode(bin);
 * const bin_ = await decode(png);
 * ```
 */
export async function encode(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
    const width = Math.ceil(Math.sqrt((4 + data.byteLength) / BYTE_PER_PIXEL));
    const height = width;

    const bytePerWidth = 1 + width * BYTE_PER_PIXEL;
    const idatContent = new Uint8Array(bytePerWidth * height);

    for (let i = 0, j = 0; i < idatContent.byteLength; i += bytePerWidth) {
        if (!i) {
            new DataView(idatContent.buffer).setUint32(1, data.byteLength);
        }

        const offset = !i ? 5 : 1;

        idatContent.set([FILTER_TYPE], i);
        idatContent.set(data.subarray(j, j += bytePerWidth - offset), i + offset);
    }

    const idatContentCompressed = await new Response(new Response(idatContent).body?.pipeThrough(new CompressionStream("deflate"))).bytes();

    const idatLength = FIXED_CHUNK_LENGTH + idatContentCompressed.byteLength;

    const png = new Uint8Array(MAGIC_LENGTH + IHDR_LENGTH + idatLength + IEND_LENGTH);
    const pngView = new DataView(png.buffer);

    png.set(Uint8Array.fromHex(MAGIC_HEX), 0);

    png.set([0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], IHDR_START_BYTE);
    pngView.setUint32(IHDR_CONTENT_START_BYTE, width);
    pngView.setUint32(IHDR_CONTENT_START_BYTE + 4, height);
    pngView.setInt32(IHDR_CONTENT_END_BYTE, crc32(png.subarray(IHDR_TYPE_START_BYTE, IHDR_CONTENT_END_BYTE)));

    const idatStartByte = MAGIC_LENGTH + IHDR_LENGTH;
    const idatTypeStartByte = idatStartByte + 4;
    const idatContentStartByte = idatStartByte + 8;
    const idatContentEndByte = idatStartByte + idatLength - 4;
    pngView.setUint32(idatStartByte, idatContentCompressed.byteLength);
    png.set([0x49, 0x44, 0x41, 0x54], idatTypeStartByte);
    png.set(idatContentCompressed, idatContentStartByte);
    pngView.setInt32(idatContentEndByte, crc32(png.subarray(idatTypeStartByte, idatContentEndByte)));

    png.set(Uint8Array.fromHex(IEND_HEX), png.byteLength - IEND_LENGTH);

    return png;
}

/**
 * Extract binary from png image.
 * @example
 * ```ts
 * const bin = await Deno.readFile("./example");
 * const png = await encode(bin);
 * const bin_ = await decode(png);
 * ```
 */
export async function decode(png: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
    if (png.subarray(0, MAGIC_LENGTH).toHex().toUpperCase() !== MAGIC_HEX) {
        throw new Error("Invalid magic.");
    }

    if (png.subarray(-IEND_LENGTH).toHex().toUpperCase() !== IEND_HEX) {
        throw new Error("Invalid IEND chunk.");
    }

    const pngView = new DataView(png.buffer);

    const width = pngView.getUint32(IHDR_CONTENT_START_BYTE);
    const height = pngView.getUint32(IHDR_CONTENT_START_BYTE + 4);

    if (width * height < 2) {
        throw new Error("Must be at least 2 pixels.");
    }

    const isWidthOnePixel = width === 1;

    if (
        pngView.getUint32(IHDR_START_BYTE) !== 0x0000000D ||
        pngView.getUint32(IHDR_TYPE_START_BYTE) !== 0x49484452 ||
        pngView.getUint32(IHDR_CONTENT_START_BYTE + 8) !== 0x08020000 ||
        pngView.getUint8(IHDR_CONTENT_START_BYTE + 12) !== 0x00 ||
        pngView.getInt32(IHDR_CONTENT_END_BYTE) !== crc32(png.subarray(IHDR_TYPE_START_BYTE, IHDR_CONTENT_END_BYTE))
    ) {
        throw new Error("Invalid IHDR chunk.");
    }

    const idatStartByte = (() => {
        for (let i = MAGIC_LENGTH + IHDR_LENGTH; i < (png.byteLength - IEND_LENGTH);) {
            if (pngView.getUint32(i + 4) === 0x49444154) {
                return i;
            }

            i += FIXED_CHUNK_LENGTH + pngView.getUint32(i);
        }

        throw new Error("IDAT chunk not found.");
    })();

    const idatTypeStartByte = idatStartByte + 4;
    const idatContentStartByte = idatStartByte + 8;
    const idatContentEndByte = idatStartByte + FIXED_CHUNK_LENGTH + pngView.getUint32(idatStartByte) - 4;

    if (pngView.getInt32(idatContentEndByte) !== crc32(png.subarray(idatTypeStartByte, idatContentEndByte))) {
        throw new Error("IDAT chunk CRC not match.");
    }

    const idatContentCompressed = png.subarray(idatContentStartByte, idatContentEndByte);

    const bytePerWidth = 1 + width * BYTE_PER_PIXEL;
    const idatContent = await new Response(new Response(idatContentCompressed).body?.pipeThrough(new DecompressionStream("deflate"))).bytes();
    const idatContentView = new DataView(idatContent.buffer);

    const data = new Uint8Array(isWidthOnePixel ? (((idatContentView.getUint32(1) >>> 8) << 8) | idatContentView.getUint8(6)) >>> 0 : idatContentView.getUint32(1));

    for (let i = 0, j = 0; i < idatContent.byteLength; i += bytePerWidth) {
        if (idatContentView.getUint8(i) !== FILTER_TYPE) {
            throw new Error("Invalid filter type.");
        }

        if (!i && isWidthOnePixel) {
            continue;
        }

        const offset = i === bytePerWidth && isWidthOnePixel ? 2 : !i ? 5 : 1;
        const segment = idatContent.subarray(i + offset , i + bytePerWidth);

        if (j + segment.byteLength > data.byteLength) {
            data.set(segment.subarray(0, data.byteLength - j), j);

            break;
        }

        data.set(segment, j);
        j += segment.byteLength;
    }

    return data;
}