import {collection, DatabaseObject, lockable} from "../../src/index.js";


@lockable(-1)
@collection("lockables")
export class LockableObj extends DatabaseObject {

    public constructor(value: string) {
        super();
        this.value = value;
    }

    value: string;
    isLatest: boolean;

}
