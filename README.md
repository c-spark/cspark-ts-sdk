# @cspark/sdk

[![npm version][version-img]][version-url]

The Coherent Spark Node.js SDK (currently in Beta) is designed to elevate the developer
experience and provide a convenient access to the Coherent Spark API.

## Installation

```bash
npm install @cspark/sdk
# or
yarn add @cspark/sdk
```

> 🫣 This package requires [Node.js 16](https://nodejs.org/en/download/current) or higher.

## Usage

To use the SDK, you need a Coherent Spark account that lets you access the following:

- User authentication ([API key][api-key-docs], [bearer token][bearer-token-docs]
  or [OAuth2 client credentials][oauth2-docs] details)
- Base URL (including the tenant and environment)
- Spark service URI (to locate a specific resource):
  - `folder` - the folder name where the service is located
  - `service` - the service name
  - `version` - the revision number also known as the semantic version (e.g., 0.4.2)

As a reminder, a `folder` contains one or more `service`s, and a `service` can have
multiple `version`s. Technically speaking, when you're operating with a service,
you're actually interacting with a specific version of that service (the latest
version by default - unless specified otherwise).

Hence, there are various ways to indicate a Spark service URI:

- `{folder}/{service}[?{version}]` - _version_ or revision number is optional.
- `service/{serviceId}`
- `version/{versionId}`

Here's an example of how to execute a Spark service:

```ts
import Spark from '@cspark/sdk';

function main() {
  const spark = new Spark({ env: 'my-env', tenant: 'my-tenant', apiKey: 'my-api-key' });
  spark.service
    .execute('my-folder/my-service', { inputs: { value: 'Hello, Spark SDK!' } })
    .then((response) => console.log(response.data))
    .catch(console.error);
}

main();
```

Though the package is designed for Node.js, it can also be used in browser-like
environments:

```html
<!doctype html>
<html>
  <body>
    <script src="https://www.unpkg.com/@cspark/sdk"></script>
    <script>
      const { SparkClient: Spark } = window['@cspark/sdk'];

      function main(apiKey) {
        const spark = new Spark({ env: 'my-env', tenant: 'my-tenant', apiKey, allowBrowser: true });
        spark.service
          .execute('my-folder/my-service', { inputs: { value: 'Hello, Spark SDK!' } })
          .then((response) => console.log(response.data))
          .catch(console.error);
      }

      main(prompt('Provide your API key'));
    </script>
  </body>
</html>
```

Explore the [examples](./examples/index.ts) and [documentation](./docs) folder
to find out more about the SDK's capabilities.

## Client Options

As shown in the example above, `Spark` is your entry point to the SDK. It is quite
flexible and can be configured with the following options:

### Base URL

`baseUrl` (default: `process.env['CSPARK_BASE_URL']`): indicates the base URL of
the Coherent Spark API. It should include the tenant and environment information.

```ts
const spark = new Spark({ baseUrl: 'https://excel.my-env.coherent.global/my-tenant' });
```

Alternatively, a combination of `env` and `tenant` options can be used to construct
the base URL.

```ts
const spark = new Spark({ env: 'my-env', tenant: 'my-tenant' });
```

### Authentication

The SDK supports three types of authentication mechanisms:

- `apiKey` (default: `process.env['CSPARK_API_KEY']`): indicates the API key
  (also known as synthetic key). Keep in mind that the API key
  is sensitive and should be kept secure.

```ts
const spark = new Spark({ apiKey: 'my-api-key' });
```

> [!TIP]
> The Spark SaaS platform supports public APIs that can be accessed without any
> authentication. In that case, you can set `apiKey` to `open`.

- `token` (default: `process.env['CSPARK_BEARER_TOKEN']`): indicates the bearer token.
  It can be prefixed with 'Bearer' or not. A bearer token is usually valid for a
  limited time and should be refreshed periodically.

```ts
const spark = new Spark({ token: 'Bearer 123' });
```

- `oauth` (default: `process.env['CSPARK_CLIENT_ID']` and `process.env['CSPARK_CLIENT_SECRET']` or
  `process.env['CSPARK_OAUTH_PATH']`): indicates the OAuth2 client credentials.
  For convenience, you can provide the client ID and secret directly or provide
  the file path to the JSON file containing the credentials.

```ts
const spark = new Spark({ oauth: { clientId: 'my-client-id', clientSecret: 'my-client' } });
// or
const spark = new Spark({ oauth: 'path/to/credentials.json' });
```

- `timeout` (default: `60000`): indicates the maximum amount of time (in milliseconds)
  that the client should wait for a response from Spark servers before timing out a request.

- `maxRetries` (default: `2`): indicates the maximum number of times that the client
  will retry a request in case of a temporary failure, such as a unauthorized
  response or a status code greater than 400.

- `allowBrowser` (default: `false`): indicates whether the SDK should be used in
  browser-like environments -- unless you intend to access public APIs.
  By default, client-side use of this library is not recommended, as it risks
  exposing your secret API credentials to attackers.
  Only set this option to `true` if you understand the risks and have appropriate
  mitigations in place.

- `logger` (default: `LoggerOptions`): enables or disables the logger for the SDK.
  - If `boolean`, determines whether the SDK should print colorful logs (including timestamps).
  - If `LogLevel`, the SDK will print logs with the specified log level.
  - If `LoggerOptions`, the SDK will print logs with the specified options:
    - `context` (default: `CSPARK v{version}`): defines the context of the logs (e.g., `CSPARK v1.2.3`);
    - `colorful` (default: `true`): determines whether the logs should be colorful;
    - `timestamp` (default: `true`): determines whether the logs should include timestamps;
    - `logLevels` (default: `['verbose', 'debug', 'log', 'warn', 'error', 'fatal']`):
      determines the log levels to print;
    - `logger`: a custom logger that implements the `LoggerService` interface.

```ts
const spark = new Spark({ logger: true });
// or
const spark = new Spark({ logger: 'warn' });
// or
const spark = new Spark({ logger: { colorful: false, logLevels: ['warn', 'error'] } });
```

## API Parity

The SDK aims to provide over time full parity with the Spark API. The following
APIs are currently supported:

[Authentication API](./docs/authentication.md) - for generating access tokens using:

| Verb                                      | Description                                                                   |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| `Spark.config.auth.oauth.retrieveToken()` | Generate access token using OAuth2.0 via Client Credentials flow.             |
| `Spark.config.auth.oauth.refreshToken()`  | Refresh access token when expired using OAuth2.0 via Client Credentials flow. |

[Folder API](./docs/folder.md) - for managing folders:

| Verb                            | Description                                                           |
| ------------------------------- | --------------------------------------------------------------------- |
| `Spark.folder.getCategories()`  | Get the list of folder categories.                                    |
| `Spark.folder.create(data)`     | Create a new folder using info like name, description, category, etc. |
| `Spark.folder.find(name)`       | Find folders by name, status, category, or favorite.                  |
| `Spark.folder.update(id, data)` | Update a folder's information by id.                                  |
| `Spark.folder.delete(id)`       | Delete a folder by id.                                                |

[Service API](./docs/service.md) - for managing Spark services:

| Verb                                     | Description                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| `Spark.service.getSchema(uri)`           | Get the schema for a given service.                                       |
| `Spark.service.getVersions(uri)`         | Get all the versions of a service using a service uri locator.            |
| `Spark.service.getMetadata(uri)`         | Get the metadata of a service using a service uri locator.                |
| `Spark.service.getSwagger(uri)`          | Get the JSON content or download swagger file a particular service.       |
| `Spark.service.recompile(uri)`           | Recompile a service into a specified compiler type (e.g, Neuron_v1.13.0). |
| `Spark.service.download(uri)`            | Download the original excel file or the configured version of a service.  |
| `Spark.service.execute(uri, data)`       | Execute a service using v3 data format.                                   |
| `Spark.service.batch.execute(uri, data)` | Execute a service using synchronous batch (i.e., v4 data format.)         |
| `Spark.service.validate(uri, data)`      | Validate service data using static or dynamic validations.                |
| `Spark.service.export(uri, data)`        | Extract Spark services and package them up into a zip file.               |

[Log History API](./docs/history.md) - for managing service execution logs:

| Verb                                         | Description                                                |
| -------------------------------------------- | ---------------------------------------------------------- |
| `Spark.service.log.rehydrate(uri, [callId])` | Rehydrate the executed model into the original excel file. |
| `Spark.service.log.download(uri, [type])`    | Download service execution logs as csv or json file.       |

[ImpEx API](./docs/impex.md) - for importing and exporting Spark services:

| Verb                            | Description                                             |
| ------------------------------- | ------------------------------------------------------- |
| `Spark.impex.export(data)`      | Export Spark entities (versions, services, or folders). |
| `Spark.impex.import(data)`      | Import exported Spark entities into your workspace.     |
| `Spark.impex.migrate(from, to)` | Migrate Spark entities from one tenant to another.      |

[Other APIs](./docs/misc.md) - for other functionalities:

| Verb                       | Description                              |
| -------------------------- | ---------------------------------------- |
| `Spark.wasm.download(uri)` | Download a service's WebAssembly module. |
| `Spark.file.download(url)` | Download a Spark file.                   |

> [!TIP]
> A service URI locator can be combined with other parameters to locate a specific
> service when it's not a string. For example, you may execute a public service
> using an object containing the `folder`, `service`, and `public` properties.

```ts
const spark = new Spark({ env: 'my-env', tenant: 'my-tenant', apiKey: 'open' });
spark.service
  .execute({ folder: 'my-folder', service: 'my-service', public: true }, { inputs: { value: 'Hello, Spark SDK!' } })
  .then((response) => console.log(response.data))
  .catch(console.error);
// The final URI in this case is: 'my-tenant/api/v3/public/folders/my-folder/services/my-service/execute'
```

See the [Uri](./src/resources/base.ts) class for more details.

## Error Handling

`SparkError` is a base class for all custom errors. There are two types of errors:

- `SparkSdkError`: usually thrown when an argument (user input) fails to comply
  with the expected format. Because it's a client-side error, it will include in
  the majority of cases the invalid entry as `cause`.
- `SparkApiError`: when attempting to communicate with the API, the SDK will wrap
  any sort of failure (any error during the round trip) into `SparkApiError`.
  The `status` will be the HTTP status code of the response, and the `requestId`
  will be the unique identifier of the request.

Some of the derived `SparkApiError` are:

| Type                      | Status      | When                           |
| ------------------------- | ----------- | ------------------------------ |
| `InternetError`           | 0           | no internet access             |
| `BadRequestError`         | 400         | invalid request                |
| `UnauthorizedError`       | 401         | missing or invalid credentials |
| `ForbiddenError`          | 403         | insufficient permissions       |
| `NotFoundError`           | 404         | resource not found             |
| `ConflictError`           | 409         | resource already exists        |
| `RateLimitError`          | 429         | too many requests              |
| `InternalServerError`     | 500         | server-side error              |
| `ServiceUnavailableError` | 503         | server is down                 |
| `ApiUnknownError`         | `undefined` | unknown error                  |

## Contributing

Feeling motivated enough to contribute? Great! Your help is always appreciated.

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for details on the code of
conduct, and the process for submitting pull requests.

## Copyright and License

[Apache-2.0](./LICENSE)

<!-- References -->

[version-img]: https://img.shields.io/npm/v/@cspark/sdk
[version-url]: https://www.npmjs.com/package/@cspark/sdk
[api-key-docs]: https://docs.coherent.global/spark-apis/authorization-api-keys
[bearer-token-docs]: https://docs.coherent.global/spark-apis/authorization-bearer-token
[oauth2-docs]: https://docs.coherent.global/spark-apis/authorization-client-credentials
