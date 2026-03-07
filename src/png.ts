const BYTE_PER_PIXEL = 3;
const FIXED_CHUNK_LENGTH = 12;

const FILTER_LENGTH = 1;
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

const IDAT_START_BYTE = MAGIC_LENGTH + IHDR_LENGTH;
const IDAT_TYPE_START_BYTE = IDAT_START_BYTE + 4;
const IDAT_CONTENT_START_BYTE = IDAT_START_BYTE + 8;

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
 * const bin = crypto.getRandomValues(new Uint8Array(65536));
 * const png = await encode(bin);
 * const bin_ = await decode(png);
 * ```
 */
export async function encode(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
    const width = Math.ceil(Math.sqrt((4 + data.byteLength) / BYTE_PER_PIXEL));
    const height = width;

    const bytePerWidth = FILTER_LENGTH + width * BYTE_PER_PIXEL;
    const idatContent = new Uint8Array(bytePerWidth * height);

    new DataView(idatContent.buffer).setUint32(FILTER_LENGTH, data.byteLength);

    for (let i = 0, j = 0; i < idatContent.byteLength; i += bytePerWidth) {
        const offset = FILTER_LENGTH + (i ? 0 : 4);
        const bytePerWidthContent = bytePerWidth - offset;
        const contentPerWidthStartByte = i + offset;

        idatContent.set([FILTER_TYPE], i);
        idatContent.set(data.subarray(j, j += bytePerWidthContent), contentPerWidthStartByte);
    }

    const idatContentCompressed = await new Response(new Response(idatContent).body?.pipeThrough(new CompressionStream("deflate"))).bytes();

    const idatLength = FIXED_CHUNK_LENGTH + idatContentCompressed.byteLength;
    const idatContentEndByte = IDAT_START_BYTE + idatLength - 4;

    const png = new Uint8Array(MAGIC_LENGTH + IHDR_LENGTH + idatLength + IEND_LENGTH);
    const pngView = new DataView(png.buffer);

    png.set(Uint8Array.fromHex(MAGIC_HEX), 0);

    png.set([0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0x02], IHDR_START_BYTE);
    pngView.setUint32(IHDR_CONTENT_START_BYTE, width);
    pngView.setUint32(IHDR_CONTENT_START_BYTE + 4, height);
    pngView.setInt32(IHDR_CONTENT_END_BYTE, crc32(png.subarray(IHDR_TYPE_START_BYTE, IHDR_CONTENT_END_BYTE)));

    pngView.setUint32(IDAT_START_BYTE, idatContentCompressed.byteLength);
    png.set([0x49, 0x44, 0x41, 0x54], IDAT_TYPE_START_BYTE);
    png.set(idatContentCompressed, IDAT_CONTENT_START_BYTE);
    pngView.setInt32(idatContentEndByte, crc32(png.subarray(IDAT_TYPE_START_BYTE, idatContentEndByte)));

    png.set(Uint8Array.fromHex(IEND_HEX), png.byteLength - IEND_LENGTH);

    return png;
}

/**
 * Extract binary from png image.
 * @example
 * ```ts
 * const bin = crypto.getRandomValues(new Uint8Array(65536));
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

    if (
        pngView.getUint32(IHDR_START_BYTE) !== 0x0000000D ||
        pngView.getUint32(IHDR_TYPE_START_BYTE) !== 0x49484452 ||
        pngView.getUint32(IHDR_CONTENT_START_BYTE + 8) !== 0x08020000 ||
        pngView.getUint8(IHDR_CONTENT_START_BYTE + 12) !== 0x00 ||
        pngView.getInt32(IHDR_CONTENT_END_BYTE) !== crc32(png.subarray(IHDR_TYPE_START_BYTE, IHDR_CONTENT_END_BYTE))
    ) {
        throw new Error("Invalid IHDR chunk.");
    }

    const width = pngView.getUint32(IHDR_CONTENT_START_BYTE);
    const _height = pngView.getUint32(IHDR_CONTENT_START_BYTE + 4);

    if (width < 2) {
        throw new Error("Must be at least 2 pixels wide.");
    }

    const idatLength = FIXED_CHUNK_LENGTH + pngView.getUint32(IDAT_START_BYTE);
    const idatContentEndByte = IDAT_START_BYTE + idatLength - 4;

    if (
        pngView.getUint32(IDAT_TYPE_START_BYTE) !== 0x49444154 ||
        pngView.getInt32(idatContentEndByte) !== crc32(png.subarray(IDAT_TYPE_START_BYTE, idatContentEndByte))
    ) {
        throw new Error("Invalid IDAT chunk.");
    }

    const idatContentCompressed = png.subarray(IDAT_CONTENT_START_BYTE, idatContentEndByte);

    const bytePerWidth = FILTER_LENGTH + width * BYTE_PER_PIXEL;
    const idatContent = await new Response(new Response(idatContentCompressed).body?.pipeThrough(new DecompressionStream("deflate"))).bytes();

    const data = new Uint8Array(new DataView(idatContent.buffer).getUint32(FILTER_LENGTH));

    for (let i = 0, j = 0; i < idatContent.byteLength; i += bytePerWidth) {
        if (idatContent[i] !== FILTER_TYPE) {
            throw new Error("Invalid filter type.");
        }

        const offset = FILTER_LENGTH + (i ? 0 : 4);
        const bytePerWidthContent = bytePerWidth - offset;
        const contentPerWidthStartByte = i + offset;

        if (j + bytePerWidthContent > data.byteLength) {
            data.set(idatContent.subarray(contentPerWidthStartByte, contentPerWidthStartByte + data.byteLength - j), j);

            break;
        } else {
            data.set(idatContent.subarray(contentPerWidthStartByte, i + bytePerWidth), j);
            j += bytePerWidthContent;
        }
    }

    return data;
}