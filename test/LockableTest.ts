import {assert} from "chai";
import {DB} from "../src";
import {LockableObj} from "./classes/LockableObj";

describe("LockableTest", async function () {

    const MONGO = process.env.MONGO_URL ?
        process.env.MONGO_URL + "/bs-odm-test" :
        "mongodb://localhost:27017/bs-odm-test";

    before(async function() {
        this.timeout(7000);
        await DB.mongoConnect(MONGO);
    });

    after(async function(){
        this.timeout(7000);
        await DB.disconnect(true);
    });

    beforeEach(async function() {
        const collections = await DB.collections();
        for (const collection of collections) {
            await collection.deleteMany({});
        }
    });

    it("locks object, release, fail save wihtout lock object", async function() {
        const coll = await DB.collection("lockables");

        const lockable = new LockableObj("Test1");
        await lockable.save();

        try {
            lockable.value = "Test2";
            await lockable.save();
            assert.fail("An Error should have been thrown.");
        } catch (err) {
            assert.equal(err.message, "This document is protected by a lock. You should acquire a lock before updating.");
        }

        await lockable.lock();
        assert.exists(lockable._odmLock);
        assert.exists(lockable._odmLock.uuid);
        assert.exists(lockable._odmLock.timestamp);
        await lockable.save();

        console.log(lockable._id);
        const lockable2 = await LockableObj.findOne<LockableObj>({_id: lockable._id});

        assert.isUndefined(lockable2._odmLock);

        try {
            await lockable2.lock();
            assert.fail("An Error should have been thrown.");
        } catch (err) {
            assert.equal(err.message, "Setting lock on document failed.");
        }

        await lockable.releaseLock();
        assert.isUndefined(lockable._odmLock);
        const lockableObj = await coll.findOne({_id: lockable._id});
        assert.isUndefined(lockableObj._odmLock);

        lockable2.value = "lockable2.save()";
        await lockable2.lock();
        await lockable2.save();
        await lockable2.releaseLock();

        const objs = await coll.find({}).toArray();
        assert.lengthOf(objs, 1);
        const obj = objs[0];
        delete obj._id;
        assert.deepEqual(obj, {value: "lockable2.save()"});
    });


});