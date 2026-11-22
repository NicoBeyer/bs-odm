import {assert} from "chai";
import {DB} from "../src/index.js";
import {LockableObj} from "./classes/LockableObj.js";
import {setTimeout} from "node:timers/promises";
import _ from "lodash";
import {MONGO} from "./helper/env.js";

/**
 * Saves a LockableObj, locks it for 50ms, verifies that a second copy cannot be saved
 * while the lock is held and waits until the lock has expired.
 * @return the second copy, whose lock has timed out.
 */
async function createCopyBlockedByExpiredLock(): Promise<LockableObj> {
    await DB.collection("lockables");

    const lockable = new LockableObj("Test1");
    await lockable.save();
    const lockable2 = await LockableObj.findOne<LockableObj>({_id: lockable._id});
    lockable2.value = "lockable2.save()";

    await lockable.lock(50);

    try {
        await lockable2.save();
        assert.fail("An Error should have been thrown.");
    } catch (err) {
        assert.isOk(err.message.indexOf("Unable to save document") !== -1);
    }

    await setTimeout(55);
    return lockable2;
}

describe("LockableTest", async function () {

    before(async function() {
        await DB.mongoConnect(MONGO);
    });

    after(async function(){
        await DB.disconnect(true);
    });

    beforeEach(async function() {
        const collections = await DB.collections();
        for (const collection of collections) {
            await collection.deleteMany({});
        }
    });

    it("locks object, release, fail save without lock object", async function() {
        const coll = await DB.collection("lockables");

        const lockable = new LockableObj("Test1");
        await lockable.save();

        await lockable.lock();

        lockable.value = "test2.save()";
        await lockable.save();

        const lockable2 = await LockableObj.findOne<LockableObj>({_id: lockable._id});
        lockable2.value = "lockable2.save()";

        try {
            await lockable2.save();
            assert.fail("An Error should have been thrown.");
        } catch (err) {
            assert.isOk(err.message.indexOf("Unable to save document") !== -1);
        }
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

        await lockable2.lock();
        await lockable2.save();
        await lockable2.releaseLock();

        const objs = await coll.find({}).toArray();
        assert.lengthOf(objs, 1);
        const obj = _.omit(objs[0], "_id");
        assert.deepEqual(obj, {value: "lockable2.save()"});
    });

    it("releaseLock() with no lock present returns", async function() {
        const lockable = new LockableObj("Test1");
        await lockable.save();

        await lockable.releaseLock();
    });

    it("lock object with timed out lock", async function() {
        const lockable2 = await createCopyBlockedByExpiredLock();

        await lockable2.lock();
    });

    it("lock timeout", async function() {
        const lockable2 = await createCopyBlockedByExpiredLock();

        await lockable2.save();
    });

    it("waitForLock", async function() {
        await DB.collection("lockables");

        const lockable = new LockableObj("Test3");
        lockable.value = "1";
        await lockable.save();

        const lockable2 = await LockableObj.findOne<LockableObj>({_id: lockable._id});
        lockable2.value = "lockable2.save()";

        const promises = [];
        _.times(10, () => {
            Promise.resolve().then(async () => {
                await LockableObj.findOne<LockableObj>({_id: lockable._id});
            });
        });
        await Promise.all(promises);

        await lockable.lock(50);

        try {
            await lockable2.save();
            assert.fail("An Error should have been thrown.");
        } catch (err) {
            assert.isOk(err.message.indexOf("Unable to save document") !== -1);
        }

        await setTimeout(55);

        await lockable2.save();
    });


});