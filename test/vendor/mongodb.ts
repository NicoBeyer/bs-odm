import {MongoClient} from "mongodb";

describe("mongodb", async function () {

    it("connect", async function () {
        const client = new MongoClient("mongodb://127.0.0.1:27017/bs-odm-test");
        await client.connect();

        console.log("done");
    });

    it("sort on nested field", async function () {
        const client = new MongoClient("mongodb://127.0.0.1:27017/bs-odm-test");
        await client.connect();

        const coll = client.db("bs-odm-test").collection("vendor.mongodb.test");

        for (let i = 0; i < 100; i++) {
            await coll.insertOne({o: {i: "i " + i}});
        }

        let cur = coll.find({});

        cur = cur.sort({"o.i": -1});
        cur = cur.limit(10);

        const docs = await cur.toArray();

        console.log(docs);

    });


    before(async function () {

    });

    after(async function () {

    });

    beforeEach(async function () {

    });

});