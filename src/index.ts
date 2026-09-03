import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, ObjectId} from 'mongodb';
import type {Document, GridFSBucketReadStream} from 'mongodb';
import fixturesFactory, {READERS} from '@natlibfi/fixura';
import gridFSFactory from './gridfs.ts';

export type FixtureData = Record<string, Document[]>;
export type FormatCallback = (value: unknown) => unknown;
export type FormatMap = Record<string, Record<string, FormatCallback>>;

export interface FixuraMongo {
  populate(input: string[] | FixtureData): Promise<void>;
  // T is a caller assertion of the dumped shape, not a runtime guarantee
  dump<T extends FixtureData = FixtureData>(): Promise<T>;
  clear(): Promise<void>;
  close(): Promise<void>;
  getUri(): string;
}

export interface FixuraMongoGridFS extends FixuraMongo {
  populateFiles(data: Record<string, string | string[]>): Promise<void>;
  dumpFiles(readData?: boolean): Promise<Record<string, GridFSBucketReadStream | string>>;
  clearFiles(): Promise<void>;
}

export default function ({rootPath, gridFS, useObjectId, format}: {
  rootPath: string[];
  gridFS: boolean | {bucketName?: string};
  useObjectId?: boolean;
  format?: FormatMap;
}): Promise<FixuraMongoGridFS>;

export default function ({rootPath, gridFS, useObjectId, format}: {
  rootPath: string[];
  gridFS?: false;
  useObjectId?: boolean;
  format?: FormatMap;
}): Promise<FixuraMongo>;

export default async function ({rootPath, gridFS, useObjectId, format}: {
  rootPath: string[];
  gridFS?: boolean | {bucketName?: string};
  useObjectId?: boolean;
  format?: FormatMap;
}): Promise<FixuraMongo | FixuraMongoGridFS> {
  const {getFixture} = fixturesFactory({root: rootPath, reader: READERS.JSON});
  const {getUri, closeCallback} = await getMongoMethods();

  if (gridFS) {
    const gridFSOptions = typeof gridFS === 'object' ? gridFS : {};
    const {populateFiles, dumpFiles, clearFiles} = gridFSFactory({client: await getClient(), rootPath, ...gridFSOptions});
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
  async function populate(input: string[] | FixtureData) {
    const data: FixtureData = Array.isArray(input)
      ? structuredClone(getFixture({components: input}) as FixtureData)
      : structuredClone(input);
    const client = await getClient();

    await clear();

    await Promise.all(Object.entries(data).map(async ([name, docs]) => {
      const collection = await client.db().createCollection(name);

      let documents = docs;

      const collectionFormat = format?.[name];

      if (collectionFormat) {
        documents = documents.map(doc => formatValues(doc, collectionFormat));
      }

      if (useObjectId) {
        return collection.insertMany(documents.map(formatObjectId));
      }

      return collection.insertMany(documents);
    }));

    return client.close();
  }

  // MARK: dump
  async function dump<T extends FixtureData = FixtureData>(): Promise<T> {
    const client = await getClient();
    const collections = await client.db().collections();
    const data = await Promise.all(collections.map(async collection => {
      const results = await collection.find({}, {projection: {_id: 0}}).toArray();
      return {[collection.collectionName]: results};
    }));

    await client.close();

    return data.reduce<FixtureData>((acc, collection) => ({...acc, ...collection}), {}) as T;
  }

  // MARK: formatValues
  function formatValues(doc: Document, collectionFormat: Record<string, FormatCallback>): Document {
    return Object.entries(doc).reduce<Document>((acc, [key, value]) => {
      const cb = collectionFormat[key];
      return {...acc, [key]: cb ? cb(value) : value};
    }, {});
  }

  // MARK: formatObjectId
  function formatObjectId(doc: Document): Document {
    return Object.entries(doc).reduce<Document>((acc, [key, value]) => {
      if (key === '_id') {
        return {...acc, [key]: new ObjectId(value as string)};
      }

      return {...acc, [key]: value};
    }, {});
  }

  // MARK: getClient
  async function getClient() {
    const mongoUri = await getUri();
    if (mongoUri) {
      return MongoClient.connect(mongoUri, {});
    }

    throw new Error('Mongo connection uri missing');
  }

  // MARK: getMongoMethods
  async function getMongoMethods() {
    if ('MONGO_TEST_URI' in process.env) {
      return {
        getUri: () => process.env['MONGO_TEST_URI'] as string,
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        closeCallback: () => {}
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
