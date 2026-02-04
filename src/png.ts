import {byteJoin} from "./utility/byte.ts";
import {encompress, uncompress} from "./utility/compress.ts";
import {crc32} from "./utility/crc32.ts";

const BYTE_PER_PIXEL = 3;
const COLOR_DEPTH = 8;
const COLOR_TYPE = 2;
const FILTER_TYPE = 0;
const MAGIC_CODE = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] as const;

/**
 * Extract binary from png image.
 * Input format is 24 bit color, gamma, no alpha, no filter.
 * @example
 * ```ts
 * const bin = await Deno.readFile("./file");
 * const encode = await pngEncode(bin);
 * const decode = await pngDecode(encode);
 * ```
 */
export async function decode(png: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
    const dec = new TextDecoder();

    for (let i = 0; i < MAGIC_CODE.length; i++) {
        if (png[i] !== MAGIC_CODE[i]) {
            throw new Error("Invalid magic bytes.");
        }

        continue;
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

const enc = new TextEncoder();

function createChunk(name: string, body: Uint8Array) {
    const _name = enc.encode(name);
    const xa = new DataView(new ArrayBuffer(Uint32Array.BYTES_PER_ELEMENT));
    const xb = new DataView(new ArrayBuffer(Uint32Array.BYTES_PER_ELEMENT));

    xa.setUint32(0, body.byteLength);
    xb.setInt32(0, crc32(_name, body));

    return byteJoin(new Uint8Array(xa.buffer), _name, body, new Uint8Array(xb.buffer));
}

/**
 * Generate png image from binary.
 * Output format is 24 bit color, gamma, no alpha, no filter.
 * @example
 * ```ts
 * const bin = await Deno.readFile("./file");
 * const encode = await pngEncode(bin);
 * const decode = await pngDecode(encode);
 * ```
 */
export async function encode(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
    const name_ = enc.encode(name);
    const imageWidth = Math.ceil(Math.sqrt((Uint32Array.BYTES_PER_ELEMENT * 2 + name_.byteLength + body.byteLength) / BYTE_PER_PIXEL));
    const frameSize = imageWidth ** 2 * BYTE_PER_PIXEL;
    const nbytePerLine = imageWidth * BYTE_PER_PIXEL;

    const viewx = new DataView(new ArrayBuffer(Uint32Array.BYTES_PER_ELEMENT * 2));
    viewx.setUint32(0, name_.byteLength);
    viewx.setUint32(Uint32Array.BYTES_PER_ELEMENT, body.byteLength);

    const bodyx = byteJoin(new Uint8Array(viewx.buffer), name_, body);

    const rows = Array.from({
        *[Symbol.iterator]() {
            for (let i = 0; i < frameSize; undefined) {
                const row = bodyx.slice(i, i += nbytePerLine);
                yield byteJoin(new Uint8Array([FILTER_TYPE]), row, new Uint8Array(nbytePerLine - row.byteLength));
            }
        }
    });

    let pos = 0;
    const xbvv = new DataView(new ArrayBuffer(Uint32Array.BYTES_PER_ELEMENT * 2 + Uint8Array.BYTES_PER_ELEMENT * 2 + 3));
    xbvv.setUint32(pos, imageWidth);
    pos += Uint32Array.BYTES_PER_ELEMENT;
    xbvv.setUint32(pos, imageWidth);
    pos += Uint32Array.BYTES_PER_ELEMENT;
    xbvv.setUint8(pos, COLOR_DEPTH);
    pos += Uint8Array.BYTES_PER_ELEMENT;
    xbvv.setUint8(pos, COLOR_TYPE);
    pos += Uint8Array.BYTES_PER_ELEMENT;

    const chunkIHDR = createChunk("IHDR", new Uint8Array(xbvv.buffer));
    const chunkIDAT = createChunk("IDAT", await encompress(byteJoin(...rows), "deflate"));
    const chunkIEND = createChunk("IEND", new Uint8Array(0));

    return byteJoin(new Uint8Array(MAGIC_CODE), chunkIHDR, chunkIDAT, chunkIEND);
}