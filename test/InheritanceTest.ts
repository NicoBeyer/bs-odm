import {assert} from "chai";
import {collection, DatabaseObject, DB} from "../src/index.js";
import _ from "lodash";
import {MONGO} from "./helper/env.js";

interface ParentLike extends DatabaseObject {
    value: string;
}

interface ChildLike extends ParentLike {
    childValue: string;
}

async function saveParent<T extends ParentLike>(parent: T): Promise<T> {
    parent.value = "Parent1";
    await parent.save();
    return parent;
}

async function saveChild<T extends ChildLike>(child: T): Promise<T> {
    child.value = "Child1";
    child.childValue = "Child1";
    await child.save();
    return child;
}

async function assertStored(parentCollection: string, parent: DatabaseObject, childCollection: string, child: DatabaseObject) {
    const resParents = await (await DB.collection(parentCollection)).find({}).toArray();
    const resChildren = await (await DB.collection(childCollection)).find({}).toArray();

    assert.lengthOf(resParents, 1);
    assert.lengthOf(resChildren, 1);
    assert.deepEqual(_.omit(resParents[0], "_id"), parent.getPlainOldObject());
    assert.deepEqual(_.omit(resChildren[0], "_id"), child.getPlainOldObject());
}

describe("InheritanceTest", async function () {

    it("Double inheritance creates different collections (Parent called first)", async function () {

        class Parent extends DatabaseObject {
            value: string;
        }
        class Child extends Parent {
            childValue: string;
        }

        const parent = await saveParent(new Parent());

        assert.deepEqual(Child.getCollectionName(), "childs");
        const child = await saveChild(new Child());

        await assertStored("parents", parent, "childs", child);

    });

    it("Double inheritance creates different collections (Parent with decorator)", async function () {

        @collection("elders")
        class Parent extends DatabaseObject {
            value: string;
        }
        class Child extends Parent {
            childValue: string;
        }

        const parent = await saveParent(new Parent());

        assert.deepEqual(Child.getCollectionName(), "childs");
        const child = await saveChild(new Child());

        await assertStored("elders", parent, "childs", child);

    });

    it("Double inheritance creates different collections (Child with decorator)", async function () {


        class Parent extends DatabaseObject {
            value: string;
        }
        @collection("children")
        class Child extends Parent {
            childValue: string;
        }

        const parent = await saveParent(new Parent());

        assert.deepEqual(Child.getCollectionName(), "children");
        const child = await saveChild(new Child());

        await assertStored("parents", parent, "children", child);

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

        const parent = await saveParent(new Parent());

        assert.deepEqual(Child.getCollectionName(), "children");
        const child = await saveChild(new Child());

        await assertStored("elders", parent, "children", child);

    });

    it("Double inheritance creates different collections (Child called first)", async function () {

        class Parent extends DatabaseObject {
            value: string;
        }
        class Child extends Parent {
            childValue: string;
        }

        assert.deepEqual(Child.getCollectionName(), "childs");
        const child = await saveChild(new Child());

        const parent = await saveParent(new Parent());

        await assertStored("parents", parent, "childs", child);

    });

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