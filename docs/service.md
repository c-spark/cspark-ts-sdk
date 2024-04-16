<!-- markdownlint-disable-file MD024 -->

# Service API

| Verb                                     | Description                                          |
| ---------------------------------------- | ---------------------------------------------------- |
| `Spark.service.getVersions(uri)`         | Get all the versions of a service.                   |
| `Spark.service.getSwagger(uri)`          | Get the Swagger documentation of a service.          |
| `Spark.service.getSchema(uri)`           | Get the schema for a given service.                  |
| `Spark.service.getMetadata(uri)`         | Get the metadata of a service.                       |
| `Spark.service.download(uri)`            | Download the excel file of a service.                |
| `Spark.service.recompile(uri)`           | Recompile a service using specific compiler version. |
| `Spark.service.execute(uri, data)`       | Execute a single record.                             |
| `Spark.service.batch.execute(uri, data)` | Execute mutiple records synchronously.               |
| `Spark.service.validate(uri, data)`      | Run static or dynamic validations against records.   |
| `Spark.service.export(uri, data)`        | Export Spark services as a zip file.                 |

## Get all the versions of a service

This method returns all the versions of a service.

### Arguments

The method accepts a string or a `UriParams` object as an argument.

```ts
await spark.service.getVersions('my-folder/my-service');
// or
await spark.service.getVersions({ folder: 'my-folder', service: 'my-service' });
```

### Returns

```json
{
  "status": "Success",
  "message": null,
  "errorCode": null,
  "data": [
    {
      "id": "uuid",
      "createdAt": "1970-12-03T04:56:78.186Z",
      "engine": "my-service",
      "revision": "0.2.0",
      "effectiveStartDate": "1970-12-03T04:56:78.186Z",
      "effectiveEndDate": "1990-12-03T04:56:78.186Z",
      "isActive": true,
      "releaseNote": "some release note",
      "childEngines": null,
      "versionLabel": "",
      "defaultEngineType": "Neuron",
      "tags": null,
      "product": "my-folder",
      "author": "john.doe@coherent.global",
      "originalFileName": "my-service-v2.xlsx"
    },
    {
      "id": "86451865-dc5e-4c7c-a7f6-c35435f57dd1",
      "createdAt": "1970-12-03T04:56:78.186Z",
      "engine": "my-service",
      "revision": "0.1.0",
      "effectiveStartDate": "1970-12-03T04:56:78.186Z",
      "effectiveEndDate": "1980-12-03T04:56:78.186Z",
      "isActive": false,
      "releaseNote": null,
      "childEngines": null,
      "versionLabel": "",
      "defaultEngineType": "XConnector",
      "tags": null,
      "product": "my-folder",
      "author": "jane.doe@coherent.global",
      "originalFileName": "my-service.xlsx"
    }
  ]
}
```

## Get the Swagger documentation of a service

This method returns the JSON content or downloads the swagger file of a particular service.

### Arguments

The method accepts a string or a `UriParams` object as an argument.

```ts
await spark.service.getSwagger('my-folder/my-service');
// or
await spark.service.getSwagger({ folder: 'my-folder', service: 'my-service' });
```

When using the `UriParams` object, you can also specify additional options:

| Property       | Type      | Description                                                               |
| -------------- | --------- | ------------------------------------------------------------------------- |
| _folder_       | `string`  | The folder name.                                                          |
| _service_      | `string`  | The service name.                                                         |
| _versionId_    | `string`  | The version id to target a specific version of the service (optional).    |
| _downloadable_ | `boolean` | If `true`, the method downloads the swagger file; else, the JSON content. |
| _category_     | `string`  | The list of the subservices being requested or `All` for all subservices. |

```ts
await spark.service.getSwagger({
  folder: 'my-folder',
  service: 'my-service',
  downloadable: true,
});
```

### Returns

See a [sample swagger JSON](./samples/service-swagger.json) for more information.

## Get the schema for a service

This method returns the schema of a service. A service schema is a JSON object
that describes the structure of the input and output data of a service. It includes
but not limited to the following information:

- Book summary
- Book properties
- Engine ID and inputs
- Service outputs
- Metadata

### Arguments

The method accepts a string or a `UriParams` object as an argument.

```ts
await spark.service.getSchema('my-folder/my-service');
// or
await spark.service.getSchema({ folder: 'my-folder', service: 'my-service' });
```

### Returns

See a [sample service schema](./samples/service-swagger.json) for more information.

## Get the metadata of a service

This method returns the metadata of a service.

### Arguments

The method accepts a string or a `UriParams` object as an argument.

```ts
await spark.service.getMetadata('my-folder/my-service');
// or
await spark.service.getMetadata({ folder: 'my-folder', service: 'my-service' });
```

### Returns

```json
{
  "status": "Success",
  "error": null,
  "response_data": {
    "outputs": {
      "Metadata.Date": "1970-01-23",
      "Metadata.Number": 456,
      "Metadata.Text": "DEF",
      "METADATA.IMAGE": "data:image/png;base64,..."
    },
    "warnings": null,
    "errors": null,
    "service_chain": null
  },
  "response_meta": {
    "service_id": "uuid",
    "version_id": "uuid",
    "version": "1.2.3",
    "process_time": 0,
    "call_id": "uuid",
    "compiler_type": "Type3",
    "compiler_version": "1.2.0",
    "source_hash": null,
    "engine_id": "hash-info",
    "correlation_id": null,
    "system": "SPARK",
    "request_timestamp": "1970-01-23T00:58:20.752Z"
  }
}
```

## Download the Excel file of a service

During the conversion process, Spark builds a service from the Excel file and keeps
a _configured version_ of the service for version control. This configured version
is nothing but the Excel file that was uploaded to Spark with some additional
metadata for version control.

This method lets you download either the configured version or the original Excel
file of a service.

### Arguments

The method accepts a string or a `UriParams` object as an argument.

```ts
await spark.service.download('my-folder/my-service[0.4.2]');
// or
await spark.service.download({ folder: 'my-folder', service: 'my-service', version: '0.4.2' });
```

> **Note:** The version piece is optional. If not provided, the latest version is downloaded.

You may use additional options to indicate whether you intend to download the
original Excel file or the configured version of it.

| Property   | Type                     | Description                                               |
| ---------- | ------------------------ | --------------------------------------------------------- |
| _filename_ | `string`                 | Save the downloaded file with a different name.           |
| _type_     | `original \| configured` | The type of the file to download (defaults to `original`) |

```ts
await spark.service.download({
  folder: 'my-folder',
  service: 'my-service',
  version: '0.4.2',
  type: 'configured',
});
```

### Returns

When successful, the method returns an `HttpResponse` object with the buffer
containing the Excel file.

## Recompile a service using specific compiler version

Every service in Spark is compiled using a specific compiler version -- usually
the latest one. However, you may want to recompile a service using a specific
compiler version for various reasons. Keep in mind that a service recompilation
is considered an update to the underlying Spark service but not to the Excel file
itself.

### Arguments

The method accepts a string or a `UriParams` object as an argument.

```ts
await spark.service.recompile('my-folder/my-service');
// or
await spark.service.recompile({ folder: 'my-folder', service: 'my-service' });
```

When using `string`-based service URIs, the method recompiles the service using the
latest compiler version and a `patch` update. If you want to recompile the service
using a specific compiler version, you must use the `UriParams` object.

| Property       | Type                       | Description                                              |
| -------------- | -------------------------- | -------------------------------------------------------- |
| _versionId_    | `string`                   | The UUID of a particular version of the service.         |
| _compiler_     | `string`                   | The type of the compiler to use.                         |
| _upgrade_      | `major \| minor \| patch`  | which type of versioning to apply (defaults to `patch`). |
| _label_        | `string`                   | The version label.                                       |
| _releaseNotes_ | `string`                   | The release notes.                                       |
| _tags_         | `string \| string[]`       | The comma-separted tags to apply to the service.         |
| _startDate_    | `number \| string \| Date` | The effective start date.                                |
| _endDate_      | `number \| string \| Date` | The effective end date.                                  |

The supported compiler versions include but not limited to:

- `Neuron_vM.m.p` (e.g., `Neuron_v1.13.0`)
- `StableLatest`
- `TenantDefault`
- `ReleaseCandidate`

```ts
await spark.service.recompile({
  folder: 'my-folder',
  service: 'my-service',
  versionId: '123e4567-e89b-12d3-a456-426614174000',
  compiler: 'Neuron_v1.13.0',
  upgrade: 'minor',
  label: 'recompilation',
  releaseNotes: 'some release notes',
  tags: 'tag1,tag2',
});
```

## Returns

Recompiling a service will start a background compilation job. If the operation
is successful, this method returns a JSON with the job details.

```json
{
  "status": "Success",
  "error": null,
  "response_data": {
    "versionId": "uuid",
    "revision": "1.2.3",
    "jobId": "uuid"
  },
  "response_meta": {
    "system": "SPARK",
    "request_timestamp": "1970-01-23T21:12:27.698Z"
  }
}
```

A recompilation job is asynchronous and may take some time to complete. You may
want to poll the job status before using the updated service.

## Create a Spark service
