import {DatabaseObject, hasCollection} from "./DatabaseObject";

export interface Decoratable extends Function, Object {
    fields: string[];
    excludedFields: string[];
    typedFields: any;
    collectionName: string;
    _odmLockable?: LockOptions;
}

export interface LockOptions {
    ttlMillis: number;
}

export interface OdmLock {
    uuid?: string;
    timeout: number;
}

export function field(type?: any) {
    return function (target: Object, key: string): void {
        const targetClass = (target.constructor as any) as Decoratable;
        targetClass.fields = targetClass.fields || [];
        targetClass.fields.push(key);
        if (type) {
            if (!(target instanceof DatabaseObject)) {
                throw new Error("Typed @field decorator not supported for nested documents, yet.");
            }
            targetClass.typedFields = targetClass.typedFields || {};
            targetClass.typedFields[key] = type;
        }
    }
}

export function exclude() {
    return function (target: Object, key: string): void {
        const targetClass = (target.constructor as any) as Decoratable;
        targetClass.excludedFields = targetClass.excludedFields || [];
        targetClass.excludedFields.push(key);
    }
}

export function collection(name?: string) {
    return function (constructor: Function) {
        const  Class= ((constructor as any) as Decoratable & hasCollection);
        Class.collectionName = name || Class.getCollectionName();
    }
}

export function lockable(ttlMillis = 1000) {
    return function (constructor: Function) {
        const Class= ((constructor as any) as Decoratable & hasCollection);
        Class._odmLockable = {ttlMillis};
    }
}


