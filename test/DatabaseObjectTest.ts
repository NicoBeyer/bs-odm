import { assert } from 'chai'
import {DB, DatabaseObject} from '../src'
import * as Bluebird from "bluebird";
import * as _ from "lodash";

const MONGO = process.env.MONGO_URL ?
    process.env.MONGO_URL + "/bs-odm-test" :
    "mongodb://localhost:27017/bs-odm-test";

describe('DatabaseObject', function(){

    before(async function() {
        this.timeout(7000);
        await DB.mongoConnect(MONGO);

        // clear db
        await (await DB.collection(DBObject.getCollectionName())).deleteMany({});
        await (await DB.collection(TestClass.getCollectionName())).deleteMany({});

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

    it('it returns the correct collectionName', async function(){

        class Test1 extends DatabaseObject {}
        class Test2 extends DatabaseObject  {}

        assert.equal(Test1.getCollectionName(), "test1s");
        assert.equal(Test2.getCollectionName(), "test2s");

    });

    it('stores objects to db and loads it again', async function(){
        let obj = new DBObject({
                number: 1001,
                string: 'Some silly test string 1',
                object: {name: 'Hello1', value: 'World1'},
                array: ['one1', 'two1', 'three1'],
                arrayarray: [['one1', 'two1', 'three1'],['one1', 'two1', 'three1'],['one1', 'two1', 'three1']],
            }),
            obj2 = new DBObject({
                number: 1002,
                string: 'Some silly test string 2',
                object: {name: 'Hello2', value: 'World2'},
                array: ['one2', 'two2', 'three2'],
                arrayarray: [['one2', 'two2', 'three2'],['one2', 'two2', 'three2'],['one2', 'two2', 'three2']]
            }),
            obj3 = new DBObject({
                number: 1003,
                string: 'Some silly test string 3',
                object: {name: 'Hello3', value: 'World3'},
                array: ['one3', 'two3', 'three3'],
                arrayarray: [['one3', 'two3', 'three3'],['one3', 'two3', 'three3'],['one3', 'two3', 'three3']]
            });
        await obj.save();
        await obj2.save();
        await obj3.save();
        assert.isUndefined((obj as any).value);
        assert.isUndefined((obj2 as any).value);
        assert.isUndefined((obj3 as any).value);

        let ret1 = await DBObject.findOne<DBObject>({number:1001});

        assert.equal(ret1.number, 1001);
        assert.equal(ret1.string, 'Some silly test string ' + 1);
        assert.deepEqual(ret1.object, obj.object);
        assert.deepEqual(ret1.array, obj.array);
        assert.deepEqual(ret1.arrayarray, obj.arrayarray);

        let objects = await DBObject.find<DBObject>({number: {$lte:1999}});

        assert.equal(objects.length, 3);
        for(let o of objects){
            let index = o.number - 1000;
            assert.equal(o.number, 1000 + index);
            assert.equal(o.string, 'Some silly test string ' + index)
        }

        await DBObject.findEach<DBObject>({number: {$lte:1999}}, o => {
            let index = o.number - 1000;
            assert.equal(o.number, 1000 + index);
            assert.equal(o.string, 'Some silly test string ' + index)
            }
        )

    });

    it('save() ignore undefined', async function(){
        class Test extends DatabaseObject {
            name: string;
            undefined: string;
            objWithUndefined: any;
            array: any[];
        }

        const test = new Test();
        test.name = "name";
        test.undefined = undefined;
        test.objWithUndefined = {
            value: "Value",
            undefined: undefined
        };
        test.array = [
            {obj: {undefined: undefined}}
        ]
        await test.save();

        const res = await Test.findOne({name: "name"});

        delete res._id;

        assert.deepEqual(res, {name: "name", objWithUndefined: {value: "Value"}, array: [{obj: {}}] } as any);
    });

    it('save() with empty array', async function(){
        class Test extends DatabaseObject {
            name = "Name";
            emptyArray = [];
            obj: any;
        }

        const test = new Test();
        test.obj = {
            emptyArray: []
        };
        await test.save();

        let res = await Test.findOne({name: "Name"});
        delete res._id;
        assert.deepEqual(res, {name: "Name", emptyArray: [], obj: {emptyArray: []}} as any);

        await test.save({emptyArray: 1, "obj.emptyArray": 1});
        assert.isUndefined((test as any).value);

        res = await Test.findOne({name: "Name"});
        delete res._id;
        assert.deepEqual(res, {name: "Name", emptyArray: [], obj: {emptyArray: []}} as any);
    });

    it('updateMany', async function(){
        let obj = new DBObject({
                number: 1001,
                string: 'Some silly test string 1',
                object: {name: 'Hello1', value: 'World1'},
                array: ['one1', 'two1', 'three1'],
                arrayarray: [['one1', 'two1', 'three1'],['one1', 'two1', 'three1'],['one1', 'two1', 'three1']]
            }),
            obj2 = new DBObject({
                number: 1002,
                string: 'Some silly test string 2',
                object: {name: 'Hello2', value: 'World2'},
                array: ['one2', 'two2', 'three2'],
                arrayarray: [['one2', 'two2', 'three2'],['one2', 'two2', 'three2'],['one2', 'two2', 'three2']]
            }),
            obj3 = new DBObject({
                number: 1003,
                string: 'Some silly test string 3',
                object: {name: 'Hello3', value: 'World3'},
                array: ['one3', 'two3', 'three3'],
                arrayarray: [['one3', 'two3', 'three3'],['one3', 'two3', 'three3'],['one3', 'two3', 'three3']]
            });
        await obj.save();
        await obj2.save();
        await obj3.save();

        let ret1 = await DBObject.updateMany({number: {$lt: 1003}}, {$set: {update: true}});

        assert.equal(ret1, 2);

        let objects = await DBObject.find<DBObject>({number: {$lte:1999}});

        assert.equal(objects.length, 3);
        for(let o of objects){
            let index = o.number - 1000;
            assert.equal(o.number, 1000 + index);
            assert.equal(o.string, 'Some silly test string ' + index);

            if (index < 3) {
                assert.isTrue(o.update);
            }
        }

    });

    it('stores selective fields', async function(){

        let obj = new DBObject({
            number: 2001,
            string: 'Some silly test string',
            object: {name: 'Hello', value: 'World'},
            array: ['one', 'two', 'three'],
            arrayarray: [['one', 'two', 'three'],['one', 'two', 'three'],['one', 'two', 'three']]
        });
        await obj.save();

        obj.array = ["four", "five", "six"];
        obj.number = 2002;
        obj.object = {};

        await obj.save({array:1});

        let ret1 = await DBObject.findOne<DBObject>({number:2001});
        let ret2 = await DBObject.findOne<DBObject>({number:2002});

        assert.isNull(ret2);

        assert.equal(ret1.number, 2001);
        assert.deepEqual(ret1.object, {name: 'Hello', value: 'World'});
        assert.deepEqual(ret1.array, ["four", "five", "six"])

    });

    it('remove() and removeMany()', async function(){

        for(let i = 0; i < 3; i++) {
            let obj = new DBObject({
                number: 4001,
                string: 'Remove Test ' + (i + 1),
                object: {name: 'Hello', value: 'World'},
                array: ['one', 'two', 'three'],
                arrayarray: [['one', 'two', 'three'],['one', 'two', 'three'],['one', 'two', 'three']]
            });
            await obj.save();
        }

        const res1 = await DBObject.find<DBObject>({number: 4001});
        assert.equal(res1.length, 3);

        await res1[0].remove();

        const res2 = await DBObject.find<DBObject>({number: 4001});
        assert.equal(res2.length, 2);

        await DBObject.removeMany({number: 4001});

        const res3 = await DBObject.find<DBObject>({number: 4001});
        assert.equal(res3.length, 0);

    });

    it('savesAndUpdates an object', async function(){

        let obj = new DBObject({
            number: 3001,
            string: 'Some silly test string',
            object: {name: 'Hello', value: 'World'},
            array: ['one', 'two', 'three'],
            arrayarray: [['one', 'two', 'three'],['one', 'two', 'three'],['one', 'two', 'three']]
        });
        await obj.save();


        let ret = await DBObject.findOneAndUpdate<DBObject>({_id:obj._id}, {$inc: {number: 2}, $set: {string: "Another Test String"}}, {returnOriginal: false});

        assert.equal(ret.number, 3003);
        assert.equal(ret.string, "Another Test String");
        assert.deepEqual(ret.object, obj.object);
        assert.deepEqual(ret.array, obj.array);
        assert.deepEqual(ret.arrayarray, obj.arrayarray);

        let ret2 = await DBObject.findOne<DBObject>({_id:obj._id});

        assert.equal(ret2.number, 3003);
        assert.equal(ret2.string, "Another Test String");
        assert.deepEqual(ret2.object, obj.object);
        assert.deepEqual(ret2.array, obj.array);
        assert.deepEqual(ret2.arrayarray, obj.arrayarray);

        let ret3 = await DBObject.findOneAndUpdate<DBObject>({_id:obj._id, number: 0}, {$inc: {number: 2}, $set: {string: "Another Test String"}}, {returnOriginal: false});

        assert.isNull(ret3)
    });

    it("skips results in findEach", async function(){

        for (let i = 0; i < 10; i++) {
            const obj = new TestClass("skips results in findEach", "Value " + (i + 1));
            await obj.save();
        }

        let count = 0;
        await TestClass.findEach({"object.name": "skips results in findEach"}, () => {
            count++;
        }, {skip: 5});
        assert.equal(count, 5);

        count = 0;
        let values = [];
        await TestClass.findEach<TestClass>({"object.name": "skips results in findEach"}, (obj) => {
            count++;
            values.push(obj.object.value);
        }, {skip: 7, limit: 2});
        assert.equal(count, 2);
        assert.deepEqual(values, ["Value 8", "Value 9"])
    });

    it("skips and limits results in find", async function(){

        for (let i = 0; i < 10; i++) {
            const obj = new TestClass("skips results in find", "Value " + (i + 1));
            await obj.save();
        }

        const res5 = await TestClass.find<TestClass>({"object.name": "skips results in find"}, {skip: 5});
        assert.equal(res5.length, 5);

        const res1 = await TestClass.find<TestClass>({"object.name": "skips results in find"}, {skip: 5, limit: 1});
        assert.equal(res1.length, 1);
        assert.equal(res1[0].object.value, "Value 6");

    });

    it("removes listeners on disconnect and connect", async function(){
        this.timeout(3000);

        await DB.disconnect();

        class Test1 extends DatabaseObject {}
        class Test2 extends DatabaseObject {}
        class Test3 extends DatabaseObject {}

        await DB.mongoConnect(MONGO);

        const test1 = new Test1();
        const test2 = new Test2();
        const test3 = new Test3();
        await test1.save();
        await test2.save();
        await test3.save();

        assert.equal(DB.listenerCount(DB.EVENT_DISCONNECTED), 3);
        assert.equal(DB.listenerCount(DB.EVENT_CONNECTED), 3);

        await DB.disconnect();
        await Bluebird.delay(10);

        assert.equal(DB.listenerCount(DB.EVENT_DISCONNECTED), 0);
        assert.equal(DB.listenerCount(DB.EVENT_CONNECTED), 0);

        await DB.mongoConnect(MONGO);
    });

    class SubClass {
        name: string;
        value: string;

        toString(){
            return this.name + '=' + this.value
        }
    }
    class TestClass extends DatabaseObject {

        object: SubClass;

        constructor(name:string, value:string){
            super();

            this.object = new SubClass();
            this.object.name = name;
            this.object.value = value
        }

        updateFields<Type extends DatabaseObject>(): Type {
            super.updateFields();

            let obj = this.object;
            this.object = new SubClass();
            Object.assign(this.object, obj);

            const ret = this as any;
            return <Type>ret;
        }

        static getCollectionName(){
            return 'complex'
        }
    }

    it('instantiates properties through updateFields', async function(){

        for(let i = 0; i < 5; i++){
            let obj = new TestClass('Hello' + i, 'World');
            await obj.save();
            assert.instanceOf(obj.object, SubClass);
        }

        let test = await TestClass.findOne<TestClass>({'object.name':'Hello0'});

        assert.instanceOf(test.object, SubClass);
        assert.equal(test.object.toString(), 'Hello0=World');

        let test2 = await TestClass.find<TestClass>({});

        for(let i = 0; i < 5; i++){
            assert.instanceOf(test2[i].object, SubClass);
            assert.equal(test2[i].object.toString(), 'Hello' + i + '=World')
        }

        let i = 0;
        await TestClass.findEach<TestClass>({}, ()=>{
            assert.instanceOf(test2[i].object, SubClass);
            assert.equal(test2[i].object.toString(), 'Hello' + i + '=World');
            i++
        })

    });

    it('handles errors with grace', async function(){

        const test = new DBObject();
        await test.save();

        await DBObject.findEach({}, () => {
            throw new Error('This is an Error')
        }).then(() =>{
            assert.fail(null, null, 'Expected an Error to be thrown');
        }).catch(err=>{
            assert.instanceOf(err, Error);
            assert.equal(err.message, 'This is an Error');
        });

        try{
            await DBObject.findEach({}, () => {
                throw new Error('This is an Error')
            });
            assert.fail(null, null, 'Expected an Error to be thrown')
        }catch(err){
            assert.instanceOf(err, Error);
            assert.equal(err.message, 'This is an Error')
        }

    });

    it('save() on manually created id', async function(){

        const object = new DBObjectStringId({_id: "test1", value: "value1"});

        await object.save();

        const object2 = new DBObjectStringId({_id: "test2", value: "value2"});

        await object2.save();

        const res = await DBObjectStringId.find<DBObjectStringId>({});

        assert.lengthOf(res, 2);
        res.sort((a,b) => {
            return a._id === b._id ? 0 : (a._id > b._id ? 1 : -1);
        });
        assert.deepEqual(res[0], object);
        assert.deepEqual(res[1], object2);

    });

    it ("save() with all different types", async function() {
        const obj = new DBObject({
            number: 40045,
            string: 'Some silly test string 1',
            object: {name: 'Hello1', value: 'World1'},
            array: ['one1', 'two1', 'three1'],
            arrayarray: [['one1', 'two1', 'three1'],['one1', 'two1', 'three1'],['one1', 'two1', 'three1']],
            null: null,
            undefined: undefined
        });

        await obj.save();

        const res = await DBObject.findOne<DBObject>({number: 40045});

        console.log(res.getPlainOldObject());
    });

    it('it counts objects', async function(){

        const obj = new DBObject({
                number: 40000,
                string: 'Some silly test string 1',
                object: {name: 'Hello1', value: 'World1'},
                array: ['one1', 'two1', 'three1'],
                arrayarray: [['one1', 'two1', 'three1'],['one1', 'two1', 'three1'],['one1', 'two1', 'three1']]
            });
        const obj2 = new DBObject({
            number: 40000,
            string: 'Some silly test string 1',
            object: {name: 'Hello1', value: 'World1'},
            array: ['one1', 'two1', 'three1'],
            arrayarray: [['one1', 'two1', 'three1'],['one1', 'two1', 'three1'],['one1', 'two1', 'three1']]
        });

        await obj.save();
        await obj2.save();

        let res = await DBObject.count({number: 40000});

        assert.equal(res, 2);

        await obj2.remove();

        res = await DBObject.count({number: 40000});

        assert.equal(res, 1);
    });

    it('it returns null for no Object found on findOne', async function(){

        let res = await DBObject.findOne({doesnot: "exist"});

        assert.isNull(res);
    });

    it('getPlainOldObject', async function() {

        const values = {
            number: 40000,
            string: 'Some silly test string 1',
            object: {name: 'Hello1', value: 'World1'},
            array: ['one1', 'two1', 'three1'],
            arrayarray: [['one1', 'two1', 'three1'], ['one1', 'two1', 'three1'], ['one1', 'two1', 'three1']]
        };
        const dbObj = new DBObject(values);

        const obj = dbObj.getPlainOldObject();

        assert.deepEqual(obj, values);
    });

    it('_instantiate with constructor', async function(){

        interface BaseInterface {
            value : string;
        }
        interface TestObjectInterface extends BaseInterface {
            value2 : string;
        }
        class TestObject<T extends BaseInterface = BaseInterface> extends DatabaseObject {
            public static instantiate<T extends BaseInterface = BaseInterface>(obj: T): TestObject<T> & T {
                return DatabaseObject._instantiate<TestObject<T>>(obj as Partial<TestObject<T>>, TestObject) as TestObject<T> & T;
            }
        }

        const obj = TestObject.instantiate<TestObjectInterface>({value: "Hello", value2: "World"});

        assert.instanceOf(obj, TestObject);
        assert.equal(obj.value, "Hello");
        assert.equal(obj.value2, "World");

    });

});

class DBObject extends DatabaseObject implements TestValues {

    number: number;
    string: string;
    object: any;
    array: Array<string>;
    arrayarray: Array<Array<string>>;
    update: boolean;
    null: null;
    undefined: undefined;

    constructor(values?:TestValues){
        super();

        _.each(values, (v, k) => {
            this[k] = v;
        });

    }

    static getCollectionName(){
        return 'testObjects'
    }

}

class DBObjectStringId extends DatabaseObject {

    public _id: string;
    public value: string;

    static getCollectionName(){
        return 'DBObjectStringId'
    }

    public constructor(obj: any) {
        super();

        Object.assign(this, obj);
    }

}

interface TestValues {

    number: number
    string: string
    object: any
    array: Array<string>
    arrayarray: Array<Array<string>>,
    null?: null,
    undefined?: undefined

}

