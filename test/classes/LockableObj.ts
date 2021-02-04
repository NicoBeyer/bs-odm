import {collection, DatabaseObject, lockable} from "../../src";


@lockable(-1)
@collection("lockables")
export class LockableObj extends DatabaseObject {

    public constructor(value: string) {
        super();
        this.value = value;
    }

    value: string;

}
