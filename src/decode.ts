import {type Binary, BYTE_PER_PIXEL, COLOR_DEPTH, COLOR_TYPE, FILTER_TYPE, compressDecode, byteConcat} from "./common.ts";
import {parsePNG} from "./chunk.ts";

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
    const dec = new TextDecoder();

    const chunks = Array.from(parsePNG(png));

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

    const nbytePerLine = chunkView_IHDR.getUint32(0) * BYTE_PER_PIXEL;
    const image = await compressDecode(chunk_IDAT);

    const rows: Uint8Array[] = [];

    for(let i = 0; i < image.byteLength; i++) {
        if(image[i] !== FILTER_TYPE) {
            i += nbytePerLine;
            continue;
        }

        rows.push(image.slice(i, i += nbytePerLine));
    }

    return {
        name: dec.decode(chunk_PLTE.subarray(Uint32Array.BYTES_PER_ELEMENT)).replaceAll("\0", ""),
        body: byteConcat(...rows).slice(0, -chunkView_PLTE.getUint32(0))
    };
}