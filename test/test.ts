import * as _ from "lodash";

describe("", () => {});

const obj = {
    key1: "value1",
    key2: "Value2"
}


const res = _.map(obj, (key, value) =>  ({value, key})).reduce((acc, val) => {
        acc[val.key] = val.value;
        return acc;
    }
    , {});

console.log(res);
