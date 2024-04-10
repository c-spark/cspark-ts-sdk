<!-- markdownlint-disable-file MD024 -->

# Service API

| Verb                                     | Description                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| `Spark.service.getSchema(uri)`           | Get the schema for a given service.                                       |
| `Spark.service.getVersions(uri)`         | Get all the versions of a service using a service uri locator.            |
| `Spark.service.getMetadata(uri)`         | Get the metadata of a service using a service uri locator.                |
| `Spark.service.getSwagger(uri)`          | Get the JSON content or download swagger file a particular service.       |
| `Spark.service.recompile(uri)`           | Recompile a service into a specified compiler type (e.g, Neuron_v1.13.0). |
| `Spark.service.download(uri)`            | Download the original excel file or the configured version of a service.  |
| `Spark.service.execute(uri, data)`       | Execute a service using v3 format.                                        |
| `Spark.service.batch.execute(uri, data)` | Execute a service using synchronous batch (i.e., v4 format.)              |
| `Spark.service.validate(uri, data)`      | Validate service data using static or dynamic validations.                |
| `Spark.service.export(uri, data)`        | Extract Spark services and package them up into a zip file.               |

WIP.
