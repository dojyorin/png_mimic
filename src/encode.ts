import {type Binary, BYTE_PER_PIXEL, COLOR_DEPTH, COLOR_TYPE, FILTER_TYPE, MAGIC_MARK, deriveCRC32, compressEncode, byteConcat} from "./common.ts";

const enc = new TextEncoder();

function n32(n: number) {
    const view = new DataView(new ArrayBuffer(4));

    if(n < 0) {
        view.setInt32(0, n);
    } else {
        view.setUint32(0, n);
    }

    return new Uint8Array(view.buffer);
}

function createChunk(name: string, ...bufs: Uint8Array[]) {
    const _name = enc.encode(name);

    return byteConcat(n32(bufs.reduce((v, {byteLength}) => v + byteLength, 0)), _name, ...bufs, n32(deriveCRC32(_name, ...bufs)));
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

    const bodyx = byteConcat(new Uint8Array(viewx.buffer), body);

    const rows = Array.from({
        *[Symbol.iterator]() {
            for(let i = 0; i < frameSize; undefined) {
                const row = bodyx.slice(i, i += nbytePerLine);
                yield byteConcat(new Uint8Array([FILTER_TYPE]), row, new Uint8Array(nbytePerLine - row.byteLength));
            }
        }
    });

    const chunkIHDR = createChunk("IHDR", n32(imageWidth), n32(imageWidth), new Uint8Array([COLOR_DEPTH, COLOR_TYPE, 0x00, 0x00, 0x00]));
    const chunkIDAT = createChunk("IDAT", await compressEncode(byteConcat(...rows)));
    const chunkIEND = createChunk("IEND");

    return byteConcat(new Uint8Array(MAGIC_MARK), chunkIHDR, chunkIDAT, chunkIEND);
}