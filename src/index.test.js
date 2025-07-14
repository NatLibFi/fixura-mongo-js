import {MongoClient, GridFSBucket} from 'mongodb';
import factory from './index.mjs';
import {describe, it, afterEach} from 'node:test';
import assert from 'node:assert';
import fixturesFactory, {READERS} from '@natlibfi/fixura';

describe('index', async () => {
  let client;
  let mongoFixtures;

  const FIXTURES_PATH = [import.meta.dirname, '..', 'test-fixtures'];
  const {getFixture} = fixturesFactory({root: FIXTURES_PATH, reader: READERS.JSON});

  describe('#getConnectionString', async () => {
    afterEach(async () => {
      if (client) {
        await client.close();
      }

      await mongoFixtures.close();
    });

    it('Should return a valid connection string', async () => {
      mongoFixtures = await factory();
      await connectClient();
      assert.match(client.s.url, (/^mongodb:\/\//u));
    });
  });

  describe('#populate', async () => {
    afterEach(async () => {
      if (client) {
        await client.close();
      }

      await mongoFixtures.close();
    });

    it('Should populate the db', async () => {
      const db = getFixture({components: ['populate', '0', 'db.json']});
      mongoFixtures = await factory();

      await connectClient();
      await mongoFixtures.populate(db);
      const collections = await client.db().collections();

      assert.equal(collections.length, 1);
      assert.equal(collections[0].collectionName, 'fubar');

      const docs = await getDocuments(collections[0]);
      assert.deepStrictEqual(docs, db.fubar);
    });

    it('Should populate the db using file path as input', async () => {
      const db = getFixture({components: ['populate', '1', 'db.json']});
      mongoFixtures = await factory({rootPath: FIXTURES_PATH});

      await connectClient();
      await mongoFixtures.populate(['populate', '1', 'db.json']);

      const collections = await client.db().collections();

      assert.equal(collections.length, 1);
      assert.equal(collections[0].collectionName, 'fubar');

      const docs = await getDocuments(collections[0], {includeId: true});
      assert.deepStrictEqual(docs, db.fubar);
    });

    it('Should populate the db and convert "_id"-properties to ObjectId objects', async () => {
      const db = getFixture({components: ['populate', '2', 'db.json']});
      mongoFixtures = await factory({rootPath: FIXTURES_PATH, useObjectId: true});

      await connectClient();
      await mongoFixtures.populate(['populate', '2', 'db.json']);

      const collections = await client.db().collections();

      assert.equal(collections.length, 1);
      assert.equal(collections[0].collectionName, 'fubar');

      const docs = await getDocuments(collections[0]);
      assert.deepStrictEqual(docs, db.fubar);
    });

    it('Should populate the db and format values', async () => {
      const db = getFixture({components: ['populate', '3', 'db.json']});

      mongoFixtures = await factory({
        rootPath: FIXTURES_PATH, format: {
          fubar: {foo: () => 'foo'}
        }
      });

      // Expectation
      db.fubar[0].foo = 'foo';

      await connectClient();
      await mongoFixtures.populate(['populate', '3', 'db.json']);

      const collections = await client.db().collections();

      assert.equal(collections.length, 1);
      assert.equal(collections[0].collectionName, 'fubar');

      const docs = await getDocuments(collections[0]);
      assert.deepStrictEqual(docs, db.fubar);
    });
  });

  describe('#dump', async () => {
    afterEach(async () => {
      if (client) {
        await client.close();
      }

      await mongoFixtures.close();
    });

    it('Should dump the database', async () => {
      const db = getFixture({components: ['dump', '0', 'db.json']});
      mongoFixtures = await factory();

      await connectClient();
      await populate(db);

      const dumpedDb = await mongoFixtures.dump();
      assert.deepStrictEqual(dumpedDb, db);
    });
  });

  describe('#clear', async () => {
    afterEach(async () => {
      if (client) {
        await client.close();
      }

      await mongoFixtures.close();
    });

    it('Should clear the database', async () => {
      const db = getFixture({components: ['clear', '0', 'db.json']});
      mongoFixtures = await factory();

      await connectClient();
      await populate(db);
      await mongoFixtures.clear();

      const collections = await client.db().collections();
      assert.equal(collections.length, 0);
    });
  });

  describe('#populateFiles', async () => {
    afterEach(async () => {
      if (client) {
        await client.close();
      }
      await mongoFixtures.close();
    });


    it('Should populate the database with files', async () => {
      const expectedDb = getFixture({components: ['populateFiles', '0', 'expectedDb.json']});
      const data = getFixture({components: ['populateFiles', '0', 'data.txt'], reader: READERS.TEXT});
      const inputFiles = {
        foobar: data
      };

      mongoFixtures = await factory({rootPath: FIXTURES_PATH, gridFS: true});

      await connectClient();
      await mongoFixtures.populateFiles(inputFiles);

      const collections = await client.db().collections();
      const db = await getDocuments(collections);

      assert.deepStrictEqual(db, expectedDb);
      assert.deepStrictEqual(await getFiles(db), [data]);
    });

    it('Should populate the database with files using file paths', async () => {
      const expectedDb = getFixture({components: ['populateFiles', '1', 'expectedDb.json']});
      const data = getFixture({components: ['populateFiles', '1', 'data.txt'], reader: READERS.TEXT});
      const inputFiles = {
        foobar: ['populateFiles', '1', 'data.txt']
      };

      mongoFixtures = await factory({rootPath: FIXTURES_PATH, gridFS: true});

      await connectClient();
      await mongoFixtures.populateFiles(inputFiles);

      const collections = await client.db().collections();
      const db = await getDocuments(collections);

      assert.deepStrictEqual(db, expectedDb);
      const dataFiles = await getFiles(db);
      assert.deepEqual(dataFiles, [data]);
    });
  });

  describe('#dumpFiles', async () => {
    afterEach(async () => {
      if (client) {
        await client.close();
      }

      await mongoFixtures.close();
    });

    it('Should dump files from the database', async () => {
      const data = getFixture({components: ['dumpFiles', '0', 'data.txt'], reader: READERS.TEXT});
      const inputFiles = {
        foobar: data
      };

      mongoFixtures = await factory({rootPath: FIXTURES_PATH, gridFS: true});

      await connectClient();
      await writeFiles(inputFiles);
      const files = await mongoFixtures.dumpFiles(true);

      assert.deepStrictEqual(files, inputFiles);
    });

    it('Should dump files from the database using file paths', async () => {
      const expectedData = getFixture({components: ['dumpFiles', '1', 'data.txt'], reader: READERS.TEXT});
      const inputFiles = {
        foobar: expectedData
      };

      mongoFixtures = await factory({rootPath: FIXTURES_PATH, gridFS: true});

      await connectClient();
      await writeFiles(inputFiles);

      const files = await mongoFixtures.dumpFiles();
      assert.equal(Object.hasOwn(files, 'foobar'), true);


      const data = await readStream(files.foobar);
      assert.deepStrictEqual(data, expectedData);
    });

    it('Should return empty object if no files are', async () => {
      mongoFixtures = await factory({rootPath: FIXTURES_PATH, gridFS: true});

      await connectClient();

      const files = await mongoFixtures.dumpFiles();
      assert.deepStrictEqual(files, {});
    });
  });

  describe('#clearFiles', async () => {
    afterEach(async () => {
      if (client) {
        await client.close();
      }

      await mongoFixtures.close();
    });

    it('Should clear the files', async () => {
      const data = getFixture({components: ['clearFiles', '0', 'data.txt'], reader: READERS.TEXT});
      const files = {
        foobar: data
      };

      mongoFixtures = await factory({rootPath: FIXTURES_PATH, gridFS: true});

      await connectClient();
      await writeFiles(files);
      await mongoFixtures.clearFiles();

      const collections = await client.db().collections();
      assert.equal(collections.length, 0);
    });
  });

  async function connectClient() {
    const connectionUri = await mongoFixtures.getUri();
    client = await MongoClient.connect(connectionUri, {});
  }

  function populate(input) {
    const data = clone(input);

    return Promise.all(Object.keys(data).map(async name => {
      const collection = await client.db().createCollection(name);
      await collection.insertMany(data[name]);
    }));

    function clone(o) {
      return JSON.parse(JSON.stringify(o));
    }
  }

  async function getDocuments(collectionRef) {
    if (Array.isArray(collectionRef)) {
      const results = await Promise.all(collectionRef.map(async collection => {
        const docs = await get(collection);
        return {name: collection.collectionName, docs};
      }));

      return results.reduce((acc, result) => ({...acc, [result.name]: result.docs}), {});
    }

    return get(collectionRef);

    async function get(collection) {
      const result = await collection.find({}).toArray();
      return result.map(object => formatObj(object));

      function formatObj(o) { // eslint-disable-line
        const FILTER_KEYS = [
          '_id',
          'chunkSize',
          'uploadDate',
          'md5',
          'files_id',
          'n',
          'data'
        ];

        return Object.keys(o).reduce((acc, key) => {
          if (FILTER_KEYS.includes(key)) {
            return acc;
          }

          return {...acc, [key]: o[key]};
        }, {});
      }
    }
  }

  function writeFiles(files) {
    const gridFSBucket = new GridFSBucket(client.db());
    return Promise.all(Object.keys(files).map(filename => new Promise((resolve, reject) => {
      const uploadSteam = gridFSBucket.openUploadStream(filename);

      uploadSteam
        .on('error', reject)
        .on('finish', resolve);

      uploadSteam.write(files[filename]);

      uploadSteam.end();
    })));
  }

  function getFiles(db) {
    return Promise.all(db['fs.files'].map(({filename}) => {
      const gridFSBucket = new GridFSBucket(client.db());
      return readStream(gridFSBucket.openDownloadStreamByName(filename));
    }));
  }

  function readStream(stream) {
    return new Promise((resolve, reject) => {
      const chunks = [];

      stream
        .setEncoding('utf8')
        .on('error', reject)
        .on('data', chunk => chunks.push(chunk))
        .on('end', () => resolve(chunks.join('')));
    });
  }
});
