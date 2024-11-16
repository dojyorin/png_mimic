import {type NameBody, BYTE_PER_PIXEL, COLOR_DEPTH, COLOR_TYPE, FILTER_TYPE, CHUNK_NAME_SIZE, MAGIC_MARK, deriveCRC32, compressDecode, byteConcat} from "./common.ts";

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
export async function pngDecode(data: Uint8Array): Promise<NameBody> {
    const dec = new TextDecoder();

    for(let i = 0; i < MAGIC_MARK.length; i++) {
        if(MAGIC_MARK[i] === data[i]) {
            continue;
        }

        throw new ReferenceError("Invalid magic bytes.");
    }

    const chunks: NameBody[] = [];

    for(let i = MAGIC_MARK.length; i < data.length; undefined) {
        const size = new DataView(data.slice(i, i += Uint32Array.BYTES_PER_ELEMENT).buffer).getUint32(0);
        const name = data.slice(i, i += CHUNK_NAME_SIZE);
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
    const chunk_PLTE = chunks.find(({name}) => name === "PLTE")?.body;
    const chunk_IDAT = chunks.find(({name}) => name === "IDAT")?.body;
    const chunk_IEND = chunks.find(({name}) => name === "IEND")?.body;

    if(!chunk_IHDR || !chunk_PLTE || !chunk_IDAT || !chunk_IEND) {
        throw new ReferenceError("Missing chunks.");
    }

    const chunkView_IHDR = new DataView(chunk_IHDR.buffer);
    const chunkView_PLTE = new DataView(chunk_PLTE.buffer);

    if(chunkView_IHDR.getUint8(8) !== COLOR_DEPTH || chunkView_IHDR.getUint8(9) !== COLOR_TYPE) {
        throw new ReferenceError("Invalid color format.");
    }

    const nbyteWidth = chunkView_IHDR.getUint32(0) * BYTE_PER_PIXEL;
    const image = await compressDecode(chunk_IDAT);

    const rows: Uint8Array[] = [];

    for(let i = 0; i < image.byteLength; i++) {
        if(image[i] !== FILTER_TYPE) {
            i += nbyteWidth;
            continue;
        }

        rows.push(image.slice(i, i += nbyteWidth));
    }

    return {
        name: dec.decode(chunk_PLTE.subarray(Uint32Array.BYTES_PER_ELEMENT)).replaceAll("\0", ""),
        body: byteConcat(...rows).slice(0, -chunkView_PLTE.getUint32(0))
    };
}