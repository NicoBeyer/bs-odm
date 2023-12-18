import {Collection, CollectionOptions, MongoClient, MongoClientOptions} from "mongodb";
import {EventEmitter} from "events";

export {DatabaseObject} from './DatabaseObject';

export interface MongoLikeClient {
    db(name: string): MongoLikeDb;
    connect(): Promise<MongoLikeClient>;
    close(force?: boolean): Promise<void>;
}

export interface MongoLikeDb {
    collection(name: string, options?: CollectionOptions): MongoLikeCollection;
    collections(): Promise<MongoLikeCollection[]>;
}

export interface MongoLikeCollection extends Pick<Collection, "findOne" | "find" |
    "insertOne" | "updateOne" | "findOneAndUpdate" | "updateMany" |
    "countDocuments" | "deleteMany" | "deleteOne"> {}

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

    public async mongoConnect(uri:string, user?:string, password?:string, authSource?: string, reconnect = false)  {

        if ((!this.isConnected() || reconnect) && !this.stateConnecting) {
            this.emit("connecting", this);
            this.stateConnecting = true;
            if (this.isConnected()) {
                await this.disconnect();
            }

            const db = uri.substring(uri.lastIndexOf("/") + 1);

            const mongoClientOptions = {
                ignoreUndefined: true
            } as MongoClientOptions;
            if (user) {
                mongoClientOptions.auth = {
                    username: user,
                    password
                }
            }

            if (authSource) {
                mongoClientOptions.authSource = authSource;
            }

            this.client = new MongoClient(uri, mongoClientOptions);
            await this.client.connect();

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
        return !!this.client;
    }

    public async collection(name: string, options?: CollectionOptions): Promise<MongoLikeCollection> {
        return this.db.collection(name, options);
    }
    public async collections(): Promise<MongoLikeCollection[]> {
        return this.db.collections();
    }

}

export let DB = new _DB();
