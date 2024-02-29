import {expect} from 'chai';
import {MongoClient, GridFSBucket} from 'mongodb';
import factory from './index.js';
import fixturesFactory, {READERS} from '@natlibfi/fixura';

describe('index', () => {
  let client; // eslint-disable-line functional/no-let
  let mongoFixtures; // eslint-disable-line functional/no-let

  const FIXTURES_PATH = [__dirname, '..', 'test-fixtures'];
  const {getFixture} = fixturesFactory({root: FIXTURES_PATH, reader: READERS.JSON});

  afterEach(async () => {
    if (client) { // eslint-disable-line functional/no-conditional-statements
      await client.close();
    }

    await mongoFixtures.close();
  });

  describe('#getConnectionString', () => {
    it('Should return a valid connection string', async () => {
      mongoFixtures = await factory();
      await connectClient();
      expect((/^mongodb:\/\//u).test(client.s.url)).to.equal(true);
    });
  });

  describe('#populate', () => {
    it('Should populate the db', async (index = '0') => {
      const db = getFixture({components: ['populate', index, 'db.json']});
      mongoFixtures = await factory();

      await connectClient();
      await mongoFixtures.populate(db);
      const collections = await client.db().collections();

      expect(collections).to.have.lengthOf(1);
      expect(collections[0].collectionName).to.equal('fubar');
      const docs = await getDocuments(collections[0]);
      expect(docs).to.eql(db.fubar);
    });

    it('Should populate the db using file path as input', async (index = '1') => {
      const db = getFixture({components: ['populate', index, 'db.json']});
      mongoFixtures = await factory({rootPath: FIXTURES_PATH});

      await connectClient();
      await mongoFixtures.populate(['populate', index, 'db.json']);

      const collections = await client.db().collections();

      expect(collections).to.have.lengthOf(1);
      expect(collections[0].collectionName).to.equal('fubar');

      const docs = await getDocuments(collections[0], {includeId: true});

      expect(docs).to.eql(db.fubar);
    });

    it('Should populate the db and convert "_id"-properties to ObjectId objects', async (index = '2') => {
      const db = getFixture({components: ['populate', index, 'db.json']});
      mongoFixtures = await factory({rootPath: FIXTURES_PATH, useObjectId: true});

      await connectClient();
      await mongoFixtures.populate(['populate', index, 'db.json']);

      const collections = await client.db().collections();

      expect(collections).to.have.lengthOf(1);
      expect(collections[0].collectionName).to.equal('fubar');

      const docs = await getDocuments(collections[0]);
      expect(docs).to.eql(db.fubar);
    });

    it('Should populate the db and format values', async (index = '3') => {
      const db = getFixture({components: ['populate', index, 'db.json']});

      mongoFixtures = await factory({
        rootPath: FIXTURES_PATH, format: {
          fubar: {foo: () => 'foo'}
        }
      });

      // Expectation
      db.fubar[0].foo = 'foo'; // eslint-disable-line functional/immutable-data

      await connectClient();
      await mongoFixtures.populate(['populate', index, 'db.json']);

      const collections = await client.db().collections();

      expect(collections).to.have.lengthOf(1);
      expect(collections[0].collectionName).to.equal('fubar');

      const docs = await getDocuments(collections[0]);
      expect(docs).to.eql(db.fubar);
    });
  });

  describe('#dump', () => {
    it('Should dump the database', async (index = '0') => {
      const db = getFixture({components: ['dump', index, 'db.json']});
      mongoFixtures = await factory();

      await connectClient();
      await populate(db);

      const dumpedDb = await mongoFixtures.dump();

      expect(dumpedDb).to.eql(db);
    });
  });

  describe('#clear', () => {
    it('Should clear the database', async (index = '0') => {
      const db = getFixture({components: ['clear', index, 'db.json']});
      mongoFixtures = await factory();

      await connectClient();
      await populate(db);
      await mongoFixtures.clear();

      const collections = await client.db().collections();
      expect(collections).to.have.lengthOf(0);
    });
  });

  describe('#populateFiles', () => {
    it('Should populate the database with files', async (index = '0') => {
      const expectedDb = getFixture({components: ['populateFiles', index, 'expectedDb.json']});
      const data = getFixture({components: ['populateFiles', index, 'data.txt'], reader: READERS.TEXT});
      const inputFiles = {
        foobar: data
      };

      mongoFixtures = await factory({rootPath: FIXTURES_PATH, gridFS: true});

      await connectClient();
      await mongoFixtures.populateFiles(inputFiles);

      const collections = await client.db().collections();
      const db = await getDocuments(collections);

      expect(db).to.eql(expectedDb);
      expect(await getFiles(db)).to.eql([data]);
    });

    it('Should populate the database with files using file paths', async (index = '1') => {
      const expectedDb = getFixture({components: ['populateFiles', index, 'expectedDb.json']});
      const data = getFixture({components: ['populateFiles', index, 'data.txt'], reader: READERS.TEXT});
      const inputFiles = {
        foobar: ['populateFiles', index, 'data.txt']
      };

      mongoFixtures = await factory({rootPath: FIXTURES_PATH, gridFS: true});

      await connectClient();
      await mongoFixtures.populateFiles(inputFiles);

      const collections = await client.db().collections();
      const db = await getDocuments(collections);

      expect(db).to.eql(expectedDb);
      expect(await getFiles(db)).to.eql([data]);
    });
  });

  describe('#dumpFiles', () => {
    it('Should dump files from the database', async (index = '0') => {
      const data = getFixture({components: ['dumpFiles', index, 'data.txt'], reader: READERS.TEXT});
      const inputFiles = {
        foobar: data
      };

      mongoFixtures = await factory({rootPath: FIXTURES_PATH, gridFS: true});

      await connectClient();
      await writeFiles(inputFiles);
      const files = await mongoFixtures.dumpFiles(true);

      expect(files).to.eql(inputFiles);
    });

    it('Should dump files from the database using file paths', async (index = '1') => {
      const expectedData = getFixture({components: ['dumpFiles', index, 'data.txt'], reader: READERS.TEXT});
      const inputFiles = {
        foobar: expectedData
      };

      mongoFixtures = await factory({rootPath: FIXTURES_PATH, gridFS: true});

      await connectClient();
      await writeFiles(inputFiles);

      const files = await mongoFixtures.dumpFiles();
      expect(files).to.have.all.keys('foobar');

      const data = await readStream(files.foobar);
      expect(data).to.eql(expectedData);
    });

    it('Should return empty object if no files are', async () => {
      mongoFixtures = await factory({rootPath: FIXTURES_PATH, gridFS: true});

      await connectClient();

      const files = await mongoFixtures.dumpFiles();
      expect(files).to.eql({});
    });
  });

  describe('#clearFiles', () => {
    it('Should clear the files', async (index = '0') => {
      const data = getFixture({components: ['clearFiles', index, 'data.txt'], reader: READERS.TEXT});
      const files = {
        foobar: data
      };

      mongoFixtures = await factory({rootPath: FIXTURES_PATH, gridFS: true});

      await connectClient();
      await writeFiles(files);
      await mongoFixtures.clearFiles();

      const collections = await client.db().collections();
      expect(collections).to.have.lengthOf(0);
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
        .on('data', chunk => chunks.push(chunk)) // eslint-disable-line functional/immutable-data
        .on('end', () => resolve(chunks.join('')));
    });
  }
});
