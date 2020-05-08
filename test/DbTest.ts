import {DB} from "../src";

const MONGO = process.env.MONGO_URL ?
    process.env.MONGO_URL + "bs-mongo-mapper-test" :
    "mongodb://localhost:27017/bs-mongo-mapper-test";

const URI = MONGO;

describe("DB", async function(){

    it("connects and reconnects without open connections", async function(){
        this.timeout(3000);

        const promises = [];

        promises.push(DB.mongoConnect(URI, null, null, "admin", true));
        promises.push(DB.mongoConnect(URI, null, null, "admin",true));
        promises.push(DB.mongoConnect(URI, null, null, "admin",true));
        promises.push(DB.mongoConnect(URI, null, null, "admin",true));

        await Promise.all(promises);

        await DB.disconnect();

        console.log(JSON.stringify(process.listeners));
    });

});
