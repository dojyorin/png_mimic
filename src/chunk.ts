import {deriveCRC32, byteConcat} from "./common.ts";

interface ChunkIHDR {
    width: number;
    height: number;
    colorDepth: number;
    colorType: number;
}

function createChunk(name: string, data: Uint8Array) {
    const _name = new TextEncoder().encode(name);

    return byteConcat(new Uint8Array(new Uint32Array([data.byteLength]).buffer), _name, data, new Uint8Array(new Int32Array([deriveCRC32(_name, data)]).buffer));
}

export function parseIHDR(data: Uint8Array): ChunkIHDR {
    const view = new DataView(data.buffer);

    return {
        width: view.getUint32(0),
        height: view.getUint32(4),
        colorDepth: view.getUint8(8),
        colorType: view.getUint8(9)
    };
}

export function createIHDR(chunk: ChunkIHDR) {
    // return createChunk();
}