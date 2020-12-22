import {assert} from "chai";

describe("Object", async function() {

    it ("copies Date", async function() {

        const date1 = new Date();
        const dateObj = Object.assign({}, date1);
        const dateObj2 = JSON.parse(JSON.stringify(date1));

        console.log(dateObj);

    });

    it ("typeof Date", async function() {
        const date = new Date();

        console.log(typeof date);

    });

    it ("string vs object", async function() {

        const test = "one1";

        assert.typeOf(test, "string");

    });

});
