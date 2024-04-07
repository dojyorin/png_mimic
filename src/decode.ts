import {byteConcat, deflateDecode, u8Decode} from "../deps.ts";
import {crc32} from "./crc.ts";
import {type ChunkType} from "./chunk.ts";
import {PNG_BYTE_PER_PIXEL, PNG_COLOR_DEPTH, PNG_COLOR_TYPE, PNG_FILTER, PNG_MAGIC} from "./static.ts";

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
export async function pngDecode(data:Uint8Array):Promise<Uint8Array>{
    for(let i = 0; i < PNG_MAGIC.byteLength; i++){
        if(PNG_MAGIC[i] === data[i]){
            continue;
        }

        throw new Error();
    }

    const chunk:Partial<Record<ChunkType, Uint8Array>> = {};
    for(let i = PNG_MAGIC.byteLength; i < data.length;){
        const size = new DataView(data.slice(i, i += 4).buffer).getUint32(0);
        const name = data.slice(i, i += 4);
        const body = data.slice(i, i += size);
        const hash = new DataView(data.slice(i, i += 4).buffer).getInt32(0);

        if(crc32(name, body) !== hash){
            throw new Error();
        }

        chunk[<ChunkType>u8Decode(name)] = body;
    }

    if(!chunk.IHDR || !chunk.gAMA || !chunk.IDAT || !chunk.IEND){
        throw new Error();
    }

    const view = new DataView(chunk.IHDR.buffer);
    const width = view.getUint32(0);
    const image = await deflateDecode(chunk.IDAT, "deflate");

    if(view.getUint8(8) !== PNG_COLOR_DEPTH || view.getUint8(9) !== PNG_COLOR_TYPE){
        throw new Error();
    }

    const rows:Uint8Array[] = [];
    for(let i = 0; i < image.byteLength;){
        if(new DataView(image.slice(i, ++i).buffer).getUint8(0) !== PNG_FILTER){
            throw new Error();
        }

        rows.push(image.slice(i, i += width * PNG_BYTE_PER_PIXEL));
    }

    return byteConcat(...rows).slice(0, -new DataView(chunk.gAMA.buffer).getUint32(0));
}