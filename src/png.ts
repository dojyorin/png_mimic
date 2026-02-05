import {encompress, uncompress} from "./utility/compress.ts";
import {crc32} from "./utility/crc32.ts";

const BYTE_PER_PIXEL = 3;
const FILTER_TYPE = 0;
const MAGIC = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const IEND = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]);

function generateIHDR(width: number, height: number) {
    const ihdr = new Uint8Array([0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0x02, 0x00, 0x00, 0x00, 0xB4, 0xE9, 0xEB, 0x45]);
    const ihdrView = new DataView(ihdr.buffer);
    ihdrView.setUint32(8, width);
    ihdrView.setUint32(12, height);
    ihdrView.setInt32(ihdr.byteLength - 4, crc32(ihdr.subarray(4, -4)));

    return ihdr;
}

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
    if (png.subarray(0, MAGIC.byteLength).toHex() !== MAGIC.toHex()) {
        throw new Error("Invalid magic.");
    }

    if (png.subarray(-IEND.byteLength).toHex() !== IEND.toHex()) {
        throw new Error("Invalid IEND chunk.");
    }

    const pngView = new DataView(png.buffer);

    const width = pngView.getUint32(MAGIC.byteLength + 8);
    const height = pngView.getUint32(MAGIC.byteLength + 12);

    const ihdr = generateIHDR(width, height);

    if (png.subarray(MAGIC.byteLength, MAGIC.byteLength + ihdr.byteLength).toHex() !== ihdr.toHex()) {
        throw new Error("Invalid IHDR chunk.");
    }

    let idatStartIndex = 0;

    for (let i = MAGIC.byteLength; i < png.byteLength;) {
        if (png.subarray(i + 4, i + 8).toHex() === "49444154") {
            idatStartIndex = i;

            break;
        }

        i += Uint32Array.BYTES_PER_ELEMENT * 3 + pngView.getUint32(i);
    }

    const idatEndIndex = idatStartIndex + Uint32Array.BYTES_PER_ELEMENT * 2 + pngView.getUint32(idatStartIndex);

    if (pngView.getInt32(idatEndIndex) !== crc32(png.subarray(idatStartIndex + 4, idatEndIndex))) {
        throw new Error("IDAT chunk CRC do not match.");
    }

    const idatContent = await uncompress(png.subarray(idatStartIndex + 8, idatEndIndex));

    const data = new Uint8Array();

    return data;
}

/**
 * Generate png image from binary.
 * Output format is 24 bits RGB.
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

    const ihdr = generateIHDR(width, height);

    const bytePerWidth = Uint8Array.BYTES_PER_ELEMENT + width * BYTE_PER_PIXEL;
    const idatContent = new Uint8Array(bytePerWidth * height);

    for (let i = 0, j = 0; i < idatContent.byteLength; i += bytePerWidth) {
        const first = i === 0;
        const offset = first ? 5 : 1;

        if (first) {
            new DataView(idatContent.buffer).setUint32(i + 1, data.byteLength);
        }

        idatContent.set([FILTER_TYPE], i);
        idatContent.set(data.subarray(j, j += bytePerWidth - offset), i + offset);
    }

    const idatContentCompressed = await encompress(idatContent, "deflate");

    const idat = new Uint8Array(Uint32Array.BYTES_PER_ELEMENT * 3 + idatContentCompressed.byteLength);
    const idatView = new DataView(idat.buffer);
    idatView.setUint32(0, idatContentCompressed.byteLength);
    idat.set([0x49, 0x44, 0x41, 0x54], 4);
    idat.set(idatContentCompressed, 8);
    idatView.setInt32(idat.byteLength - 4, crc32(idat.subarray(4, -4)));

    const png = new Uint8Array(MAGIC.byteLength + ihdr.byteLength + idat.byteLength + IEND.byteLength);
    png.set(MAGIC, 0);
    png.set(ihdr, MAGIC.byteLength);
    png.set(idat, MAGIC.byteLength + ihdr.byteLength);
    png.set(IEND, MAGIC.byteLength + ihdr.byteLength + idat.byteLength);

    return png;
}