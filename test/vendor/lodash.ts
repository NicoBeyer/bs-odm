import {assert} from "chai";
import * as _ from "lodash";

describe("lodash", async function () {
    it("includes() is strict", async function () {

        const array: Array<string | number | boolean> = [0, undefined, null, ""] ;

        let isFalse = _.includes<unknown | boolean>(array, false);

        assert.isFalse(isFalse);

        isFalse = _.includes<unknown | boolean>([], false);

        assert.isFalse(isFalse);

        array.push(false);

        const isTrue = _.includes<unknown | boolean>(array, false);

        assert.isTrue(isTrue);

    });
    before(async function () {
    });
    after(async function () {
    });
    beforeEach(async function () {
    });
});