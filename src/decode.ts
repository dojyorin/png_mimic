import {PNG_BYTE_PER_PIXEL, PNG_COLOR_DEPTH, PNG_COLOR_TYPE, PNG_FILTER, PNG_CHUNK_NAME_SIZE, PNG_MAGIC, deriveCRC32, compressDecode} from "./common.ts";

interface Chunk {
    name: string;
    body: Uint8Array;
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
export async function pngDecode(data: Uint8Array): Promise<Uint8Array> {
    const dec = new TextDecoder();

    for(let i = 0; i < PNG_MAGIC.length; i++) {
        if(PNG_MAGIC[i] === data[i]) {
            continue;
        }

        throw new ReferenceError("Invalid magic bytes.");
    }

    const chunks: Chunk[] = [];

    for(let i = PNG_MAGIC.length; i < data.length; undefined) {
        const size = new DataView(data.slice(i, i += Uint32Array.BYTES_PER_ELEMENT).buffer).getUint32(0);
        const name = data.slice(i, i += PNG_CHUNK_NAME_SIZE);
        const body = data.slice(i, i += size);
        const hash = new DataView(data.slice(i, i += Int32Array.BYTES_PER_ELEMENT).buffer).getInt32(0);

        if(deriveCRC32(name, body) !== hash) {
            throw new ReferenceError("Checksum mismatch.");
        }

        chunks.push({
            name: dec.decode(name),
            body: body
        });
    }

    const chunk_IHDR = chunks.find(({name}) => name === "IHDR")?.body;
    const chunk_IEND = chunks.find(({name}) => name === "IEND")?.body;
    const chunk_gAMA = chunks.find(({name}) => name === "gAMA")?.body;
    const chunks_IDAT = chunks.filter(({name}) => name === "IDAT").map(({body}) => body);

    if(!chunk_IHDR || !chunk_IEND || !chunk_gAMA || !chunks_IDAT.length) {
        throw new ReferenceError("Missing chunks.");
    }

    const image = await compressDecode(await new Blob(chunks_IDAT).bytes());
    const width = new DataView(chunk_IHDR.buffer).getUint32(0);
    const pixel = width * PNG_BYTE_PER_PIXEL;

    if(chunk_IHDR[8] !== PNG_COLOR_DEPTH || chunk_IHDR[9] !== PNG_COLOR_TYPE) {
        throw new ReferenceError("Invalid color format.");
    }

    const rows: Uint8Array[] = [];

    for(let i = 0; i < image.byteLength; undefined) {
        if(image[i++] !== PNG_FILTER) {
            i += pixel;
            continue;
        }

        rows.push(image.slice(i, i += pixel));
    }

    return (await new Blob(rows).bytes()).slice(0, -new DataView(chunk_gAMA.buffer).getUint32(0));
}