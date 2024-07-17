import {DatabaseObject, DB, collection, exclude, field} from "../src";
import * as _ from "lodash";
import * as chai from "chai";
import {assert} from "chai";
import * as chaiAsPromised from "chai-as-promised";
import {MONGO} from "./helper/env";

chai.use(chaiAsPromised);
chai.should();

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
        assert.deepEqual(_.omit(res, "_id"), {
            field1:"Test1",
            field2: "Test2"
        });
        assert.isObject(res._id);
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

        const res = _.omit(await testCollection.findOne({field1: "Test1"}), "_id");
        assert.deepEqual(res, {
            field1:"Test1",
            field2: "Test2"
        });

        const pojo = test.getPlainOldObject();
        assert.deepEqual(pojo, {
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

        const res = _.omit(await testCollection.findOne({field1: "TypedTest1"}), "_id");
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
                await Test.findOneAndUpdate({_id: test._id}, _.pick(updateQuery, [op]));
                assert.fail("There should have been an error.");
            }), "Update object contains fields not defined for Test [\"" + op.replace("$","") + "Exc\"]");
        }

    });

    it("findOneAndUpdate respects Decorator @exclude", async function() {
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
                await Test.findOneAndUpdate({_id: test._id}, _.pick(updateQuery, [op]));
                assert.fail("There should have been an error.");
            }), "Update object contains fields excluded from Test [\"" + op.replace("$","") + "Exc\"]");
        }

    });

    it("@exclude on nested Object", async function() {
        class Test extends DatabaseObject {
            id: number;
            nested: Nested;
            nestedArray: Nested[];
        }
        class Nested {
            field1: string;
            field2: string;

            @exclude()
            nonField: string;
        }
        const testCollection = await DB.collection(Test.getCollectionName());

        const nested = new Nested();
        nested.field1 = "Test1";
        nested.field2 = "Test2";
        nested.nonField = "Error";

        const test = new Test();
        test.id = 5000;
        test.nested = nested;
        test.nestedArray = [nested, nested];

        await test.save();

        assert.instanceOf(test.nested, Nested);
        for(const i of test.nestedArray) {
            assert.instanceOf(i, Nested);
        }

        const res = _.omit(await testCollection.findOne({id: 5000}),  "_id");
        delete res._id;
        assert.deepEqual(res, {
            id: 5000,
            nested: {
                field1:"Test1",
                field2: "Test2"
            },
            nestedArray: [
                {
                    field1:"Test1",
                    field2: "Test2"
                },
                {
                    field1:"Test1",
                    field2: "Test2"
                }
            ]
        });
    });

    it("Decorators on complex nested Object", async function() {
        class Test extends DatabaseObject {
            constructor() {
                super();
                this.include = new NestedInclude();
                this.exclude = new NestedExclude();
                this.nestedDecorators = new NestedDecorators();
                this.nestedNoDecorators = new NestedNoDecorators();
                this.nestedArray = [
                    new NestedInclude(),
                    new NestedExclude(),
                    new NestedDecorators(),
                    new NestedNoDecorators(),
                ]
            }
            id = 6000;
            include: NestedInclude;
            exclude: NestedExclude;
            nestedDecorators: NestedDecorators;
            nestedNoDecorators: NestedNoDecorators;
            nestedArray: any[];
        }
        class NestedExclude {
            field1 = "field1";

            @exclude()
            nonField  = "Error";
        }
        class NestedInclude {
            @field()
            field1 = "field1";

            nonField  = "Error";
        }
        class NestedNoDecorators {
            constructor() {
                this.nested1 = new NestedExclude();
                this.nested2 = new NestedInclude();
            }
            field1 = "field1";
            nested1: NestedExclude;
            nested2: NestedInclude;
        }
        class NestedDecorators {
            constructor() {
                this.nested1 = new NestedExclude();
                this.nested2 = new NestedInclude();
            }
            @field()
            field1 = "field1";
            nonField  = "Error";
            @field()
            nested1: NestedExclude;
            @field()
            nested2: NestedInclude;
        }
        const testCollection = await DB.collection(Test.getCollectionName());

        const test = new Test();

        await test.save();

        assert.instanceOf(test.exclude, NestedExclude);
        assert.instanceOf(test.include, NestedInclude);

        const res = _.omit(await testCollection.findOne({id: 6000}), "_id");
        assert.deepEqual(res, {
            id: 6000,
            exclude: {
                field1:"field1"
            },
            include: {
                field1:"field1"
            },
            nestedDecorators: {
                field1: "field1",
                nested1: {
                    field1: "field1",
                },
                nested2: {
                    field1: "field1",
                }
            },
            nestedNoDecorators: {
                field1: "field1",
                nested1: {
                    field1: "field1",
                },
                nested2: {
                    field1: "field1",
                }
            },
            nestedArray: [
                {
                    field1:"field1"
                },
                {
                    field1:"field1"
                },
                {
                    field1: "field1",
                        nested1: {
                        field1: "field1",
                    },
                    nested2: {
                        field1: "field1",
                    }
                },
                {
                    field1: "field1",
                        nested1: {
                        field1: "field1",
                    },
                    nested2: {
                        field1: "field1",
                    }
                },
            ]
        });
    });

});

