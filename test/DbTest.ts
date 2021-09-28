import {DB, DB as OdmDb} from "../src";
import {MongoClient} from "mongodb";
import {assert} from "chai";
import {DbObj} from "./classes/DbObj";

const MONGO = process.env.MONGO_URL ?
    process.env.MONGO_URL + "bs-odm-test" :
    "mongodb://localhost:27017/bs-odm-test";

const URI = MONGO;

describe("DB", async function(){

    it("connects and reconnects without open connections", async function(){
        this.timeout(3000);

        const promises = [];

        promises.push(OdmDb.mongoConnect(URI, null, null, null, true));
        promises.push(OdmDb.mongoConnect(URI, null, null, null,true));
        promises.push(OdmDb.mongoConnect(URI, null, null, null,true));
        promises.push(OdmDb.mongoConnect(URI, null, null, null,true));

        await Promise.all(promises);

        await OdmDb.disconnect();

        console.log(JSON.stringify(process.listeners));
    });

    it("performs bring your own database", async function(){
        this.timeout(3000);

        const client = await MongoClient.connect(URI, {  } );
        const db = await client.db("bs-mongo-mapper-test");

        OdmDb.setDb(db);
        const o = new DbObj();
        o.test = "HelloWorld";

        await o.save();

        const res = await DbObj.find<DbObj>({});

        assert.equal(res.length, 1);
        assert.equal(res[0].test, "HelloWorld");

        await client.close();

    });

    it("disconnects and reconnects", async function(){
        this.timeout(3000);

        await OdmDb.mongoConnect(URI);

        const o = new DbObj();
        o.test = "before";

        await o.save();

        await OdmDb.disconnect();

        try {
            o.test = "fail";
            await o.save();
            assert.fail("An error should have been thrown.");
        } catch(err) {
            // an error here is just fine.
        }

        await OdmDb.mongoConnect(URI);

        o.test = "success";

        await o.save();

        const res = await DbObj.find<DbObj>({});

        assert.equal(res.length, 1);
        assert.equal(res[0].test, "success");
    });

    beforeEach(async function() {
        await OdmDb.mongoConnect(URI);

        const collections = await OdmDb.collections();
        for(const coll of collections) {
            await coll.deleteMany({});
        }

        await OdmDb.disconnect();

        await OdmDb.mongoConnect(URI.replace("bs-odm-test", "bs-mongo-mapper-test"));

        const collections2 = await OdmDb.collections();
        for(const coll of collections2) {
            await coll.deleteMany({});
        }

        await OdmDb.disconnect();
    });

});
