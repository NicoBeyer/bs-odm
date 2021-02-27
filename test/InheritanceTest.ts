import {assert} from "chai";
import {collection, DatabaseObject, DB} from "../src";
import * as _ from "lodash";

describe("InheritanceTest", async function () {

    it("Double inheritance creates different collections (Parent called first)", async function () {

        class Parent extends DatabaseObject {
            value: string;
        }
        class Child extends Parent {
            childValue: string;
        }

        const parent = new Parent();
        parent.value = "Parent1";
        await parent.save();

        assert.deepEqual(Child.getCollectionName(), "childs");
        const child = new Child();
        child.value = "Child1";
        child.childValue = "Child1";
        await child.save();

        const children = await DB.collection("childs");
        const parents = await DB.collection("parents");

        const resParents = await parents.find({}).toArray();
        const resChildren = await children.find({}).toArray();

        assert.lengthOf(resParents, 1);
        assert.lengthOf(resChildren, 1);
        assert.deepEqual(_.omit(resParents[0], "_id"), parent.getPlainOldObject());
        assert.deepEqual(_.omit(resChildren[0], "_id"), child.getPlainOldObject());

    });

    it("Double inheritance creates different collections (Parent with decorator)", async function () {

        @collection("elders")
        class Parent extends DatabaseObject {
            value: string;
        }
        class Child extends Parent {
            childValue: string;
        }

        const parent = new Parent();
        parent.value = "Parent1";
        await parent.save();

        assert.deepEqual(Child.getCollectionName(), "childs");
        const child = new Child();
        child.value = "Child1";
        child.childValue = "Child1";
        await child.save();

        const parents = await DB.collection("elders");
        const children = await DB.collection("childs");

        const resParents = await parents.find({}).toArray();
        const resChildren = await children.find({}).toArray();

        assert.lengthOf(resParents, 1);
        assert.lengthOf(resChildren, 1);
        assert.deepEqual(_.omit(resParents[0], "_id"), parent.getPlainOldObject());
        assert.deepEqual(_.omit(resChildren[0], "_id"), child.getPlainOldObject());

    });

    it("Double inheritance creates different collections (Child with decorator)", async function () {


        class Parent extends DatabaseObject {
            value: string;
        }
        @collection("children")
        class Child extends Parent {
            childValue: string;
        }

        const parent = new Parent();
        parent.value = "Parent1";
        await parent.save();

        assert.deepEqual(Child.getCollectionName(), "children");
        const child = new Child();
        child.value = "Child1";
        child.childValue = "Child1";
        await child.save();

        const parents = await DB.collection("parents");
        const children = await DB.collection("children");

        const resParents = await parents.find({}).toArray();
        const resChildren = await children.find({}).toArray();

        assert.lengthOf(resParents, 1);
        assert.lengthOf(resChildren, 1);
        assert.deepEqual(_.omit(resParents[0], "_id"), parent.getPlainOldObject());
        assert.deepEqual(_.omit(resChildren[0], "_id"), child.getPlainOldObject());

    });

    it("Double inheritance creates different collections (Child and Parent with decorator)", async function () {


        @collection("elders")
        class Parent extends DatabaseObject {
            value: string;
        }
        @collection("children")
        class Child extends Parent {
            childValue: string;
        }

        const parent = new Parent();
        parent.value = "Parent1";
        await parent.save();

        assert.deepEqual(Child.getCollectionName(), "children");
        const child = new Child();
        child.value = "Child1";
        child.childValue = "Child1";
        await child.save();

        const parents = await DB.collection("elders");
        const children = await DB.collection("children");

        const resParents = await parents.find({}).toArray();
        const resChildren = await children.find({}).toArray();

        assert.lengthOf(resParents, 1);
        assert.lengthOf(resChildren, 1);
        assert.deepEqual(_.omit(resParents[0], "_id"), parent.getPlainOldObject());
        assert.deepEqual(_.omit(resChildren[0], "_id"), child.getPlainOldObject());

    });

    it("Double inheritance creates different collections (Child called first)", async function () {

        class Parent extends DatabaseObject {
            value: string;
        }
        class Child extends Parent {
            childValue: string;
        }

        assert.deepEqual(Child.getCollectionName(), "childs");
        const child = new Child();
        child.value = "Child1";
        child.childValue = "Child1";
        await child.save();

        const parent = new Parent();
        parent.value = "Parent1";
        await parent.save();

        const children = await DB.collection("childs");
        const parents = await DB.collection("parents");

        const resParents = await parents.find({}).toArray();
        const resChildren = await children.find({}).toArray();

        assert.lengthOf(resParents, 1);
        assert.lengthOf(resChildren, 1);
        assert.deepEqual(_.omit(resParents[0], "_id"), parent.getPlainOldObject());
        assert.deepEqual(_.omit(resChildren[0], "_id"), child.getPlainOldObject());

    });

    const MONGO = process.env.MONGO_URL ?
        process.env.MONGO_URL + "/bs-odm-test" :
        "mongodb://localhost:27017/bs-odm-test";

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

});