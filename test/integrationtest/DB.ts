import {assert} from "chai";
import {DB} from "../../src";

describe("NAME", async function () {

    before(async function () {

    });

    after(async function () {

    });

    it("mongoConnect", async function () {
        await DB.mongoConnect("mongodb://localhost:27019/pmsServiceDb", "pmsServiceDb", "8w2ZHv9CsF2Gpjf9b3nu4", null);
    });

});