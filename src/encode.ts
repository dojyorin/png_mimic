import {PNG_BYTE_PER_PIXEL, PNG_COLOR_DEPTH, PNG_COLOR_TYPE, PNG_FILTER, PNG_MAGIC, deriveCRC32, compressEncode, byteConcat} from "./common.ts";

function n32(n: number) {
    const view = new DataView(new ArrayBuffer(4));

    if(n < 0) {
        view.setInt32(0, n);
    } else {
        view.setUint32(0, n);
    }

    return new Uint8Array(view.buffer);
}

function generateChunk(name: string, ...bufs: Uint8Array[]) {
    const _name = new TextEncoder().encode(name);

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
export async function pngEncode(data: Uint8Array): Promise<Uint8Array> {
    const width = Math.ceil(Math.sqrt(data.byteLength / PNG_BYTE_PER_PIXEL));
    const size = Math.pow(width, 2) * PNG_BYTE_PER_PIXEL;
    const pixel = width * PNG_BYTE_PER_PIXEL;

    const rows: Uint8Array[] = [];

    for(let i = 0; i < size; undefined) {
        const row = data.slice(i, i += pixel);
        rows.push(byteConcat(new Uint8Array([PNG_FILTER]), row, new Uint8Array(pixel - row.byteLength)));
    }

    const ihdr = generateChunk("IHDR", n32(width), n32(width), new Uint8Array([PNG_COLOR_DEPTH, PNG_COLOR_TYPE, 0x00, 0x00, 0x00]));
    const gama = generateChunk("gAMA", n32(size - data.byteLength));
    const idat = generateChunk("IDAT", await compressEncode(byteConcat(...rows)));
    const iend = generateChunk("IEND");

    return byteConcat(new Uint8Array(PNG_MAGIC), ihdr, gama, idat, iend);
}