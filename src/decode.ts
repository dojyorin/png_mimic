import {type Binary, MAGIC_MARK, BYTE_PER_PIXEL, COLOR_DEPTH, COLOR_TYPE, FILTER_TYPE, deriveCRC32, byteConcat, compressDecode} from "./common.ts";

interface Chunk {
    name: string;
    body: Uint8Array;
    crc32: number;
}

function* parsePNG(png: Uint8Array): Generator<Chunk> {
    const dec = new TextDecoder();

    for(let i = 0; i < MAGIC_MARK.length; i++) {
        if(png[i] !== MAGIC_MARK[i]) {
            throw new ReferenceError("Invalid magic bytes.");
        }

        continue;
    }

    for(let i = MAGIC_MARK.length; i < png.byteLength; undefined) {
        const view = new DataView(png.buffer);

        const size = view.getUint32(i);
        i += Uint32Array.BYTES_PER_ELEMENT;

        const name = png.slice(i, i += 4);
        const body = png.slice(i, i += size);

        const crc32 = view.getInt32(i);
        i += Int32Array.BYTES_PER_ELEMENT;

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
export async function pngDecode(png: Uint8Array): Promise<Binary> {
    const chunks = Array.from(parsePNG(png));

    const chunkIHDR = chunks.find(({name}) => name === "IHDR")?.body;
    const chunkIDAT = chunks.find(({name}) => name === "IDAT")?.body;
    const chunkIEND = chunks.find(({name}) => name === "IEND")?.body;

    if(!chunkIHDR || !chunkIDAT || !chunkIEND) {
        throw new ReferenceError("Missing chunks.");
    }

    const chunkViewIHDR = new DataView(chunkIHDR.buffer);

    if(chunkViewIHDR.getUint8(8) !== COLOR_DEPTH || chunkViewIHDR.getUint8(9) !== COLOR_TYPE) {
        throw new ReferenceError("Invalid color format.");
    }

    const nbytePerLine = chunkViewIHDR.getUint32(0) * BYTE_PER_PIXEL;
    const image = await compressDecode(chunkIDAT);

    const rows = Array.from({
        *[Symbol.iterator]() {
            for(let i = 0; i < image.byteLength; i++) {
                if(image[i] !== FILTER_TYPE) {
                    throw new ReferenceError("Invalid color filter.");
                }

                yield image.slice(i, i += nbytePerLine);
            }
        }
    });

    let pos = 0;
    const rawimage = byteConcat(...rows);
    const nsize = new DataView(rawimage.buffer).getUint32(pos);
    pos += Uint32Array.BYTES_PER_ELEMENT;
    const bsize = new DataView(rawimage.buffer).getUint32(pos);
    pos += Uint32Array.BYTES_PER_ELEMENT;
    const name = new TextDecoder().decode(rawimage.subarray(pos, pos += nsize));
    const body = rawimage.slice(pos, pos += bsize);

    return {
        name: name,
        body: body
    };
}