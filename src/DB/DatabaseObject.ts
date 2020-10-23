import {DB, MongoLikeCollection} from './DB'
import {FindOneAndReplaceOption} from "mongodb";
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
        let self = this as any
        let ret = [] as Type[]
        return DatabaseObject.findEach.call(this, selector, (obj:Type)=>{
            ret.push(obj)
        }, options).then(()=>{
            return ret;
        })
    }

    static async findOne<Type extends DatabaseObject>(selector = {} as any):Promise<Type>{
        const coll = await this._getCollection();
        let self = this as any
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
            return Promise.resolve().then(async (next)=>{
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
        const Class = this.constructor as any;
        let coll = await this.getCollection();

        let obj = Class.pickFields(this);

        if(fields){
            obj = this.copyFields(fields, obj)
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

    private static pickFields(obj: any) {
        let Class = (this as any) as Decoratable;

        let ret:any
        if (Class.fields && Class.fields.length > 0) {
            ret = _.assign({}, _.pick(obj, Class.fields));
        } else if (Class.excludedFields && Class.excludedFields.length > 0){
            ret = _.omit(obj, Class.excludedFields);
        } else {
            ret = obj;
        }

        return ret;
    }

    public copyFields(fields:any, source:DatabaseObject):any{
        let ret = {}

        for(let key in fields){
            let field = key

            if(typeof fields[key] === 'object'){
                let f = this.copyFields(fields[key], source[key]);
                for(let k in f){
                    ret[key + '.' + k] = f[k]
                }
            }else if(fields[key]){
                ret[key] = source[key]
            }
        }

        return ret
    }

    static async findOneAndUpdate<Type extends DatabaseObject>(filter: any, update: any, options?: FindOneAndReplaceOption<Type>):Promise<Type>{
        let self = this as any
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

    private static validateFields(obj: any) {
        let Class = (this as any) as Decoratable;

        let error = false;
        const objectKeys = _.keys(obj);
        if (Class.fields && Class.fields.length > 0){
            const intersection = _.intersection(Class.fields, objectKeys);
            if (intersection.length !== objectKeys.length) {
                throw new Error("Update object contains fields not defiend for " + this.name +
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


    static async count<Type extends DatabaseObject>(filter: any):Promise<number>{
        let self = this as any
        let coll = await this._getCollection();

        let result = await coll.countDocuments(filter);

        return result;
    }

    /**
     * Overwrite to instantiate properties
     * @returns {Type}
     */
    protected updateFields<Type extends DatabaseObject>():Type {
        let Class = (this.constructor as any) as Decoratable;

        if (Class.typedFields) {
            for (const key in Class.typedFields) {
                this.updateField(key, Class.typedFields[key]);
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