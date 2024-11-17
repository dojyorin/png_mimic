import {MAGIC_MARK, BYTE_PER_PIXEL, CHUNK_NAME_SIZE, FILTER_TYPE, deriveCRC32, byteConcat, compressDecode} from "./common.ts";

interface Chunk {
    name: string;
    body: Uint8Array;
    crc32: number;
}

interface ChunkIHDR {
    width: number;
    height: number;
    colorDepth: number;
    colorType: number;
}

interface ChunkPLTE {
    size: number;
    name: string;
}

export function* parsePNG(png: Uint8Array): Generator<Chunk> {
    const dec = new TextDecoder();

    for(let i = 0; i < MAGIC_MARK.length; i++) {
        if(png[i] !== MAGIC_MARK[i]) {
            throw new ReferenceError("Invalid magic bytes.");
        }

        continue;
    }

    for(let i = MAGIC_MARK.length; i < png.byteLength; undefined) {
        const [bsize] = new Uint32Array(png.buffer.slice(i, i += Uint32Array.BYTES_PER_ELEMENT));
        const name = png.slice(i, i += CHUNK_NAME_SIZE);
        const body = png.slice(i, i += bsize);
        const [crc32] = new Int32Array(png.buffer.slice(i, i += Int32Array.BYTES_PER_ELEMENT));

        if(deriveCRC32(name, body) !== crc32) {
            throw new ReferenceError("Checksum mismatch.");
        }

        yield {
            name: dec.decode(name),
            body: body,
            crc32: crc32
        };
    }
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

export function parsePLTE(data: Uint8Array): ChunkPLTE {
    return {
        size: new Uint32Array(data.buffer.slice(0, Uint32Array.BYTES_PER_ELEMENT))[0],
        name: new TextDecoder().decode(data.subarray(Uint32Array.BYTES_PER_ELEMENT)).replaceAll("\0", "")
    };
}

export async function parseIDAT(width: number, offset: number, data: Uint8Array): Promise<Uint8Array> {
    const nbytePerLine = width * BYTE_PER_PIXEL;
    const image = await compressDecode(data);

    const rows: Uint8Array[] = [];

    for(let i = 0; i < image.byteLength; i++) {
        if(image[i] !== FILTER_TYPE) {
            i += nbytePerLine;
            continue;
        }

        rows.push(image.slice(i, i += nbytePerLine));
    }

    return byteConcat(...rows).slice(0, -offset);
}

function createChunk(name: string, data: Uint8Array) {
    const _name = new TextEncoder().encode(name);

    return byteConcat(new Uint8Array(new Uint32Array([data.byteLength]).buffer), _name, data, new Uint8Array(new Int32Array([deriveCRC32(_name, data)]).buffer));
}

export function createIHDR(chunk: ChunkIHDR) {
    // return createChunk();
}