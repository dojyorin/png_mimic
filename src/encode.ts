import {byteConcat, deflateEncode, u8Encode} from "../deps.ts";
import {crc32} from "./crc.ts";
import {type ChunkType} from "./chunk.ts";
import {PNG_BYTE_PER_PIXEL, PNG_COLOR_DEPTH, PNG_COLOR_TYPE, PNG_FILTER, PNG_MAGIC} from "./static.ts";

function n32(n:number){
    const view = new DataView(new ArrayBuffer(4));

    if(n < 0){
        view.setInt32(0, n);
    }
    else{
        view.setUint32(0, n);
    }

    return new Uint8Array(view.buffer);
}

function createChunk(type:ChunkType, ...bufs:Uint8Array[]){
    const name = u8Encode(type);

    return byteConcat(n32(bufs.reduce((v, {byteLength}) => v + byteLength, 0)), name, ...bufs, n32(crc32(name, ...bufs)));
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
export async function pngEncode(data:Uint8Array):Promise<Uint8Array>{
    const width = Math.ceil(Math.sqrt(data.byteLength / PNG_BYTE_PER_PIXEL));
    const size = Math.pow(width, 2) * PNG_BYTE_PER_PIXEL;
    const pixel = width * PNG_BYTE_PER_PIXEL;

    const rows:Uint8Array[] = [];
    for(let i = 0; i < size;){
        const row = data.slice(i, i += pixel);
        rows.push(byteConcat(new Uint8Array([PNG_FILTER]), row, new Uint8Array(pixel - row.byteLength)));
    }

    const ihdr = createChunk("IHDR", n32(width), n32(width), new Uint8Array([PNG_COLOR_DEPTH, PNG_COLOR_TYPE, 0x00, 0x00, 0x00]));
    const gama = createChunk("gAMA", n32(size - data.byteLength));
    const idat = createChunk("IDAT", await deflateEncode(byteConcat(...rows), "deflate"));
    const iend = createChunk("IEND");

    return byteConcat(new Uint8Array(PNG_MAGIC), ihdr, gama, idat, iend);
}