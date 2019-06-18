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

import {expect} from 'chai';
import {MongoClient, GridFSBucket} from 'mongodb';
import factory from './index';
import fixturesFactory, {READERS} from '@natlibfi/fixura';

describe('index', () => {
	let client;
	let mongoFixtures;

	const FIXTURES_PATH = [__dirname, '..', 'test-fixtures'];
	const {getFixture} = fixturesFactory({root: FIXTURES_PATH, reader: READERS.JSON});

	afterEach(async () => {
		if (client && client.isConnected()) {
			await client.close();
		}

		await mongoFixtures.close();
	});

	describe('#getConnectionString', () => {
		it('Should return a valid connection string', async () => {
			mongoFixtures = await factory();
			await connectClient();
			expect(client.isConnected()).to.equal(true);
		});
	});

	describe('#populate', () => {
		it('Should populate the db', async (index = '0') => {
			const db = getFixture(['populate', index, 'db.json']);
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
			const db = getFixture(['populate', index, 'db.json']);
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
			const db = getFixture(['populate', index, 'db.json']);
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
			const db = getFixture(['populate', index, 'db.json']);

			mongoFixtures = await factory({rootPath: FIXTURES_PATH, format: {
				fubar: {foo: () => 'foo'}
			}});

			// Expectation
			db.fubar[0].foo = 'foo';

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
			const db = getFixture(['dump', index, 'db.json']);
			mongoFixtures = await factory();

			await connectClient();
			await populate(db);

			const dumpedDb = await mongoFixtures.dump();

			expect(dumpedDb).to.eql(db);
		});
	});

	describe('#clear', () => {
		it('Should clear the database', async (index = '0') => {
			const db = getFixture(['clear', index, 'db.json']);
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
			const expectedDb = getFixture(['populateFiles', index, 'expectedDb.json']);
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
			const expectedDb = getFixture(['populateFiles', index, 'expectedDb.json']);
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
		const connectionString = await mongoFixtures.getConnectionString();
		client = await MongoClient.connect(connectionString, {useNewUrlParser: true});
	}

	async function populate(input) {
		const data = clone(input);

		return Promise.all(Object.keys(data).map(async name => {
			const collection = await client.db().createCollection(name);
			await collection.insert(data[name]);
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

			return results.reduce((acc, result) => {
				return {...acc, [result.name]: result.docs};
			}, {});
		}

		return get(collectionRef);

		async function get(collection) {
			return new Promise((resolve, reject) => {
				const docs = [];

				collection.find({})
					.on('data', doc => {
						docs.push(formatObj(doc));
					})
					.on('end', () => resolve(docs))
					.on('error', reject);

				function formatObj(o) {
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
			});
		}
	}

	async function writeFiles(files) {
		const gridFSBucket = new GridFSBucket(client.db());
		return Promise.all(Object.keys(files).map(async filename => {
			return new Promise((resolve, reject) => {
				const uploadSteam = gridFSBucket.openUploadStream(filename);

				uploadSteam
					.on('error', reject)
					.on('finish', resolve);

				uploadSteam.write(files[filename]);
				uploadSteam.end();
			});
		}));
	}

	async function getFiles(db) {
		return Promise.all(db['fs.files'].map(async ({filename}) => {
			const gridFSBucket = new GridFSBucket(client.db());
			return readStream(gridFSBucket.openDownloadStreamByName(filename));
		}));
	}

	async function readStream(stream) {
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
