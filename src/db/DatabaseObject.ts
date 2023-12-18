import {DB, MongoLikeCollection} from './DB'
import {Document, FindOneAndUpdateOptions, ObjectId, ReturnDocument, WithId} from "mongodb";
import * as _ from "lodash";
import {Decoratable, LockOptions, OdmLock} from "./Decorators";
import {v4 as uuidv4} from "uuid";
import {EnhancedFilterQuery} from "../selector/EnhancedFilterQuery";
import {setTimeout} from "timers/promises";

export interface QueryOptions {
    skip?: number;
    limit?: number;
    concurrent?: number;
}

export interface hasCollection {
    collection: MongoLikeCollection;
    getCollectionName: () => string;
}

export abstract class DatabaseObject {

    public _id:any;
    private _odmIsNew = true;
    public _odmLock: OdmLock;

    static async find<Type extends DatabaseObject>(selector = {} as any, options = {} as QueryOptions):Promise<Type[]>{
        let ret = [] as Type[]
        return DatabaseObject.findEach.call(this, selector, (obj:Type)=>{
            ret.push(obj)
        }, options).then(()=>{
            return ret;
        })
    }

    static async findOne<Type extends DatabaseObject>(selector = {} as any):Promise<Type>{
        const coll = await this._getCollection();

        const obj = await EnhancedFilterQuery.findOne(coll, selector);

        if(!obj){
            return null
        }

        delete obj._odmLock;
        return this._instantiate<Type>(obj);
    }

    static async findEach<Type extends DatabaseObject>(
        selector = {} as any,
        iterator:(obj:Type)=>void|Promise<void>,
        options = {} as QueryOptions | number):Promise<void> {
        const coll = await this._getCollection();
        let self = this;
        let concurrent: number;
        if (typeof options === "number") {
            concurrent = options;
            options = {};
        } else {
            concurrent = options.concurrent || 1;
        }

        let cur = coll.find(selector);

        if (options.skip) {
            cur = cur.skip(options.skip);
        }
        if (options.limit) {
            cur = cur.limit(options.limit);
        }

        return (function recursive(){
            return Promise.resolve().then(async ()=>{
                let promises = []
                for(let i = 0; i < concurrent; i++){
                    let hasNext = await cur.hasNext();
                    if(hasNext){
                        let next = await cur.next();
                        let obj = self._instantiate<Type>(next as Partial<Type>);
                        let ret = iterator(obj);
                        promises.push(ret);
                    }else{
                        break;
                    }
                }
                return Promise.all(promises)
            }).then(()=>{
                return cur.hasNext()
            }).then((hasNext)=>{
                if(hasNext){
                    return recursive()
                }
            }).catch((err)=>{
                if(err.message === 'cursor is exhausted'){
                    return;
                }
                throw err
            })
        })()
    }

    async save(fields?: any): Promise<this> {
        let coll = await this.getCollection();

        let obj = DatabaseObject.pickFields(this);
        delete obj._odmLock;
        delete obj._odmIsNew;

        if(fields){
            obj = DatabaseObject.copyFields(fields, obj)
        }

        if (this.isNew()) {
            let result = await coll.insertOne(obj);
            this._id = result.insertedId;
        } else {
            if (!this._id) {
                throw new Error('To update or upsert a document an _id is required');
            }
            const filter = {_id: this._id} as any;
            if (this.isLockable()) {
                filter.$or = [
                    {_odmLock: null},
                    {"_odmLock.timeout": {$lt: Date.now()}},
                ];
                if (this._odmLock && this._odmLock.uuid) {
                    filter.$or.push({"_odmLock.uuid": _.get(this, "_odmLock.uuid")});
                }
            }
            let result = await coll.findOneAndUpdate(
                filter,
                {$set: obj},
                {
                    returnDocument: ReturnDocument.AFTER
                });

            if (!result.value) {
                throw new Error("Unable to save document: " + JSON.stringify( result ));
            }

            Object.assign(this, result.value);

            this.updateFields();
        }

        delete this._odmIsNew;
        return this;
    }

    private static copyFields(fields:any, source:DatabaseObject):any{
        let ret = {}

        for(let key in fields){
            if (!fields.hasOwnProperty(key)) {
                continue;
            }
            if(typeof fields[key] === 'object'){
                let f = this.copyFields(fields[key], source[key]);
                for(let k in f){
                    if (f.hasOwnProperty(k)) {
                        ret[key + '.' + k] = f[k]
                    }
                }
            }else if(fields[key]){
                ret[key] = _.get(source, key)
            }
        }

        return ret
    }

    private static pickFields(obj: any): any {
        if (!obj) {
            return obj;
        } else if (Array.isArray(obj)) {
            return obj.map(o => this.pickFields(o));
        } else if (typeof obj === "object") {
            const Class = (obj.constructor as any) as Decoratable;
            if (obj instanceof Date) {
                return obj;
            } else if (obj instanceof ObjectId) {
                return obj;
            } else if (Class.fields) {
                return this.pickFields(_.pick(obj, Class.fields));
            } else if (Class.excludedFields) {
                return this.pickFields(_.omit(obj, Class.excludedFields));
            } else {
                let ret = {}
                for (const k in obj) {
                    if (obj.hasOwnProperty(k)) {
                        ret[k] = this.pickFields(obj[k]);
                    }
                }
                return ret;
            }
        } else {
            return obj;
        }
    }

    public static async findOneAndUpdate<Type extends DatabaseObject>(filter: any, update: any, options?: FindOneAndUpdateOptions):Promise<Type>{
        let coll = await this._getCollection();

        _.keys(update).forEach((key) => {
            this.validateFields(update[key]);
            if (key === "$rename") {
                this.validateFields(this.invertObject(update[key]));
            }
        });

        let result = await coll.findOneAndUpdate(filter, update, options)

        if(result.value){
            return this._instantiate<Type>(result.value)
        }else{
            return null;
        }
    }

    public static async updateMany(filter: any, update: any, options?: any): Promise<number> {
        let coll = await this._getCollection();

        _.keys(update).forEach((key) => {
            this.validateFields(update[key]);
            if (key === "$rename") {
                this.validateFields(this.invertObject(update[key]));
            }
        });

        let result = await coll.updateMany(filter, update, options);

        return result.modifiedCount;
    }

    private static validateFields(obj: any) {
        let Class = (this as any) as Decoratable;

        const objectKeys = _.keys(obj);
        if (Class.fields && Class.fields.length > 0){
            const intersection = _.intersection(Class.fields, objectKeys);
            if (intersection.length !== objectKeys.length) {
                throw new Error("Update object contains fields not defined for " + this.name +
                    " " + JSON.stringify(_.difference(objectKeys, Class.fields)));
            }
        } else if (Class.excludedFields && Class.excludedFields.length > 0) {
            const intersection = _.intersection(objectKeys, Class.excludedFields);
            if (intersection.length !== 0) {
                throw new Error("Update object contains fields excluded from " + this.name +
                    " " + JSON.stringify(intersection));
            }
        }

        return true;
    }

    private static invertObject(obj: any) {
        return _.map(obj, (key, value) =>  ({value, key})).reduce((acc, val) => {
                acc[val.key] = val.value;
                return acc;
            }
            , {});
    }


    public static async count<Type extends DatabaseObject>(filter: any):Promise<number>{
        let coll = await this._getCollection();

        return await coll.countDocuments(filter);
    }

    /**
     * Overwrite to _instantiate properties
     * @returns {Type}
     */
    protected updateFields<Type extends DatabaseObject>():Type {
        let Class = (this.constructor as any) as Decoratable;

        if (Class.typedFields) {
            for (const key in Class.typedFields) {
                if (Class.typedFields.hasOwnProperty(key)) {
                    this.updateField(key, Class.typedFields[key]);
                }
            }
        }

        return <any>this;
    }

    private updateField(key: string, Type: any) {
        let self = <any>this;

        if (Type._instantiate) {
            self[key] = Type._instantiate(self[key]);
        } else {
            self[key] = new Type(self[key]);
        }
    }

    async remove():Promise<void>{
        let coll = await this.getCollection();

        await coll.deleteOne({_id:this._id});

        delete this._id
    }

    static async removeMany(filter: any):Promise<void>{
        let coll = await this._getCollection();

        await coll.deleteMany(filter);
    }

    public isNew(){
        return _.isNil(this._id) || this._odmIsNew;
    }

    protected static _instantiate<Type extends DatabaseObject>(obj: Partial<Type>, ctor?: new () => Type): Type {
        let self = ctor || <any>this;

        let ret = new self();
        let Class = ret.constructor as Decoratable;
        delete ret._odmIsNew;
        if (Class.fields) {
            Object.assign(ret, _.pick(obj, Class.fields));
        } else {
            Object.assign(ret, obj)
        }

        ret.updateFields()
        return ret
    }

    private async getCollection(): Promise<MongoLikeCollection> {
        const Class = this.constructor as any;
        return Class._getCollection();
    }

    private isLockable(): LockOptions | boolean {
        const Class = this.constructor as any;
        return Class.getLockOptions() || false;
    }

    public static getCollectionName(): string {
        const Class = (this as any) as Decoratable;
        return (Class.hasOwnProperty("collectionName") && Class.collectionName) || (this.name.toLocaleLowerCase() + "s");
    }

    public static getLockOptions(): LockOptions {
        const Class = (this as any) as Decoratable;
        return Class._odmLockable;
    }

    private static async _getCollection(): Promise<MongoLikeCollection> {
        const Class = (this as any) as (hasCollection & Decoratable);
        if (!(Class.collection && Class.hasOwnProperty("collection"))) {
            Class.collection = await DB.collection(Class.getCollectionName());
            const listener = function() {
                delete Class.collection;
                DB.removeListener(DB.EVENT_DISCONNECTED, listener);
                DB.removeListener(DB.EVENT_CONNECTED, listener);
            };
            DB.addListener(DB.EVENT_DISCONNECTED, listener);
            DB.addListener(DB.EVENT_CONNECTED, listener);
        }
        return Class.collection;
    }

    public async lock(ttlMillis?: number) {
        const lockOptions = this.isLockable();

        const ttl = ttlMillis || _.get(lockOptions, "ttlMillis") || 1000;
        const timeout = ttl === -1 ? Number.MAX_SAFE_INTEGER : Date.now() + ttl;
        const _odmLock = {
            uuid: _.get(this, "_odmLock.uuid") || uuidv4(),
            timeout: timeout
        } as OdmLock;

        const selector = {
            _id: this._id,
            $or: [
                {_odmLock: null},
                {"_odmLock.timeout": {$lt: Date.now()}}
            ]
        } as any;

        const coll = await this.getCollection();
        const result = await coll.findOneAndUpdate(selector,
            {$set: {
                _odmLock
            }}, {returnDocument: ReturnDocument.AFTER}) as WithId<Document>;

        if (!result) {
            throw new Error("Setting lock on document failed.");
        }

        this._odmLock = result._odmLock;
        return this;
    }

    public async waitForLock(ttlMillis?: number) {
        try {
            await this.lock(ttlMillis);
        } catch(err) {
            if (err.message === "Setting lock on document failed.") {
                await setTimeout(10);
                return this.waitForLock(ttlMillis);
            } else {
                throw err;
            }
        }

        return this;
    }

    public async releaseLock(): Promise<this> {
        const coll = await this.getCollection();
        if (!this._odmLock) {
            return;
        }
        await coll.findOneAndUpdate({_id: this._id, "_odmLock.uuid": this._odmLock.uuid},
            {$unset: {
                 _odmLock: ""
            }});
        delete this._odmLock;

        return this;
    }ts

    public getPlainOldObject<T extends object>(): T {
        return _.omit(this, "_id", "_odmIsNew", "_odmLock") as T;
    }

}