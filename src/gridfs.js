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
				const inputStream = getFixture(data[filename]);
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
				if (readData) {
					data[metadata.filename] = await readFromFile();
				} else {
					data[metadata.filename] = gridFSBucket.openDownloadStream(metadata._id);
				}

				async function readFromFile() {
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
	}
}
