import {byteConcat, deflateDecode, textDecode} from "../deps.ts";
import {type ChunkType, PNG_BYTE_PER_PIXEL, PNG_COLOR_DEPTH, PNG_COLOR_TYPE, PNG_FILTER, PNG_MAGIC, crc32} from "./common.ts";

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
export async function pngDecode(data: Uint8Array): Promise<Uint8Array> {
    for(let i = 0; i < PNG_MAGIC.length; i++) {
        if(PNG_MAGIC[i] === data[i]) {
            continue;
        }

        throw new Error();
    }

    const chunk: Partial<Record<ChunkType, Uint8Array>> = {};
    for(let i = PNG_MAGIC.length; i < data.length;) {
        const size = new DataView(data.slice(i, i += 4).buffer).getUint32(0);
        const name = data.slice(i, i += 4);
        const body = data.slice(i, i += size);
        const hash = new DataView(data.slice(i, i += 4).buffer).getInt32(0);

        if(crc32(name, body) !== hash) {
            throw new Error();
        }

        const key = <ChunkType> textDecode(name);

        if(key in chunk) {
            continue;
        }

        chunk[key] = body;
    }

    if(!chunk.IHDR || !chunk.gAMA || !chunk.IDAT || !chunk.IEND) {
        throw new Error();
    }

    const image = await deflateDecode(chunk.IDAT, "deflate");
    const width = new DataView(chunk.IHDR.buffer).getUint32(0);
    const pixel = width * PNG_BYTE_PER_PIXEL;

    if(chunk.IHDR[8] !== PNG_COLOR_DEPTH || chunk.IHDR[9] !== PNG_COLOR_TYPE) {
        throw new Error();
    }

    const rows: Uint8Array[] = [];
    for(let i = 0; i < image.byteLength;) {
        if(image[i++] !== PNG_FILTER) {
            i += pixel;
            continue;
        }

        rows.push(image.slice(i, i += pixel));
    }

    return byteConcat(...rows).slice(0, -new DataView(chunk.gAMA.buffer).getUint32(0));
}