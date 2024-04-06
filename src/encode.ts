import {byteConcat, deflateEncode, u8Encode} from "../deps.ts";
import {crc32} from "./crc.ts";
import {type ChunkType} from "./chunk.ts";
import {PNG_PIXEL, PNG_MAGIC} from "./static.ts";

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

function createChunk(type:ChunkType, ...bytes:Uint8Array[]){
    const body = byteConcat(u8Encode(type), ...bytes);

    return byteConcat(n32(bytes.reduce((v, {byteLength}) => v + byteLength, 0)), body, n32(crc32(body)));
}

export async function pngEncode(data:Uint8Array):Promise<Uint8Array>{
    const square = Math.ceil(Math.sqrt(data.byteLength / PNG_PIXEL));
    const size = Math.pow(square, 2) * PNG_PIXEL;
    const pad = size - data.byteLength;

    const rows:Uint8Array[] = [];
    for(let i = 0; i < size;){
        const width = square * PNG_PIXEL;
        const row = data.slice(i, i += width);
        rows.push(byteConcat(new Uint8Array([0x00]), row, new Uint8Array(width - row.byteLength)));
    }

    const image = await deflateEncode(byteConcat(...rows), "deflate");

    const ihdr = createChunk("IHDR", n32(square), n32(square), new Uint8Array([0x08, 0x02, 0x00, 0x00, 0x00]));
    const gama = createChunk("gAMA", n32(pad));
    const idat = createChunk("IDAT", image);
    const iend = createChunk("IEND");

    return byteConcat(PNG_MAGIC, ihdr, gama, idat, iend);
}