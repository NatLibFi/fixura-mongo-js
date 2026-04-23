import {GridFSBucket, MongoError} from 'mongodb';
import fixturesFactory, {READERS} from '@natlibfi/fixura';
import {ReadStream} from 'node:fs';

export default function ({client, rootPath, bucketName = 'fs'}) {
  if (client === undefined) {
    throw new Error('GridFSBucket is missing mongo client!');
  }

  if (rootPath === undefined) {
    throw new Error('GridFSBucket is missing root path for fixtures!');
  }

  const gridFSBucket = new GridFSBucket(client.db(), {bucketName});
  const {getFixture} = fixturesFactory({root: rootPath, reader: READERS.STREAM});

  return {populateFiles, dumpFiles, clearFiles};

  async function clearFiles() {
    try {
      await gridFSBucket.drop();
    } catch (error: Error | any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      // https://www.mongodb.com/docs/manual/reference/error-codes/
      if (!(error instanceof MongoError && error.code === 26)) {
        throw error;
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
        const components = data[filename];
        const inputStream = getFixture({components});
        if (inputStream && inputStream instanceof ReadStream) {
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
        }
      });
    }));
  }

  async function dumpFiles(readData = false) {
    const result = await gridFSBucket.find({}).toArray();
    const promises = result.map(metadata => processMetadata(metadata));
    const [data] = await Promise.all(promises);
    return data ? data : {};

    async function processMetadata({_id, filename}) {
      if (readData) {
        const temp = {};
        temp[filename] = await readFromFile();
        return temp;
      }

      const temp = {};
      temp[filename] = gridFSBucket.openDownloadStream(_id);
      return temp;

      function readFromFile() {
        return new Promise((resolve, reject) => {
          const chunks: string[] = [];

          gridFSBucket.openDownloadStream(_id)
            .setEncoding('utf8')
            .on('error', reject)
            .on('data', (chunk: string) => chunks.push(chunk))
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
        .on('data', metadata => processors.push(processMetadata(metadata)))
        .on('end', async () => {
          await Promise.all(processors);
          resolve(data);
        });

      async function processMetadata(metadata) {
        if (readData) { // eslint-disable-line functional/no-conditional-statements
          data[metadata.filename] = await readFromFile();
        } else { // eslint-disable-line functional/no-conditional-statements
          data[metadata.filename] = gridFSBucket.openDownloadStream(metadata._id);
        }

        function readFromFile() {
          return new Promise((resolve, reject) => {
            const chunks = [];

            gridFSBucket.openDownloadStream(metadata._id)
              .setEncoding('utf8')
              .on('error', reject)
              .on('data', chunk => chunks.push(chunk))
              .on('end', () => resolve(chunks.join('')));
          });
        }
      }
    });
    /**/
  }
}
