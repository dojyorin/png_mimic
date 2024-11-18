import {type Binary, BYTE_PER_PIXEL, COLOR_DEPTH, COLOR_TYPE, FILTER_TYPE, MAGIC_MARK, deriveCRC32, compressEncode, byteConcat} from "./common.ts";

const enc = new TextEncoder();

function createChunk(name: string, body: Uint8Array) {
    const _name = enc.encode(name);
    const xa = new DataView(new ArrayBuffer(Uint32Array.BYTES_PER_ELEMENT));
    const xb = new DataView(new ArrayBuffer(Uint32Array.BYTES_PER_ELEMENT));

    xa.setUint32(0, body.byteLength);
    xb.setInt32(0, deriveCRC32(_name, body));

    return byteConcat(new Uint8Array(xa.buffer), _name, body, new Uint8Array(xb.buffer));
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
export async function pngEncode({name, body}: Binary): Promise<Uint8Array> {
    const name_ = enc.encode(name);
    const imageWidth = Math.ceil(Math.sqrt((Uint32Array.BYTES_PER_ELEMENT * 2 + name_.byteLength + body.byteLength) / BYTE_PER_PIXEL));
    const frameSize = imageWidth ** 2 * BYTE_PER_PIXEL;
    const nbytePerLine = imageWidth * BYTE_PER_PIXEL;

    const viewx = new DataView(new ArrayBuffer(Uint32Array.BYTES_PER_ELEMENT * 2));
    viewx.setUint32(0, name_.byteLength);
    viewx.setUint32(Uint32Array.BYTES_PER_ELEMENT, body.byteLength);

    const bodyx = byteConcat(new Uint8Array(viewx.buffer), name_, body);

    const rows = Array.from({
        *[Symbol.iterator]() {
            for(let i = 0; i < frameSize; undefined) {
                const row = bodyx.slice(i, i += nbytePerLine);
                yield byteConcat(new Uint8Array([FILTER_TYPE]), row, new Uint8Array(nbytePerLine - row.byteLength));
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
    const chunkIDAT = createChunk("IDAT", await compressEncode(byteConcat(...rows)));
    const chunkIEND = createChunk("IEND", new Uint8Array(0));

    return byteConcat(new Uint8Array(MAGIC_MARK), chunkIHDR, chunkIDAT, chunkIEND);
}