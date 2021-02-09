import {DatabaseObject, MongoLikeClient, MongoLikeCollection} from "../db/DB";
import * as _ from "lodash";


export class EnhancedFilterQuery {

    public static extractSortQuery(filterQuery: any) {
        const ret = {
            sortQuery: {},
            filterQuery: {}
        };

        _.forEach(filterQuery, (value, key) => {
            if (value.$max) {
                ret.sortQuery[key] = -1;
            } else if (value.$min) {
                ret.sortQuery[key] = 1;
            } else {
                ret.filterQuery[key] = filterQuery[key];
            }
        });

        Object.keys(filterQuery).forEach(key => {

        });

        return ret;
    }

    public static async findOne(collection: MongoLikeCollection, selector: any): Promise<any> {
        const extract = this.extractSortQuery(selector);

        if (_.isEmpty(extract.sortQuery)) {
            return collection.findOne(selector);
        } else {
            const res = await collection.find(extract.filterQuery).sort(extract.sortQuery).limit(1).toArray();
            return res[0];
        }
    }
}
