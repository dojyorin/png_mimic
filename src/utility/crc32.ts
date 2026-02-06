export function crc32(data: Uint8Array) {
    let hash = 0xFFFFFFFF;

    for (const n of data) {
        for (let i = 0; i < 8; i++) {
            hash = ((hash ^ n >>> i) & 1 ? 0xEDB88320 : 0) ^ hash >>> 1;
        }
    }

    return hash ^ 0xFFFFFFFF;
}