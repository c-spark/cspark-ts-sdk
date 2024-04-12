<!-- markdownlint-disable-file MD024 -->

# ImpEx API

| Verb                            | Description                                             |
| ------------------------------- | ------------------------------------------------------- |
| `Spark.impex.export(data)`      | Export Spark entities (versions, services, or folders). |
| `Spark.impex.import(data)`      | Import exported Spark entities into your workspace.     |
| `Spark.impex.migrate(from, to)` | Migrate Spark entities from one tenant to another.      |

## Export Spark entities

This method relies on the [Export API][export-api] to export Spark entities from
your tenant. This method lets you go as specific as you want, allowing you to export
only the entities you need. You may choose to export specific versions, services,
or folders.

### Arguments

You may pass in the specs as an `object` with the following properties:

| Property          | Type                    | Description                                                                     |
| ----------------- | ----------------------- | ------------------------------------------------------------------------------- |
| _folders_         | `string[]`              | The folder names.                                                               |
| _services_        | `string[]`              | The service URIs.                                                               |
| _versionIds_      | `string[]`              | The version UUIDs of the desired service.                                       |
| _filters_         | `object`                | How to filter out which entities to export                                      |
| _filters.file_    | `migrate \| onpremises` | Whether it's for data migration or on-prem deployments (defaults to `migrate`). |
| _filters.version_ | `latest \| all`         | Which version of the file to export (defaults to `all`).                        |
| _sourceSystem_    | `string`                | The source system name to export from (e.g., `Spark JS SDK`).                   |
| _correlationId_   | `string`                | The correlation ID for the export (useful for tagging).                         |
| _maxRetries_      | `number`                | The maximum number of retries when checking the export status.                  |
| _retryInterval_   | `number`                | The interval between status check retries in seconds.                           |

> **NOTE**: Remember that a service URI is in the format `folder/service[?version]`.

Check out the [API reference](https://docs.coherent.global/spark-apis/impex-apis/export#request-body)
for more information.

```ts
await spark.impex.export({
  services: ['my-folder/my-service[0.4.2]', 'my-other-folder/my-service'],
  filters: { file: 'onpremises' },
  sourceSystem: 'Spark JS SDK',
  maxRetries: 5,
  retryInterval: 3,
});
```

### Returns

When successful, this method returns an array of exported entities, where each entity
is an `HttpResponse` object with the buffer containing the exported entity.

### Non-Transactional Methods

This method is transactional. It will initiate an export job, poll its status
until it completes, and download the exported files. If you need more control over
these steps, consider using the `exports` resource directly. You may use the following
methods:

- `Spark.impex.exports.initiate(data)`: Create an export job.
- `Spark.impex.exports.getStatus(jobId)`: Get the status of an export job.
- `Spark.impex.exports.download(result)`: Download the exported files.

## Import Spark entities

WIP.

<!-- References -->

[export-api]: https://docs.coherent.global/spark-apis/impex-apis/export
