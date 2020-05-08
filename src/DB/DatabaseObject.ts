/**
 * Created by lukee_000 on 17.02.2017.
 */
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
        let coll = await this.getCollection();
        let Class = (this.constructor as any) as Decoratable;

        let obj:any
        if (Class.fields && Class.fields.length > 0) {
            obj = _.assign({}, _.pick(this, Class.fields));
        } else if (Class.excludedFields && Class.excludedFields.length > 0){
            obj = _.omit(this, Class.excludedFields);
        } else {
            obj = this;
        }

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
            let result = await coll.updateOne({_id: this._id}, {$set: obj}, {upsert:true});
            if(result.result.ok != 1){
                throw new Error('Unable to update document _id=' + this._id + ' in collection '+ (<any>this.constructor).getCollectionName());
            }
        }

        return this;
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

    static async findOneAndUpdate<Type extends DatabaseObject>(filter: any, update: any, options?: FindOneAndReplaceOption):Promise<Type>{
        let self = this as any
        let coll = await this._getCollection();

        let result = await coll.findOneAndUpdate(filter, update, options)

        if(result.value){
            return this.instantiate<Type>(result.value)
        }else{
            return null
        }
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
        let self = <any>this;
        let Class = (this.constructor as any) as Decoratable;

        if (Class.typedFields) {
            for (const key in Class.typedFields) {
                self[key] = new Class.typedFields[key](self[key]);
            }
        }

        return <Type>self
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
        return Class.collection || (Class.collection = await DB.collection(Class.getCollectionName()));
    }

}