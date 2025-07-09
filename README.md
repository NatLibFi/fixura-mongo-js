# Test fixtures with MongoDB is as easy as ABC [![NPM Version](https://img.shields.io/npm/v/@natlibfi/fixura-mongo.svg)](https://npmjs.org/package/@natlibfi/fixura-mongo) [![Build Status](https://travis-ci.org/NatLibFi/fixura-mongo-js.svg)](https://travis-ci.org/NatLibFi/fixura-mongo-js) [![Test Coverage](https://codeclimate.com/github/NatLibFi/fixura-mongo-js/badges/coverage.svg)](https://codeclimate.com/github/NatLibFi/fixura-mongo-js/coverage)

Test fixtures with MongoDB is as easy as ABC with Fixura.

**COMPATIBLE: MONGO 4.X**
**NOT COMPATIBLE: MONGO 3.X**

# Usage
## ES modules
```js
import mongoFixturesFactory from '@natlibfi/fixura-mongo';
const mongoFixtures = await fixturesFactory({rootPath: [__dirname, '...', 'test-fixtures']});
await mongoFixtures.populate(['dbContents.json']);
await mongoFixtures.dump();
```
## Node.js require
```js
import {default: mongoFixturesFactory} from '@natlibfi/fixura-mongo';
const mongoFixtures = await fixturesFactory({rootPath: [__dirname, '...', 'test-fixtures']});
await mongoFixtures.populate(['dbContents.json']);
await mongoFixtures.dump();
```
# Configuration
## Factory parameters
- **rootPath**: An array of directory names to construct the path to the test fixtures directory
- **useObjectId**: A boolean indicating whether **_id** property in documents should be cast as Mongo ObjectId. Defaults to false.
- **format**: An object of collection name - document property mapping with formatting functions as values (See examples below)
- **gridFS**: An optional parameter which enables using gridFS functions. Can be boolean or an object:
  - **bucketName**: The name of the gridFS bucket to create (Optional)
### Mongo instance
By default, fixura-mongo uses [mongodb-memory-server](https://www.npmjs.com/package/mongodb-memory-server). For using an externally started Mongo, set environment variable `MONGO_TEST_URI`.
# Usage
## Functions
All functions are asynchronous.
### populate
Populate the database with test data. Accepts the data as a string or an array which defines the path to the fixture file (See [fixura]https://www.npmjs.com/package/@natlibfi/fixura).

The format of the fixture is as follows:
```js
{
    "foo": [{"fubar": "bar"}]
}
```
The object properties are collection names and their value is an array of documents to insert into the collection.
### dump
Dumps the database in the same format as the fixture.
### clear
Clears the database.
### close
Clears and stops the database (Stopping is only applicable to mongodb-memory-server),
### getUri
Returns the URI of the server. Used for connecting clients to the database.
### populateFiles (GridFS)
Populates the database with files using [GridFS](https://docs.mongodb.com/manual/core/gridfs/). The format is as follows:
```js
{
    "foo": "bar"
}
```
Where object properties are filenames and their values their content. This alternative format provides the path to file contents instead of defining it inline:
```js
{
    "foo": ["bar", "content.txt"]
}
```
The path is then resolved using the root directory defined in the factory function (`rootPath`).
### dumpFiles (GridFS)
Dumps the files from the database. The format is an object with filenames as properties and their values are Readable streams. Passing `true` as the sole function arguments returns file contents as property values. Like so:
```js
const data = await mongoFixtures.dumpFiles(true);
typeof data === 'string'
// true
```
### clearFiles (GridFS)
## Examples
Using the `format` parameter:
```js
import mongoFixturesFactory from '@natlibfi/fixura-mongo';

const mongoFixtures = await fixturesFactory({
  rootPath: [__dirname, '...', 'test-fixtures'],
    format: {
      foo: {
        bar: v => new Date(v)
        }
    }
});

// Populates the database and formats the 'bar'-properties in documents of the foo'-collection as Dates
await mongoFixtures.populate(['dbContents.json']);

```

## Example with fixugen NODE 22+
```js
import assert from 'node:assert';
import {READERS} from '@natlibfi/fixura';
import mongoFixturesFactory from '@natlibfi/fixura-mongo';
import {Error as ApiError} from '@natlibfi/melinda-commons';
import generateTests from '@natlibfi/fixugen';

describe('Stuff/to/be/tested', () => {
  let mongoFixtures; // eslint-disable-line functional/no-let

  generateTests({
    callback,
    path: [__dirname, '..', '..', 'test-fixtures', 'path', 'to', 'tests'],
    recurse: false,
    useMetadataFile: true,
    fixura: {
      failWhenNotFound: true,
      reader: READERS.JSON
    },
    hooks: {
      before: async () => {
        mongoFixtures = await mongoFixturesFactory({
          rootPath: [__dirname, '..', '..', 'test-fixtures', 'path', 'to', 'tests'],
          gridFS: {bucketName: 'blobs'},
          useObjectId: true,
          format: {
            blobmetadatas: {
              creationTime: v => new Date(v),
              modificationTime: v => new Date(v)
            }
          }
        });
        //TODO connect to mongo (await mongoFixtures.getUri())
      },
      beforeEach: async () => {
        await mongoFixtures.clear();
      },
      afterEach: async () => {
        await mongoFixtures.clear();
      },
      after: async () => {
        // TODO Disconnect from mongofixtures
        await mongoFixtures.close();
      }
    }
  });

  async function callback({
    getFixture,
    expectToFail = false,
    expectedFailStatus = ''
  }) {
    try {
      const dbContents = getFixture('dbContents.json');
      const expectedDb = getFixture('expectedDb.json');

      // TODO load operation related stuff

      await mongoFixtures.populate(dbContents);

      // TODO stuff to mongo db

      const db = await mongoFixtures.dump();

      assert.deepStrictEqual(db, expectedDb);
      assert.equal(expectToFail, false, 'This is expected to succes');
    } catch (error) {
      if (!expectToFail) {
        throw error;
      }
      assert.equal(expectToFail, true, 'This is expected to fail');
      assert(error instanceof ApiError);
      assert.equal(error.status, expectedFailStatus);
    }
  }
});
```

Removes all files from the database
## License and copyright

Copyright (c) 2019-2022, 2024-2025 **University Of Helsinki (The National Library Of Finland)**

This project's source code is licensed under the terms of **MIT** or any later version.
