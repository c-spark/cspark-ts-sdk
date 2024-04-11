import { createWriteStream } from 'fs';
import { type SparkClient } from '@cspark/sdk';

function download(spark: SparkClient) {
  spark.wasm
    .download({ versionId: 'uuid' })
    .then((response) => {
      const file = createWriteStream('my-service-wasm.zip');
      response.buffer.pipe(file);
    })
    .catch(console.error);
}

export default {
  download,
};
