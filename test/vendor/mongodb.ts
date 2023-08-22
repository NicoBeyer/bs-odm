import {MongoClient} from "mongodb";

describe("mongodb", async function () {

    it("connect", async function () {
        const client = new MongoClient("mongodb://127.0.0.1:27017/bs-odm-test");
        await client.connect();

        console.log("done");
    });

    before(async function () {

    });

    after(async function () {

    });

    beforeEach(async function () {

    });

});