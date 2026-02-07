const BYTE_PER_PIXEL = 3;
const MAGIC_HEX = "89504E470D0A1A0A";
const MAGIC_LENGTH = 8;
const IHDR_LENGTH = 25;
const IEND_HEX = "0000000049454E44AE426082";
const IEND_LENGTH = 12;

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
 * Output format is 24 bits RGB with no filter.
 * Output image is square.
 * @example
 * ```ts
 * const bin = await Deno.readFile("./example");
 * const png = await encode(bin);
 * const bin_ = await decode(png);
 * ```
 */
export async function encode(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
    const width = Math.ceil(Math.sqrt((Uint32Array.BYTES_PER_ELEMENT + data.byteLength) / BYTE_PER_PIXEL));
    const height = width;

    const bytePerWidth = Uint8Array.BYTES_PER_ELEMENT + width * BYTE_PER_PIXEL;
    const idatContent = new Uint8Array(bytePerWidth * height);

    for (let i = 0, j = 0; i < idatContent.byteLength; i += bytePerWidth) {
        if (!i) {
            new DataView(idatContent.buffer).setUint32(1, data.byteLength);
        }

        const offset = !i ? 5 : 1;

        idatContent.set([0x00], i);
        idatContent.set(data.subarray(j, j += bytePerWidth - offset), i + offset);
    }

    const idatContentCompressed = await new Response(new Response(idatContent).body?.pipeThrough(new CompressionStream("deflate"))).bytes();

    const idatLength = Uint32Array.BYTES_PER_ELEMENT * 3 + idatContentCompressed.byteLength;

    const png = new Uint8Array(MAGIC_LENGTH + IHDR_LENGTH + idatLength + IEND_LENGTH);
    const pngView = new DataView(png.buffer);

    png.set(Uint8Array.fromHex(MAGIC_HEX), 0);

    png.set([0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], MAGIC_LENGTH);
    pngView.setUint32(MAGIC_LENGTH + 8, width);
    pngView.setUint32(MAGIC_LENGTH + 12, height);
    pngView.setInt32(MAGIC_LENGTH + 21, crc32(png.subarray(MAGIC_LENGTH + 4, MAGIC_LENGTH + 21)));

    pngView.setUint32(MAGIC_LENGTH + IHDR_LENGTH, idatContentCompressed.byteLength);
    png.set([0x49, 0x44, 0x41, 0x54], MAGIC_LENGTH + IHDR_LENGTH + 4);
    png.set(idatContentCompressed, MAGIC_LENGTH + IHDR_LENGTH + 8);
    pngView.setInt32(MAGIC_LENGTH + IHDR_LENGTH + idatLength - 4, crc32(png.subarray(MAGIC_LENGTH + IHDR_LENGTH + 4, MAGIC_LENGTH + IHDR_LENGTH + idatLength - 4)));

    png.set(Uint8Array.fromHex(IEND_HEX), MAGIC_LENGTH + IHDR_LENGTH + idatLength);

    return png;
}

/**
 * Extract binary from png image.
 * Input format is 24 bits RGB with no filter.
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

    const width = pngView.getUint32(MAGIC_LENGTH + 8);
    const height = pngView.getUint32(MAGIC_LENGTH + 12);

    if (width * height < 2) {
        throw new Error("Must be least 2 pixels.");
    }

    const isWidthOnePixel = width === 1;

    if (
        pngView.getUint32(MAGIC_LENGTH) !== 0x0000000D ||
        pngView.getUint32(MAGIC_LENGTH + 4) !== 0x49484452 ||
        pngView.getUint32(MAGIC_LENGTH + 16) !== 0x08020000 ||
        pngView.getUint8(MAGIC_LENGTH + 20) !== 0x00 ||
        pngView.getInt32(MAGIC_LENGTH + 21) !== crc32(png.subarray(MAGIC_LENGTH + 4, MAGIC_LENGTH + 21))
    ) {
        throw new Error("Invalid IHDR chunk.");
    }

    const idatStartByte = (() => {
        for (let i = MAGIC_LENGTH + IHDR_LENGTH; i < (png.byteLength - IEND_LENGTH);) {
            if (pngView.getUint32(i + 4) === 0x49444154) {
                return i;
            }

            i += Uint32Array.BYTES_PER_ELEMENT * 3 + pngView.getUint32(i);
        }

        throw new Error("IDAT chunk not found.");
    })();

    const idatEndByte = idatStartByte + Uint32Array.BYTES_PER_ELEMENT * 3 + pngView.getUint32(idatStartByte);

    if (pngView.getInt32(idatEndByte - 4) !== crc32(png.subarray(idatStartByte + 4, idatEndByte - 4))) {
        throw new Error("IDAT chunk CRC not match.");
    }

    const idatContentCompressed = png.subarray(idatStartByte + 8, idatEndByte - 4);

    const bytePerWidth = Uint8Array.BYTES_PER_ELEMENT + width * BYTE_PER_PIXEL;
    const idatContent = await new Response(new Response(idatContentCompressed).body?.pipeThrough(new DecompressionStream("deflate"))).bytes();
    const idatContentView = new DataView(idatContent.buffer);

    const data = new Uint8Array(isWidthOnePixel ? (((idatContentView.getUint32(1) >>> 8) << 8) | idatContentView.getUint8(6)) >>> 0 : idatContentView.getUint32(1));

    for (let i = 0, j = 0; i < idatContent.byteLength; i += bytePerWidth) {
        if (idatContentView.getUint8(i) !== 0x00) {
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