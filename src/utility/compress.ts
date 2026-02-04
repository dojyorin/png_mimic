export async function encompress(data: Uint8Array<ArrayBuffer>, format?: CompressionFormat) {
    return await new Response(new Response(data).body?.pipeThrough(new CompressionStream(format ?? "gzip"))).bytes();
}

export async function uncompress(data: Uint8Array<ArrayBuffer>, format?: CompressionFormat) {
    return await new Response(new Response(data).body?.pipeThrough(new DecompressionStream(format ?? "gzip"))).bytes();
}