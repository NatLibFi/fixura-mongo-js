import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, ObjectId} from 'mongodb';
import fixturesFactory, {READERS} from '@natlibfi/fixura';
import gridFSFactory from './gridfs.js';

export default async function ({rootPath, gridFS = false, useObjectId = false, format} = {}) {
  const {getFixture} = fixturesFactory({root: rootPath, reader: READERS.JSON});
  const {getUri, closeCallback} = await getMongoMethods();

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

      if (format && name in format) { // eslint-disable-line functional/no-conditional-statements
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
    const data = await Promise.all(collections.map(async collection => {
      const results = await collection.find({}, {projection: {_id: 0}}).toArray();
      return {[collection.collectionName]: results};
    }));

    await client.close();

    return data.reduce((acc, collection) => ({...acc, ...collection}), {});
  }

  async function getClient() {
    return MongoClient.connect(await getUri(), {});
  }

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  async function getMongoMethods() {
    /* istanbul ignore next: This won't be tested */
    if ('MONGO_TEST_URI' in process.env) { // eslint-disable-line no-process-env
      return {
        getUri: () => process.env.MONGO_TEST_URI, // eslint-disable-line no-process-env
        closeCallback: () => { } // eslint-disable-line no-empty-function
      };
    }

    const Mongo = await MongoMemoryServer.create();

    return {
      getUri: () => Mongo.getUri(),
      closeCallback: async () => {
        await Mongo.stop();
      }
    };
  }
}
