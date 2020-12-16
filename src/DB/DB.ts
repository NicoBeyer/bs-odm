import {
    MongoClient,
    CollectionInsertOneOptions,
    InsertOneWriteOpResult,
    FindOneAndUpdateOption,
    UpdateManyOptions,
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
import {EventEmitter} from "events";

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
    insertOne(docs: any, options?: CollectionInsertOneOptions): Promise<InsertOneWriteOpResult<any>>;
    updateOne(filter, update, options?: UpdateOneOptions): Promise<UpdateWriteOpResult>;
    findOneAndUpdate<T>(filter, update, options?: FindOneAndUpdateOption<T>): Promise<FindAndModifyWriteOpResultObject<any>>;
    updateMany(filter, update, options?: UpdateManyOptions): Promise<UpdateWriteOpResult>;
    countDocuments(query?, options?: MongoCountPreferences): Promise<number>;
    deleteMany(filter, options?: CommonOptions): Promise<DeleteWriteOpResultObject>;
    deleteOne(filter, options?: CommonOptions & { bypassDocumentValidation?: boolean }): Promise<DeleteWriteOpResultObject>;
}

export class _DB extends EventEmitter {
    public readonly EVENT_CONNECTING = "connecting";
    public readonly EVENT_CONNECTED = "connected";
    public readonly EVENT_DISCONNECTING = "disconnecting";
    public readonly EVENT_DISCONNECTED = "disconnected";

    private client: MongoLikeClient;
    private db: MongoLikeDb;
    private stateConnecting = false;

    public setClient(client: MongoLikeClient) {
        this.client = client;
        this.emit("connected", this);
    }

    public setDb(db: MongoLikeDb) {
        this.db = db;
        this.emit("connected", this);
    }

    public async mongoConnect(uri:string, user?:string, password?:string, authSource = "admin", reconnect = false)  {

        if ((!this.isConnected() || reconnect) && !this.stateConnecting) {
            this.emit("connecting", this);
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
            this.emit("connected", this);
        }
    }

    public async disconnect(force?:boolean) {
        this.emit("disconnecting", this);
        if(this.client) {
            await this.client.close(force);
        }
        this.client = null;
        this.db = null;
        this.emit("disconnected", this);
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
