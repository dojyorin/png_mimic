import {assertEquals} from "../deps.test.ts";
import {pngDecode} from "../src/decode.ts";

const sample1 = await Deno.readFile(new URL(import.meta.resolve("./asset/sample.bin")));
const sample2 = await Deno.readFile(new URL(import.meta.resolve("./asset/sample.png")));

Deno.test({
    name: "Decode",
    async fn(){
        const decode = await pngDecode(sample2);

        assertEquals(decode, sample1);
    }
});