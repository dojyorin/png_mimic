// esnext-polyfill
Response.prototype.bytes ??= async function() {
    return new Uint8Array(await this.arrayBuffer());
}

// esnext-polyfill
Blob.prototype.bytes ??= async function() {
    return new Uint8Array(await this.arrayBuffer());
}

export * from "./src/encode.ts";
export * from "./src/decode.ts";