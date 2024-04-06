import {byteConcat, deflateDecode, u8Decode} from "../deps.ts";
import {crc32} from "./crc.ts";
import {type ChunkType} from "./chunk.ts";
import {PNG_PIXEL, PNG_MAGIC} from "./static.ts";

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

        if(crc32(byteConcat(name, body)) !== hash){
            throw new Error();
        }

        chunk[<ChunkType>u8Decode(name)] = body;
    }

    if(!chunk.IHDR || !chunk.gAMA || !chunk.IDAT || !chunk.IEND){
        throw new Error();
    }

    const view = new DataView(chunk.IHDR.buffer);
    const square = view.getUint32(0);
    const pad = new DataView(chunk.gAMA.buffer).getUint32(0);
    const image = await deflateDecode(chunk.IDAT, "deflate");

    if(square !== view.getUint32(4) || view.getUint8(8) !== 0x08 || view.getUint8(9) !== 0x02){
        throw new Error();
    }

    const rows:Uint8Array[] = [];
    for(let i = 0; i < image.byteLength;){
        const width = square * PNG_PIXEL;
        const row = image.slice(++i, i += width);
        rows.push(row);
    }

    return byteConcat(...rows).slice(0, -pad);
}