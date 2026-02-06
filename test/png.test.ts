import {assertEquals} from "@std/assert";
import {encode, decode} from "../src/png.ts";

const [bin, png] = await Promise.all([
    Deno.readFile(new URL(import.meta.resolve("./assets/sample.bin"))),
    Deno.readFile(new URL(import.meta.resolve("./assets/sample.png")))
]);

Deno.test({
    name: "Encode",
    async fn() {
        const output = await encode(bin);

        assertEquals(output, png);
    }
});

Deno.test({
    name: "Decode",
    async fn() {
        const output = await decode(png);

        assertEquals(output, bin);
    }
});