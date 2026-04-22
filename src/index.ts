import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, ObjectId} from 'mongodb';
import fixturesFactory, {READERS} from '@natlibfi/fixura';
import gridFSFactory from './gridfs.ts';

export default async function ({rootPath, gridFS, useObjectId, format}:
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  {rootPath: string[], gridFS?: any, useObjectId?: boolean, format?: any}
) {
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

  // MARK: close
  const close = async () => {
    await clear();
    await closeCallback();
  };

  return {populate, dump, clear, close, getUri};

  // MARK: clear
  async function clear() {
    const client = await getClient();
    await client.db().dropDatabase();
    return client.close();
  }

  // MARK: populate
  async function populate(input) {
    const data = Array.isArray(input) ? clone(getFixture({components: input})) : clone(input);
    const client = await getClient();

    await clear();

    await Promise.all(Object.keys(data).map(async name => {
      const collection = await client.db().createCollection(name);

      if (format && name in format) {
        data[name] = data[name].map(formatValues);
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

  // MARK: dump
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

  // MARK: getClient
  async function getClient() {
    const mongoUri = await getUri();
    if (mongoUri && typeof mongoUri === 'string') {
      return MongoClient.connect(mongoUri, {});
    }

    throw new Error('Mongo connection uri missing');
  }

  // MARK: clone
  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  // MARK: getMongoMethods
  async function getMongoMethods() {
    if ('MONGO_TEST_URI' in process.env) {
      return {
        getUri: () => process.env['MONGO_TEST_URI'],
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        closeCallback: () => { }
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
