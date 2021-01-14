import {DB, MongoLikeCollection} from './DB'
import {FindOneAndReplaceOption, ObjectId} from "mongodb";
import * as _ from "lodash";
import {Decoratable} from "./Decorators";

export interface IInstantiatable {
    instantiate<Type extends DatabaseObject>(obj:any):Type;
}

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

    public _id:any

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
        let obj = await coll.findOne(selector)

        if(!obj){
            return null
        }

        return this.instantiate<Type>(obj)
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
                        let obj = self.instantiate<Type>(next)
                        let ret = iterator(obj)
                        promises.push(ret)
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
            let result = await coll.findOneAndUpdate(
                {_id: this._id},
                {$set: obj},
                {
                    upsert:true,
                    returnOriginal: false
                });

            Object.assign(this, result);

            this.updateFields()
        }

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
        if (Array.isArray(obj)) {
            return obj.map(o => this.pickFields(o));
        } else if (typeof obj === "object") {
            const Class = (obj.constructor as any) as Decoratable;
            if (obj instanceof Date) {
                return obj;
            } else if (obj instanceof ObjectId) {
                return obj;
            }else if (Class.fields) {
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

    public static async findOneAndUpdate<Type extends DatabaseObject>(filter: any, update: any, options?: FindOneAndReplaceOption<Type>):Promise<Type>{
        let coll = await this._getCollection();

        _.keys(update).forEach((key) => {
            this.validateFields(update[key]);
            if (key === "$rename") {
                this.validateFields(this.invertObject(update[key]));
            }
        });

        let result = await coll.findOneAndUpdate(filter, update, options)

        if(result.value){
            return this.instantiate<Type>(result.value)
        }else{
            return null
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
     * Overwrite to instantiate properties
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

        if (Type.instantiate) {
            self[key] = Type.instantiate(self[key]);
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

    isNew(){
        return typeof this._id === 'undefined'
    }

    public static instantiate<Type extends DatabaseObject>(obj: any):Type{
        let self = <any>this;
        let Class = (this.constructor as any) as Decoratable;

        let ret = new self()
        if (Class.fields) {
            Object.assign(ret, + _.pick(obj, Class.fields));
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

    public static getCollectionName(): string {
        const Class = (this as any) as Decoratable;
        return Class.collectionName || (Class.collectionName = this.name.toLocaleLowerCase() + "s");
    }

    private static async _getCollection(): Promise<MongoLikeCollection> {
        const Class = (this as any) as (hasCollection & Decoratable);
        if (!Class.collection) {
            Class.collection = await DB.collection(Class.getCollectionName());
            DB.addListener(DB.EVENT_DISCONNECTED, () => {
                delete Class.collection;
            });
            DB.addListener(DB.EVENT_CONNECTED, () => {
                delete Class.collection;
            });
        }
        return Class.collection;
    }

}