# Test fixtures with MongoDB is as easy as ABC [![NPM Version](https://img.shields.io/npm/v/@natlibfi/fixura-mongo.svg)](https://npmjs.org/package/@natlibfi/fixura-mongo) [![Build Status](https://travis-ci.org/NatLibFi/fixura-mongo-js.svg)](https://travis-ci.org/NatLibFi/fixura-mongo-js) [![Test Coverage](https://codeclimate.com/github/NatLibFi/fixura-mongo-js/badges/coverage.svg)](https://codeclimate.com/github/NatLibFi/fixura-mongo-js/coverage)

Test fixtures with MongoDB is as easy as ABC with Fixura.

# Usage
## ES modules
```js
import mongoFixturesFactory from '@natlibfi/fixura-mongo';
const mongoFixtures = fixturesFactory({rootPath: [__dirname, '...', 'test-fixtures']});
await mongoFixtures.populate(['dbContents.json']);
await mongoFixtures.dump();
```
## Node.js require
```js
import {default: mongoFixturesFactory} from '@natlibfi/fixura-mongo';
const mongoFixtures = fixturesFactory({rootPath: [__dirname, '...', 'test-fixtures']});
await mongoFixtures.populate(['dbContents.json']);
await mongoFixtures.dump();
```
# Configuration
## Factory parameters
- **rootPath**: An array of directory names to construct the path to the test fixtures directory
- **gridFS**: An optional parameter which enables using gridFS functions. Can be boolean or an object:
  - **bucketName**: The name of the gridFS bucket to create (Optional)
### Mongo instance
By default, fixura-mongo uses [mongodb-memory-server](https://www.npmjs.com/package/mongodb-memory-server). For using an externally started Mongo, set environment variable `MONGO_URI`.
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
### getConnectionString
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
The path is then resolved using the root directory defined in the factory function (`rootPath`).
```
### dumpFiles (GridFS)
Dumps the files from the database. The format is an object with filenames as properties and their values are Readable streams. Passing `true` as the sole function arguments returns file contents as property values. Like so:
```js
const data = await mongoFixtures.dumpFiles(true);
typeof data === 'string'
// true
```
### clearFiles (GridFS)
Removes all files from the database
## License and copyright

Copyright (c) 2019 **University Of Helsinki (The National Library Of Finland)**

This project's source code is licensed under the terms of **GNU Lesser General Public License Version 3** or any later version.
