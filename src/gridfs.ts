import {GridFSBucket, MongoError} from 'mongodb';
import type {GridFSBucketReadStream, GridFSFile, MongoClient} from 'mongodb';
import fixturesFactory, {READERS} from '@natlibfi/fixura';
import {ReadStream} from 'node:fs';

export default function ({client, rootPath, bucketName = 'fs'}: {
  client?: MongoClient;
  rootPath?: string[];
  bucketName?: string;
}) {
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
    } catch (error) {
      // https://www.mongodb.com/docs/manual/reference/error-codes/
      if (!(error instanceof MongoError && error.code === 26)) {
        throw error;
      }
    }
  }

  async function populateFiles(data: Record<string, string | string[]>) {
    await clearFiles();

    await Promise.all(Object.entries(data).map(([filename, content]) => {
      if (typeof content === 'string') {
        return new Promise<void>((resolve, reject) => {
          const outputStream = gridFSBucket.openUploadStream(filename);

          outputStream
            .on('error', reject)
            .on('finish', resolve);

          outputStream.write(content);
          outputStream.end();
        });
      }

      return new Promise<void>((resolve, reject) => {
        const inputStream = getFixture({components: content});
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

  async function dumpFiles(readData = false): Promise<Record<string, GridFSBucketReadStream | string>> {
    const result = await gridFSBucket.find({}).toArray();
    const promises = result.map(metadata => processMetadata(metadata));
    const [data] = await Promise.all(promises);
    return data ? data : {};

    async function processMetadata({_id, filename}: GridFSFile): Promise<Record<string, GridFSBucketReadStream | string>> {
      const temp: Record<string, GridFSBucketReadStream | string> = {};

      if (readData) {
        temp[filename] = await readFromFile();
        return temp;
      }

      temp[filename] = gridFSBucket.openDownloadStream(_id);
      return temp;

      function readFromFile() {
        return new Promise<string>((resolve, reject) => {
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
