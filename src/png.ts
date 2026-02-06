import {encompress, uncompress} from "./utility/compress.ts";
import {crc32} from "./utility/crc.ts";

const BYTE_PER_PIXEL = 3;
const MAGIC_HEX = "89504E470D0A1A0A";
const MAGIC_LENGTH = 8;
const IEND_HEX = "0000000049454E44AE426082";
const IEND_LENGTH = 12;

/**
 * Extract binary from png image.
 * Input format is 24 bits RGB.
 * @example
 * ```ts
 * const bin = await Deno.readFile("./file");
 * const encode = await encode(bin);
 * const decode = await decode(encode);
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

    const ihdrLength = pngView.getUint32(MAGIC_LENGTH);
    const ihdrType = pngView.getUint32(MAGIC_LENGTH + 4);
    const ihdrContent1 = pngView.getUint32(MAGIC_LENGTH + 16);
    const ihdrContent2 = pngView.getUint8(MAGIC_LENGTH + 20);
    const ihdrCRC = pngView.getInt32(MAGIC_LENGTH + 21);

    if (ihdrLength !== 0x0000000D || ihdrType !== 0x49484452 || ihdrContent1 !== 0x08020000 || ihdrContent2 !== 0x00 || ihdrCRC !== crc32(png.subarray(MAGIC_LENGTH + 4, MAGIC_LENGTH + 21))) {
        throw new Error("Invalid IHDR chunk.");
    }

    let idatStartByte = 0;

    for (let i = MAGIC_LENGTH; i < png.byteLength;) {
        if (pngView.getUint32(i + 4) === 0x49444154) {
            idatStartByte = i;

            break;
        }

        i += Uint32Array.BYTES_PER_ELEMENT * 3 + pngView.getUint32(i);
    }

    const idatEndByte = idatStartByte + Uint32Array.BYTES_PER_ELEMENT * 3 + pngView.getUint32(idatStartByte);

    if (pngView.getInt32(idatEndByte - 4) !== crc32(png.subarray(idatStartByte + 4, idatEndByte - 4))) {
        throw new Error("IDAT chunk CRC do not match.");
    }

    const idatContentCompressed = png.subarray(idatStartByte + 8, idatEndByte - 4);

    const bytePerWidth = Uint8Array.BYTES_PER_ELEMENT + width * BYTE_PER_PIXEL;
    const idatContent = await uncompress(idatContentCompressed, "deflate");
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

/**
 * Generate png image from binary.
 * Output format is 24 bits RGB.
 * Output image is square.
 * @example
 * ```ts
 * const bin = await Deno.readFile("./file");
 * const encode = await encode(bin);
 * const decode = await decode(encode);
 * ```
 */
export async function encode(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
    const width = Math.ceil(Math.sqrt((Uint32Array.BYTES_PER_ELEMENT + data.byteLength) / BYTE_PER_PIXEL));
    const height = width;

    const ihdr = new Uint8Array([0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0x02, 0x00, 0x00, 0x00, 0xB4, 0xE9, 0xEB, 0x45]);
    const ihdrView = new DataView(ihdr.buffer);
    ihdrView.setUint32(8, width);
    ihdrView.setUint32(12, height);
    ihdrView.setInt32(ihdr.byteLength - 4, crc32(ihdr.subarray(4, -4)));

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

    const idatContentCompressed = await encompress(idatContent, "deflate");

    const idat = new Uint8Array(Uint32Array.BYTES_PER_ELEMENT * 3 + idatContentCompressed.byteLength);
    const idatView = new DataView(idat.buffer);
    idatView.setUint32(0, idatContentCompressed.byteLength);
    idat.set([0x49, 0x44, 0x41, 0x54], 4);
    idat.set(idatContentCompressed, 8);
    idatView.setInt32(idat.byteLength - 4, crc32(idat.subarray(4, -4)));

    const png = new Uint8Array(MAGIC_LENGTH + ihdr.byteLength + idat.byteLength + IEND_LENGTH);
    png.set(Uint8Array.fromHex(MAGIC_HEX), 0);
    png.set(ihdr, MAGIC_LENGTH);
    png.set(idat, MAGIC_LENGTH + ihdr.byteLength);
    png.set(Uint8Array.fromHex(IEND_HEX), MAGIC_LENGTH + ihdr.byteLength + idat.byteLength);

    return png;
}