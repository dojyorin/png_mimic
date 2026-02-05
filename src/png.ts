import {encompress, uncompress} from "./utility/compress.ts";
import {crc32} from "./utility/crc32.ts";

const BYTE_PER_PIXEL = 3;
const FILTER_TYPE = 0;
const MAGIC = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const IHDR = new Uint8Array([0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0x02, 0x00, 0x00, 0x00, 0xB4, 0xE9, 0xEB, 0x45]);
const IEND = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]);

/**
 * Extract binary from png image.
 * Input format is 24 bits RGB, no alpha, no filter.
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

    const chunks = [];

    for (let i = MAGIC_CODE.length; i < png.byteLength;) {
        const view = new DataView(png.buffer);

        const size = view.getUint32(i);
        i += Uint32Array.BYTES_PER_ELEMENT;

        const name = png.slice(i, i += 4);
        const body = png.slice(i, i += size);

        const checksum = view.getInt32(i);
        i += Int32Array.BYTES_PER_ELEMENT;

        if (crc32(name, body) !== checksum) {
            throw new Error("Checksum mismatch.");
        }

        chunks.push({
            name: dec.decode(name),
            body: body,
            crc32: checksum
        });
    }

    const chunkIHDR = chunks.find(({name}) => name === "IHDR")?.body;
    const chunkIDAT = chunks.find(({name}) => name === "IDAT")?.body;
    const chunkIEND = chunks.find(({name}) => name === "IEND")?.body;

    if (!chunkIHDR || !chunkIDAT || !chunkIEND) {
        throw new Error("Missing chunks.");
    }

    const chunkViewIHDR = new DataView(chunkIHDR.buffer);

    if (chunkViewIHDR.getUint8(8) !== COLOR_DEPTH || chunkViewIHDR.getUint8(9) !== COLOR_TYPE) {
        throw new Error("Invalid color format.");
    }

    const nbytePerLine = chunkViewIHDR.getUint32(0) * BYTE_PER_PIXEL;
    const image = await uncompress(chunkIDAT, "deflate");

    const rows = Array.from({
        *[Symbol.iterator]() {
            for (let i = 0; i < image.byteLength; i++) {
                if (image[i] !== FILTER_TYPE) {
                    throw new Error("Invalid color filter.");
                }

                yield image.slice(i, i += nbytePerLine);
            }
        }
    });

    let pos = 0;
    const rawimage = byteJoin(...rows);
    const rawimageview = new DataView(rawimage.buffer);
    const nsize = rawimageview.getUint32(pos);
    pos += Uint32Array.BYTES_PER_ELEMENT;

    const bsize = rawimageview.getUint32(pos);
    pos += Uint32Array.BYTES_PER_ELEMENT;

    const name = dec.decode(rawimage.subarray(pos, pos += nsize));
    const body = rawimage.slice(pos, pos += bsize);

    return {
        name: name,
        body: body
    };
}

/**
 * Generate png image from binary.
 * Output format is 24 bits RGB, no alpha, no filter.
 * @example
 * ```ts
 * const bin = await Deno.readFile("./file");
 * const encode = await encode(bin);
 * const decode = await decode(encode);
 * ```
 */
export async function encode(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
    const width = Math.ceil(Math.sqrt((Uint32Array.BYTES_PER_ELEMENT + data.byteLength) / BYTE_PER_PIXEL));

    const ihdr = IHDR.slice();
    new DataView(ihdr.buffer).setUint32(8, width);
    new DataView(ihdr.buffer).setUint32(12, width);
    new DataView(ihdr.buffer).setInt32(-4, crc32(ihdr.subarray(4, -4)));

    const idatContent = new Uint8Array(width ** 2 * BYTE_PER_PIXEL + width);

    for (let i = MAGIC.byteLength + IHDR.byteLength; i < maxByteLength;) {

    }

    const idatContentCompressed = await encompress(idatContent, "deflate");

    const idat = new Uint8Array(Uint32Array.BYTES_PER_ELEMENT * 3 + idatContentCompressed.byteLength);
    new DataView(idat.buffer).setUint32(0, idatContentCompressed.byteLength);
    idat.set([0x49, 0x44, 0x41, 0x54], 4);
    idat.set(idatContentCompressed, 8);
    new DataView(idat.buffer).setInt32(-4, crc32(idat.subarray(4, -4)));

    const png = new Uint8Array();

    return png;
}