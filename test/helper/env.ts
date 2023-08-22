
export const MONGO = process.env.MONGO_URL ?
    process.env.MONGO_URL + "/bs-odm-test" :
    "mongodb://127.0.0.1:27017/bs-odm-test";