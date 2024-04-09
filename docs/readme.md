# SDK Documentation

This guide should serve as a comprehensive reference for the SDK. It covers all
the verbs (or methods) and parameters available in the SDK.

There's no need to look up API-related information on Spark's [User Guide](https://docs.coherent.global).
The SDK provides a simple interface to interact with Spark's supported APIs,
which shall help you save time and streamline your development process.

## Table of Contents

- [Authentication](./authentication.md)
- [Folder API](./folder.md)
- [Log History API](./history.md)
- [ImpEx API](./impex.md)

## HTTP Response

All the methods return a `Promise` that resolves to an `HttpResponse<T>` object
where `T` is the type of the data returned by the API.

- `status`: HTTP status code
- `data`: JSON data `T` returned by the API
- `buffer`: Binary array buffer of response body
- `headers`: Response headers

**Example:**

```json
{
  "status": 200,
  "data": {},
  "buffer": null,
  "headers": {}
}
```

## HTTP Error

When attempting to communicate with the API, the SDK will wrap any sort of failure
(any error during the round trip) into a `SparkApiError`, which will include
the HTTP `status` code of the response and the `requestId`, a unique identifier
of the request. The most common errors are:

- `UnauthorizedError`: when the user is not authenticated/authorized
- `NotFoundError`: when the requested resource is not found
- `BadRequestError`: when the request or payload is invalid
- `ConflictError`: when a resource is duplicated or conflicting

The following properties are available in a `SparkApiError`:

- `name`: name of the API error, e.g., `UnauthorizedError`
- `status`: HTTP status code
- `cause`: cause of the failure
- `message`: summary of the error message causing the failure
- `requestId`: unique identifier of the request (useful for debugging)
- `details`: a stringified version of error, combining `cause` and `message`.

The `cause` property will include key information regarding the attempted request
as well as the obtained response if available.

**Example:**

```json
{
  "cause": {
    "request": {
      "url": "https://excel.my-env.coherent.global/api/v1/product/delete/uuid",
      "method": "DELETE",
      "headers": {
        "User-Agent": "Coherent Spark SDK v0.1.0-beta.1 (Node v16.14.2)",
        "x-spark-ua": "agent=cspark-ts-sdk/0.1.0-beta.1; env=Node/16.14.2",
        "x-request-id": "uuid",
        "x-tenant-name": "my-tenant",
        "Content-Type": "application/json"
      },
      "body": "null"
    },
    "response": {
      "headers": {
        "connection": "close",
        "content-length": "0",
        "date": "Thu, 01 Jan 1970 01:23:45 GMT",
        "strict-transport-security": "max-age=15724800; includeSubDomains",
        "www-authenticate": "Bearer"
      },
      "body": null,
      "raw": ""
    }
  },
  "name": "UnauthorizedError",
  "status": 401
}
```
