import {assertEquals} from "../deps.test.ts";
import {pngEncode} from "../src/encode.ts";

const sample1 = await Deno.readFile(new URL(import.meta.resolve("./asset/sample.bin")));
const sample2 = await Deno.readFile(new URL(import.meta.resolve("./asset/sample.png")));

Deno.test({
    name: "Encode",
    async fn(){
        const encode = await pngEncode(sample1);

        assertEquals(encode, sample2);
    }
});