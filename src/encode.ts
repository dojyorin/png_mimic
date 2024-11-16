import {BYTE_PER_PIXEL, COLOR_DEPTH, COLOR_TYPE, FILTER_TYPE, MAGIC_MARK, deriveCRC32, compressEncode, byteConcat} from "./common.ts";

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
    const imageWidth = Math.ceil(Math.sqrt(data.byteLength / BYTE_PER_PIXEL));
    const frameSize = imageWidth ** 2 * BYTE_PER_PIXEL;
    const nbytePerLine = imageWidth * BYTE_PER_PIXEL;

    const rows: Uint8Array[] = [];

    const filterType = new Uint8Array([FILTER_TYPE]);

    for(let i = 0; i < frameSize; undefined) {
        const row = data.slice(i, i += nbytePerLine);
        rows.push(byteConcat(filterType, row, new Uint8Array(nbytePerLine - row.byteLength)));
    }

    const chunk_IHDR = generateChunk("IHDR", n32(imageWidth), n32(imageWidth), new Uint8Array([COLOR_DEPTH, COLOR_TYPE, 0x00, 0x00, 0x00]));
    const chunk_PLTE = generateChunk("PLTE", n32(frameSize - data.byteLength));
    const chunk_IDAT = generateChunk("IDAT", await compressEncode(byteConcat(...rows)));
    const chunk_IEND = generateChunk("IEND");

    return byteConcat(new Uint8Array(MAGIC_MARK), chunk_IHDR, chunk_PLTE, chunk_IDAT, chunk_IEND);
}