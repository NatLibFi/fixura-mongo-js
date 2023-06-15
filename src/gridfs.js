import {GridFSBucket, MongoError} from 'mongodb';
import fixturesFactory, {READERS} from '@natlibfi/fixura';

export default function ({client, rootPath, bucketName = 'fs'} = {}) {
  const gridFSBucket = new GridFSBucket(client.db(), {bucketName});
  const {getFixture} = fixturesFactory({root: rootPath, reader: READERS.STREAM});

  return {populateFiles, dumpFiles, clearFiles};

  async function clearFiles() {
    try {
      await gridFSBucket.drop();
    } catch (err) {
      if (!(err instanceof MongoError && err.codeName === 'NamespaceNotFound')) {
        throw err;
      }
    }
  }

  async function populateFiles(data) {
    await clearFiles();

    return Promise.all(Object.keys(data).map(filename => {
      if (typeof data[filename] === 'string') {
        return new Promise((resolve, reject) => {
          const outputStream = gridFSBucket.openUploadStream(filename);

          outputStream
            .on('error', reject)
            .on('finish', resolve);

          outputStream.write(data[filename]);
          outputStream.end();
        });
      }

      return new Promise((resolve, reject) => {
        const components = data[filename]; // eslint-disable-line
        const inputStream = getFixture({components});
        const outputStream = gridFSBucket.openUploadStream(filename);

        outputStream
          .on('error', reject);

        inputStream
          .on('error', reject)
          .on('data', chunk => outputStream.write(chunk))
          .on('end', () => {
            inputStream.close();

            outputStream
              .on('finish', resolve)
              .end();
          });
      });
    }));
  }

  async function dumpFiles(readData = false) {
    const result = await gridFSBucket.find({}).toArray();
    const promises = result.map(metadata => processMetadata(metadata));
    const [data] = await Promise.all(promises);
    return data ? data : {};

    async function processMetadata({_id, filename}) {
      if (readData) { // eslint-disable-line functional/no-conditional-statements
        const temp = {};
        temp[filename] = await readFromFile(); // eslint-disable-line functional/immutable-data
        return temp;
      }

      const temp = {};
      temp[filename] = gridFSBucket.openDownloadStream(_id); // eslint-disable-line functional/immutable-data
      return temp;

      function readFromFile() {
        return new Promise((resolve, reject) => {
          const chunks = [];

          gridFSBucket.openDownloadStream(_id)
            .setEncoding('utf8')
            .on('error', reject)
            .on('data', chunk => chunks.push(chunk)) // eslint-disable-line functional/immutable-data
            .on('end', () => resolve(chunks.join('')));
        });
      }
    }

    /*
    return new Promise((resolve, reject) => {
      const processors = [];
      const data = {};

      gridFSBucket.find({})
        .on('error', reject)
        // The callback must be pushed to a list of promises because 'end' event might be dispatched before all data has been processed
        .on('data', metadata => processors.push(processMetadata(metadata))) // eslint-disable-line functional/immutable-data
        .on('end', async () => {
          await Promise.all(processors);
          resolve(data);
        });

      async function processMetadata(metadata) {
        if (readData) { // eslint-disable-line functional/no-conditional-statements
          data[metadata.filename] = await readFromFile(); // eslint-disable-line functional/immutable-data
        } else { // eslint-disable-line functional/no-conditional-statements
          data[metadata.filename] = gridFSBucket.openDownloadStream(metadata._id); // eslint-disable-line functional/immutable-data
        }

        function readFromFile() {
          return new Promise((resolve, reject) => {
            const chunks = [];

            gridFSBucket.openDownloadStream(metadata._id)
              .setEncoding('utf8')
              .on('error', reject)
              .on('data', chunk => chunks.push(chunk)) // eslint-disable-line functional/immutable-data
              .on('end', () => resolve(chunks.join('')));
          });
        }
      }
    });
    /**/
  }
}
