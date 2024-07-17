import {assert} from "chai";
import {DatabaseObject, DB} from "../src";
import {EnhancedFilterQuery} from "../src/selector/EnhancedFilterQuery";
import {MONGO} from "./helper/env";

describe("EnhancedFilterQueryTest", async function () {

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

    it("findOne $max $min", async function () {
        class Sortable extends DatabaseObject {
            numValue: number;
            value: string;
        }

        for (let i = 0; i < 10; i++) {
            const o = new Sortable();
            o.numValue = i;
            o.value = "Value" + i;
            await o.save();
        }

        const collection = await DB.collection("sortables");

        const max = await EnhancedFilterQuery.findOne(collection, {numValue: {$max: 1}})
        const min = await EnhancedFilterQuery.findOne(collection, {numValue: {$min: 1}})

        delete max._id;
        delete min._id;
        assert.deepEqual(max, {numValue: 9, value: "Value9"});
        assert.deepEqual(min, {numValue: 0, value: "Value0"});
    });

    it("Database.findOne $max $min", async function () {
        class Sortable extends DatabaseObject {
            numValue: number;
            value: string;
        }

        for (let i = 0; i < 10; i++) {
            const o = new Sortable();
            o.numValue = i;
            o.value = "Value" + i;
            await o.save();
        }

        const max = await Sortable.findOne<Sortable>({numValue: {$max: 1}})
        const min = await Sortable.findOne<Sortable>({numValue: {$min: 1}})

        delete max._id;
        delete min._id;
        assert.deepEqual(max.getPlainOldObject(), {numValue: 9, value: "Value9"});
        assert.deepEqual(min.getPlainOldObject(), {numValue: 0, value: "Value0"});
    });

});