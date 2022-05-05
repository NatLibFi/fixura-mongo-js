/**
*
* @licstart  The following is the entire license notice for the JavaScript code in this file.
*
* Test fixtures with MongoDB is as easy as ABC
*
* Copyright (C) 2019 University Of Helsinki (The National Library Of Finland)
*
* This file is part of fixura-mongo-js
*
* fixura-mongo-js program is free software: you can redistribute it and/or modify
* it under the terms of the GNU Lesser General Public License as
* published by the Free Software Foundation, either version 3 of the
* License, or (at your option) any later version.
*
* fixura-mongo-js is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Lesser General Public License for more details.
*
* You should have received a copy of the GNU Lesser General Public License
* along with this program.  If not, see <http://www.gnu.org/licenses/>.
*
* @licend  The above is the entire license notice
* for the JavaScript code in this file.
*
*/

import MongoMemoryServer from 'mongodb-memory-server';
import {MongoClient, ObjectId} from 'mongodb';
import fixturesFactory, {READERS} from '@natlibfi/fixura';
import gridFSFactory from './gridfs';

export default async function ({rootPath, gridFS = false, useObjectId = false, format} = {}) {
  const {getFixture} = fixturesFactory({root: rootPath, reader: READERS.JSON});
  const {getUri, closeCallback} = getMongoMethods();

  if (gridFS) {
    const {populateFiles, dumpFiles, clearFiles} = gridFSFactory({client: await getClient(), rootPath, ...gridFS});
    const close = async () => {
      await clearFiles();
      await clear();
      await closeCallback();
    };

    return {populate, dump, clear, close, getUri, populateFiles, dumpFiles, clearFiles};
  }

  const close = async () => {
    await clear();
    await closeCallback();
  };

  return {populate, dump, clear, close, getUri};

  async function clear() {
    const client = await getClient();
    await client.db().dropDatabase();
    return client.close();
  }

  async function populate(input) {
    const data = Array.isArray(input) ? clone(getFixture({components: input})) : clone(input);
    const client = await getClient();

    await clear();

    await Promise.all(Object.keys(data).map(async name => {
      const collection = await client.db().createCollection(name);

      if (format && name in format) { // eslint-disable-line functional/no-conditional-statement
        data[name] = data[name].map(formatValues); // eslint-disable-line functional/immutable-data
      }

      if (useObjectId) {
        return collection.insertMany(data[name].map(formatObjectId));
      }

      return collection.insertMany(data[name]);

      function formatValues(o) {
        return Object.keys(o).reduce((acc, key) => {
          if (key in format[name]) {
            const cb = format[name][key];

            return {
              ...acc,
              [key]: cb(o[key])
            };
          }

          return {...acc, [key]: o[key]};
        }, {});
      }

      function formatObjectId(o) {
        return Object.keys(o).reduce((acc, key) => {
          if (key === '_id') {
            return {...acc, [key]: new ObjectId(o[key])};
          }

          return {...acc, [key]: o[key]};
        }, {});
      }
    }));

    return client.close();
  }

  async function dump() {
    const client = await getClient();
    const collections = await client.db().collections();
    const data = await Promise.all(collections.map(collection => new Promise((resolve, reject) => {
      const docs = [];

      collection.find({})
        .on('error', reject)
        .on('end', () => {
          resolve({[collection.collectionName]: docs});
        })
        .on('data', doc => {
          delete doc.__v; // eslint-disable-line functional/immutable-data
          delete doc._id; // eslint-disable-line functional/immutable-data
          docs.push(JSON.parse(JSON.stringify(doc))); // eslint-disable-line functional/immutable-data
        });
    })));

    await client.close();

    return data.reduce((acc, collection) => ({...acc, ...collection}), {});
  }

  async function getClient() {
    return MongoClient.connect(await getUri(), {useNewUrlParser: true});
  }

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function getMongoMethods() {
    /* istanbul ignore next: This won't be tested */
    if ('MONGO_TEST_URI' in process.env) { // eslint-disable-line no-process-env
      return {
        getUri: () => process.env.MONGO_TEST_URI, // eslint-disable-line no-process-env
        closeCallback: () => { } // eslint-disable-line no-empty-function
      };
    }

    const Mongo = new MongoMemoryServer();

    return {
      getUri: () => Mongo.getUri(),
      closeCallback: async () => {
        const {childProcess} = Mongo.getInstanceInfo();

        if (childProcess && !childProcess.killed) { // eslint-disable-line functional/no-conditional-statement
          await Mongo.stop();
        }
      }
    };
  }
}
