import {DatabaseObject, DB} from "../src";
import {collection, exclude, field} from "../src/DB/Decorators";
import * as _ from "lodash";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as Bluebird from "bluebird";

chai.use(chaiAsPromised);
const assert = chai.assert;
chai.should();

const MONGO = process.env.MONGO_URL ?
    process.env.MONGO_URL + "test_MongoDB" :
    "mongodb://localhost:27017/test_MongoDB";

describe("Decorators", async function() {

    before(async function() {
        await DB.mongoConnect(MONGO);

        const collections = await DB.collections();

        for (const collection of collections) {
            await collection.deleteMany({});
        }
    });

    after(async function() {
        await DB.disconnect(true);
    });

    afterEach(async function(){
        for(const collection of await DB.collections()) {
            await collection.deleteMany({});
        }
    });

    it("@field", async function() {
        class Test extends DatabaseObject {
            @field()
            field1: string;
            @field()
            field2: string;
            nonField: string;
        }
        const testCollection = await DB.collection(Test.getCollectionName());

        const test = new Test();
        test.field1 = "Test1";
        test.field2 = "Test2";
        test.nonField = "This does not belong in db.";

        await test.save();

        const res = await testCollection.findOne({field1: "Test1"});
        delete res._id;
        assert.deepEqual(res, {
            field1:"Test1",
            field2: "Test2"
        });
    });

    it("@exclude", async function() {
        class Test extends DatabaseObject {
            field1: string;
            field2: string;
            @exclude()
            nonField: string;
        }
        const testCollection = await DB.collection(Test.getCollectionName());

        const test = new Test();
        test.field1 = "Test1";
        test.field2 = "Test2";
        test.nonField = "This does not belong in db.";

        await test.save();

        const res = await testCollection.findOne({field1: "Test1"});
        delete res._id;
        assert.deepEqual(res, {
            field1:"Test1",
            field2: "Test2"
        });
    });

    it("does not mix different types", async function() {
        class Test1 extends DatabaseObject {
            field1: string;
            @exclude()
            field2: string;
        }

        class Test2 extends DatabaseObject {
            @exclude()
            field1: string;
            field2: string;
        }

        const test1 = Object.assign(new Test1(), {field1: "Test1", field2: "Test2"});
        const test2 = Object.assign(new Test2(), {field1: "Test1", field2: "Test2"});

        await test1.save();
        await test2.save();

        const res1 = await (await DB.collection(Test1.getCollectionName())).findOne({field1: "Test1"}) as any;
        const res2 = await (await DB.collection(Test2.getCollectionName())).findOne({field2: "Test2"}) as any;
        delete res1._id;
        delete res2._id;
        assert.deepEqual(res1, {
            field1:"Test1",
        });
        assert.deepEqual(res2, {
            field2: "Test2"
        });

    });

    it("@field typed", async function() {
        class FancyDate extends Date {

        }
        class Test extends DatabaseObject {
            @field()
            field1: string;
            @field(FancyDate)
            field2: FancyDate;
        }
        const testCollection = await DB.collection(Test.getCollectionName());

        const test = new Test();
        test.field1 = "TypedTest1";
        test.field2 = new Date("2012-01-01");

        await test.save();

        const res = await testCollection.findOne({field1: "TypedTest1"});
        delete res._id;
        assert.deepEqual(res, {
            field1:"TypedTest1",
            field2: new Date("2012-01-01")
        });

        const resObj = await Test.findOne<Test>({field1: "TypedTest1"});
        assert.instanceOf(resObj.field2, FancyDate);
    });

    it("@collection", async function() {
        const collectionName = "TestCollection";

        @collection(collectionName)
        class Test extends DatabaseObject {
            @field()
            field1: string;
        }
        const testCollection = await DB.collection(collectionName);

        assert.equal(Test.getCollectionName(), collectionName);

        const test = new Test();
        test.field1 = "Test @collection";
        await test.save();

        const res = await testCollection.find({}).toArray();
        assert.equal(res.length, 1);
        assert.deepEqual(res[0].field1, test.field1);
    });

    it("findOneAndUpdate respects Decorator @field", async function() {
        const collectionName = "TestCollection";

        const updateQuery = {
            $currentDate: {
                currentDate: {$type: "date"},
                currentDateExc: {$type: "date"},
            },
            $inc: {
                inc: 1,
                incExc: 1
            },
            $min: {
                min: 0,
                minExc: 0
            },
            $max: {
                max: 100,
                maxExc: 100
            },
            $mul: {
                mul: 2,
                mulExc: 2
            },
            $rename: {
                rename1: "NewName",
                rename2: "renameExc"
            },
            $set: {
                set: "Hello",
                setExc: "World"
            },
            $setOnInsert: {
                setOnInsert: "Hello",
                setOnInsertExc: "Hello"
            },
        }

        class Test extends DatabaseObject {

            @field()
            currentDate: Date;
            @field()
            inc = 1;
            @field()
            min = 1;
            @field()
            max = 1;
            @field()
            mul = 2;
            @field()
            rename1 = "Value";
            @field()
            rename2 = "Value";
            @field()
            NewName: string;
            @field()
            set: "OldValue"
            @field()
            setOnInsert: string;
        }
        const test = new Test();
        await test.save();

        for (const op in updateQuery) {
            await assert.isRejected(Promise.resolve().then(async () => {
                const res = await Test.findOneAndUpdate({_id: test._id}, _.pick(updateQuery, [op]));
                assert.fail("There should have been an error.");
            }), "Update object contains fields not defiend for Test [\"" + op.replace("$","") + "Exc\"]");
        }

    });

    it("findOneAndUpdate respects Decorator @exclude", async function() {
        const collectionName = "TestCollection";

        const updateQuery = {
            $currentDate: {
                currentDate: {$type: "date"},
                currentDateExc: {$type: "date"},
            },
            $inc: {
                inc: 1,
                incExc: 1
            },
            $min: {
                min: 0,
                minExc: 0
            },
            $max: {
                max: 100,
                maxExc: 100
            },
            $mul: {
                mul: 2,
                mulExc: 2
            },
            $rename: {
                rename1: "NewName",
                rename2: "renameExc"
            },
            $set: {
                set: "Hello",
                setExc: "World"
            },
            $setOnInsert: {
                setOnInsert: "Hello",
                setOnInsertExc: "Hello"
            },
        }

        class Test extends DatabaseObject {

            @exclude()
            currentDateExc: Date;
            @exclude()
            incExc = 1;
            @exclude()
            minExc = 1;
            @exclude()
            maxExc = 1;
            @exclude()
            mulExc = 2;
            @exclude()
            renameExc: string;
            @exclude()
            setExc: "OldValue"
            @exclude()
            setOnInsertExc: string;
        }
        const test = new Test();
        await test.save();

        for (const op in updateQuery) {
            await assert.isRejected(Promise.resolve().then(async () => {
                const res = await Test.findOneAndUpdate({_id: test._id}, _.pick(updateQuery, [op]));
                assert.fail("There should have been an error.");
            }), "Update object contains fields excluded from Test [\"" + op.replace("$","") + "Exc\"]");
        }

    });

});

