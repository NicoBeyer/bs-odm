import {hasCollection} from "./DatabaseObject";

export interface Decoratable {
    fields: string[];
    excludedFields: string[];
    typedFields: any;
    collectionName: string;
}

export function field(type?: any) {
    return function (target: Object, key: string): void {
        const targetClass = (target.constructor as any) as Decoratable;
        targetClass.fields = targetClass.fields || [];
        targetClass.fields.push(key);
        if (type) {
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

