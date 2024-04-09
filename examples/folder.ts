import { createWriteStream, createReadStream } from 'fs';
import Spark, { type SparkClient } from '../src';

function getCategories(spark: SparkClient) {
  spark.folder
    .getCategories()
    .then((response) => console.log(response.data))
    .catch(console.error);
}

function create(spark: SparkClient) {
  const cover = createReadStream('my-cover.png');
  spark.folder
    .create({ name: 'some-folder-name', cover })
    .then((response) => console.log(response.data))
    .catch(console.error);
}

function find(spark: SparkClient) {
  spark.folder
    .find({ favorite: true })
    .then((response) => console.log(response.data))
    .catch(console.error);
}

function update(spark: SparkClient) {
  spark.folder
    .update('uuid', { description: 'this has been updated.' })
    .then((response) => console.log(response.data))
    .catch(console.error);
}

function deleteFolder(spark: SparkClient) {
  spark.folder
    .delete('uuid')
    .then((response) => console.log(response.data))
    .catch(console.error);
}

function downloadFile() {
  Spark.download('https://example.com/file.json')
    .then((buffer) => {
      const file = createWriteStream('my-file.json');
      buffer.pipe(file);
    })
    .catch(console.error);
}

export default {
  create,
  find,
  getCategories,
  update,
  delete: deleteFolder,
  downloadFile,
};
