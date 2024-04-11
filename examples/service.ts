import { createWriteStream, createReadStream } from 'fs';
import { type SparkClient } from '@cspark/sdk';

function getMetadata(spark: SparkClient) {
  spark.service
    .getMetadata('my-folder/my-service')
    .then((response) => console.log(response.data))
    .catch(console.error);
}

function getSchema(spark: SparkClient) {
  spark.service
    .getSchema('my-folder/my-service')
    .then((response) => console.log(response.data))
    .catch(console.error);
}

function getVersions(spark: SparkClient) {
  spark.service
    .getVersions('my-folder/my-service')
    .then((response) => console.log(response.data))
    .catch(console.error);
}

function getSwagger(spark: SparkClient) {
  spark.service
    .getSwagger('my-folder/my-service')
    .then((response) => console.log(response.data))
    .catch(console.error);
}

function validate(spark: SparkClient) {
  spark.service
    .validate('my-folder/my-service', {
      data: { inputs: { letter: 'b', number: 23 }, validationType: 'dynamic' },
    })
    .then((response) => console.log(JSON.stringify(response.data, null, 2)))
    .catch(console.error);
}

function download(spark: SparkClient) {
  spark.service
    .download({ folder: 'my-folder', service: 'my-service', type: 'configured' })
    .then((response) => {
      const file = createWriteStream('my-configured-subservices.xlsx');
      response.buffer.pipe(file);
    })
    .catch(console.error);
}

function recompile(spark: SparkClient) {
  spark.service
    .recompile({ folder: 'my-folder', service: 'my-service', compiler: 'Neuron_v1.16.0' })
    .then((response) => console.log(response.data))
    .catch(console.error);
}

function exportAsZip(spark: SparkClient) {
  spark.service
    .export({ folder: 'my-folder', service: 'my-service', filters: { version: 'latest' } })
    .then((downloables) => {
      for (const count in downloables) {
        const file = createWriteStream(`export-${count}.zip`);
        downloables[count].buffer.pipe(file);
      }
    })
    .catch(console.error);
}

function importFromZip(spark: SparkClient) {
  const file = createReadStream('package.zip');
  spark.service
    .import({ folder: 'my-folder', service: 'my-service', file })
    .then((response) => console.log(response.data))
    .catch(console.error);
}

function migrate(spark: SparkClient) {
  const config = spark.config.copyWith({ env: 'prod', apiKey: 'other-key' }); // my import config
  spark.service
    .migrate({ folder: 'my-folder', service: 'my-service', config })
    .then((job) => console.log(job.imports))
    .catch(console.error);
}

function execute(spark: SparkClient) {
  const data = { inputs: { value: 'Hello, Spark SDK' }, versionId: 'uuid' };
  spark.service
    .execute('my-folder/my-service', { data })
    .then((response) => console.log(response.data))
    .catch((err) => console.error(JSON.stringify(err.cause, null, 2)));
}

export function batchSync(spark: SparkClient) {
  const batch = [{ value: 1 }, { value: 2 }, { value: 3 }];
  spark.service.batch
    .execute({ folder: 'my-folder', service: 'my-service' }, { inputs: batch })
    .then((response) => console.log(response.data))
    .catch(console.error);
}

export default {
  getSchema,
  getMetadata,
  getVersions,
  getSwagger,
  validate,
  download,
  recompile,
  export: exportAsZip,
  import: importFromZip,
  migrate,
  execute,
  batchSync,
};
