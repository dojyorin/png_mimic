export function byteJoin(...bufs: Uint8Array<ArrayBuffer>[]) {
    const output = new Uint8Array(bufs.reduce((v, {byteLength}) => v + byteLength, 0));
    let offset = 0;

    for (const buf of bufs) {
        output.set(buf, offset);
        offset += buf.byteLength;
    }

    return output;
}