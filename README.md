# bs-odm

Setting up your database mapper can become very cumbersome. Defining schemas, properties, deriving Models etc, etc.
All this has its place, but sometimes you just want to create objects dump them into your database, retrieve them, modify them and be done with it.

This is where bs-odm comes in. It allows you to do just that.
Create a class, extend it with DatabaseObject, and then save and find as much as you like.

## Installation

    $ npm install bs-odm --save
    $ npm install mongodb --save
    
## Getting Started

```js
import {DatabaseObject, DB} from "bs-odm"

export class Example extends DatabaseObject {
    public property: any;
}
(async () => {
    await DB.mongoConnect("mongodb://localhost/database");
    
    const example = new Example();
    example.property = "Example";
    await example.save();
    
    const examples = await Example.find();

    await DB.disconnect(true);
})().catch((e) => {
    console.error(e.stack)
})
```

## Manual
### DatabaseObjects

To create a class whose instances can be stored in the database, extend from DatabaseObject:

    export class Example extends DatabaseObject {
        public property: any;
    }
    
    const example = new Example();

All properties of an instance are stored to the database. For more control over which properties to store see section Descriptors.

To store an instance to the database call:

    await example.save();
    
Sometimes it is desirable to just update some fields on an existing instance to the database.
e.g. to prevent from overwriting data already present in the database.
So you can specify the fields to update:

    await example.save({property: 1});

For retrieving objects you can call the static functions on the class:

    examples = await Example.find<Example>({});
    examples = await Example.findOne<Example>({property: "Selector"});
    examples = await Example.findEach<Example>({}, example => {
        console.log(example.property);
    });
    
For transactional updates:
    
    const example = await Example.findOneAndUpdate({_id: id}, {property: "New"});
    
Remove an instance from database:

    await example.remove();
    
Remove multiple instances from database:

    await Example.removeMany({selector: "Some"});

### Decorators

#### @field

To include just some properties of an instance, add the @field decorator to each included property.

    class Example extends DatabaseObject {
        @field()
        included: string;
        
        excluded: string;
    }
    
All properties without an @field decorator are not stored in the database.

The @field decorator is optional. If you have no @field decorator specified, all properties are stored.

You can pass a Type to the @field decorator to indicate that the type should be initialized with the Type.
The type constructor must take an object as parameter that contains the properties of the Type.
As an alternative the Type can implement the static method _instantiate_ to take the object and initialize the instance.

    class SubDocument {
        property: string;
        
        // Option1 
        constructor(obj: {property: string}) {
            this.property = obj.property;
        } 
        
        // Option 2
        public static _instantiate(obj: {property: string}) {
            return new SubDocument(obj);
        }
    }
    
    class Example extends DatabaseObject {
        @field(SubDocument)
        subDoc: SubDocument
    }

#### @exclude

Sometimes you might just want to exlude some fields. e.g. too much bother to mark every field, or the schema ist variable.
Then you can do so with the @exclude decorator. If you have @field decorators specified, this is not necessary.

    class Example extends DatabaseObject {
        included: string;
        
        @exclude()
        excluded: string;
    }

#### @collection

The default collection name to store the instances is classname to lower case appended with an 's'.

e.g. SomeObject = someobjects

You can override this with the @collection decorator.

    @collection("anotherCollection")
    class Example extends DatabaseObject {
        property: string;
    }

#### Decorators on Nested Classes

You can use decorators to control the fields stored on nested classes.

    class Example extends DatabaseObject {
        nested: Nested;
        nestedArray: Nested[];
    }

    class Nested {
        @field()
        fields: any;

        @excluded()
        excludedField: any
    }


### Bring your own NoSQL database

bs-odm supports mongodb out of the box. You can directly connect to the database by calling the appropriate functions on the global DB object:

    await DB.mongoConnect("mongodb://localhost/database");
        
    await DB.disconnect(true);

MongoDb ist great, but it is always nice to be independent.
If you want to have more control over the connection you can bring your own client:

    const client: MongoLikeClient = ... // Your own client initialization
    
    DB.setClient(client)
    
...or your own database object:

    const db: MongoLikeDb = ... // Your own database initialization
    
Those don't have to be MongoDb, als long as the objects satisfy the MongoLikeClient or MongoLikeDb interface contracts,
you can bring whichever database backend you like.

## Locking

It is possible to lock documents to make sure that concurrent 

## Enhanced Filter Query

Since _DatabaseObject_ ist hiding most of the database features, the FilterQuery for the selectors is enhanced to provide often needed functionality.

### Query $min and $max values

This is equivalent to doing 

    obj.findOne({numValue: {$max: 1}}); // finds the document with the max value of numValue
    obj.findOne({numValue: {$min: 1}}); // finds the document with the min value of numValue

