import {
    MongoClient,
    CollectionInsertOneOptions,
    InsertOneWriteOpResult,
    FindOneAndUpdateOption,
    FindAndModifyWriteOpResultObject,
    MongoCountPreferences,
    CommonOptions,
    DeleteWriteOpResultObject,
    Cursor,
    UpdateOneOptions,
    UpdateWriteOpResult,
    MongoClientCommonOption
} from "mongodb";
import {DbCollectionOptions} from "mongodb";

export {DatabaseObject} from './DatabaseObject';

export interface MongoLikeClient {
    db(name: string): MongoLikeDb;
    connect(): Promise<MongoLikeClient>;
    isConnected(options?: MongoClientCommonOption): boolean;
    close(force?: boolean): Promise<void>;
}

export interface MongoLikeDb {
    collection(name: string, options?: DbCollectionOptions): MongoLikeCollection;
    collections(): Promise<MongoLikeCollection[]>;
}

export interface MongoLikeCollection {
    findOne(selector): Promise<any>;
    find(selector): Cursor;
    insertOne(docs: any, options?: CollectionInsertOneOptions): Promise<InsertOneWriteOpResult>;
    updateOne(filter, update, options?: UpdateOneOptions): Promise<UpdateWriteOpResult>;
    findOneAndUpdate(filter, update, options?: FindOneAndUpdateOption): Promise<FindAndModifyWriteOpResultObject>;
    countDocuments(query?, options?: MongoCountPreferences): Promise<number>;
    deleteMany(filter, options?: CommonOptions): Promise<DeleteWriteOpResultObject>;
    deleteOne(filter, options?: CommonOptions & { bypassDocumentValidation?: boolean }): Promise<DeleteWriteOpResultObject>;
}

export class _DB {
    private client: MongoLikeClient;
    private db: MongoLikeDb;
    private stateConnecting = false;

    public setClient(client: MongoLikeClient) {
        this.client = client;
    }

    public setDb(db: MongoLikeDb) {
        this.db = db;
    }

    public async mongoConnect(uri:string, user?:string, password?:string, authSource = "admin", reconnect = false)  {

        if ((!this.isConnected() || reconnect) && !this.stateConnecting) {
            this.stateConnecting = true;
            if (this.isConnected()) {
                await this.disconnect();
            }

            const server = uri.substr(uri.indexOf("//") + 2); //.substr(0, uri.lastIndexOf("/") - 1)
            const db = uri.substr(uri.lastIndexOf("/") + 1);

            let pwd = "";
            let auth = "";
            if(user && password) {
                pwd = encodeURIComponent(user) + ":" + encodeURIComponent(password) + "@";
            }
            if (authSource) {
                auth = "?authSource=" + authSource;
            }

            const url = "mongodb://" + pwd + server + authSource;

            this.client = await MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true } );
            this.db = await this.client.db(db);
            this.stateConnecting = false;
        }
    }

    public async disconnect(force?:boolean) {
        if(this.client) {
            await this.client.close(force);
        }
        this.client = null;
    }

    public isConnected() {
        if (this.client && this.client.isConnected()) {
            return true;
        } else {
            return false;
        }
    }

    public async collection(name: string, options?: DbCollectionOptions): Promise<MongoLikeCollection> {
        return this.db.collection(name, options);
    }
    public async collections(): Promise<MongoLikeCollection[]> {
        return this.db.collections();
    }

}

export let DB = new _DB();
