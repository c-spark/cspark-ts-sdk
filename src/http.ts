import { type Readable as ByteStream } from 'stream';
import nodeFetch, { RequestInit } from 'node-fetch';

import { Config } from './config';
import { JsonData, Serializable } from './data';
import { SparkApiError, SparkSdkError } from './error';
import { Streamer } from './streaming';
import Utils, { loadModule } from './utils';

export interface Multipart {
  readonly name: string;
  readonly data?: JsonData;
  readonly fileStream?: ByteStream;
  readonly fileName?: string;
  readonly contentType?: string;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type CancellationToken = AbortSignal;

/**
 * Exposes some options when building HTTP requests.
 */
export interface RequestOptions {
  /**
   * Key-value pairs of headers to be sent with the request.
   */
  readonly headers?: Record<string, string>;

  /**
   * Key-value pairs of query params to be sent with the request.
   */
  readonly params?: Record<string, string>;

  /**
   * Request body data
   */
  readonly body?: JsonData;

  /**
   * Stream of a file
   */
  readonly file?: ByteStream;

  /**
   * Parts of multipart data
   */
  readonly multiparts?: Multipart[];

  /**
   * Token used for request cancellation
   */
  readonly cancellationToken?: CancellationToken;

  /**
   * Number of retries to attempt
   */
  readonly retries?: number;
}

export interface HttpOptions extends RequestOptions {
  /**
   * Client configuration.
   */
  readonly config: Config;

  /**
   * A string to set request's method (GET, POST, etc.). Defaults to GET.
   */
  readonly method?: HttpMethod;

  /**
   * Request body content type
   */
  readonly contentType?: string;
}

export interface HttpResponse<T = JsonData> {
  /**
   * The status code of the response. (This will be 200 for a success).
   */
  readonly status: number;

  /**
   * Response body data
   */
  readonly data: T;

  /**
   * Binary array buffer of response body
   */
  readonly buffer: ByteStream;

  /**
   * Response headers
   */
  readonly headers: Record<string, string>;
}

export interface Interceptor {
  // FIXME: should be nullable and async
  beforeRequest(options: HttpOptions): HttpOptions;
  afterRequest<T>(response: HttpResponse<T>): HttpResponse<T>;
}

/**
 * Calculate the exponential backoff time with randomized jitter
 * @param {int} retries Which retry number this one will be
 * @param {int} baseInterval The base retry interval set in config
 * @returns {int} The number of milliseconds after which to retry
 */
export function getRetryTimeout(retries: number, baseInterval: number = 1): number {
  // Retry intervals are between 50% and 150% of the exponentially increasing base amount
  const RETRY_RANDOMIZATION_FACTOR = 0.5;
  const minRandomization = 1 - RETRY_RANDOMIZATION_FACTOR;
  const maxRandomization = 1 + RETRY_RANDOMIZATION_FACTOR;
  const randomization = Math.random() * (maxRandomization - minRandomization) + minRandomization;
  const exponential = Math.pow(2, retries - 1);
  return Math.ceil(exponential * baseInterval * 1000 * randomization);
}

async function createRequestInit(options: HttpOptions): Promise<RequestInit> {
  const {
    method = 'GET',
    headers = {},
    contentType: initialContentType = 'application/json',
    body: data,
    file: fileStream,
  } = options;

  const { contentType, body } = await (async (): Promise<{
    contentType: string;
    body: ByteStream | string;
  }> => {
    if (options.multiparts) {
      const FormData = Utils.isBrowser() ? window.FormData : loadModule('form-data');
      const formData = new FormData();

      for (const item of options.multiparts) {
        if (item.fileStream) {
          const buffer = await readStream(item.fileStream);
          headers['content-md5'] = await calculateMd5Hash(buffer);
          formData.append(item.name, buffer, {
            filename: item.fileName ?? 'file',
            contentType: item.contentType ?? 'application/octet-stream',
          });
        } else if (item.data) {
          formData.append(item.name, Serializable.serialize(item.data));
        } else {
          throw new SparkSdkError({
            message: 'Multipart item must have either serializable body or fileStream',
            cause: item,
          });
        }
      }

      return {
        contentType: `multipart/form-data; boundary=${formData.getBoundary()}`,
        body: formData,
      };
    }

    const contentType = initialContentType;
    switch (contentType) {
      case 'application/json':
      case 'application/json-patch+json':
        return { contentType, body: Serializable.serialize(data ?? null) };

      case 'application/x-www-form-urlencoded':
        return { contentType, body: Serializable.toUrlParams(data ?? null) };

      case 'application/octet-stream':
        if (!fileStream) {
          throw new SparkSdkError({ message: 'fileStream required for application/octet-stream content type' });
        }
        return { contentType, body: fileStream };

      default:
        throw new SparkSdkError({ message: `Unsupported content type : ${contentType}` });
    }
  })();

  return {
    method,
    body: method === 'GET' ? undefined : body,
    headers: { ...headers, 'Content-Type': contentType, ...options.config.auth?.asHeader },
    signal: options.cancellationToken as RequestInit['signal'],
  };
}

/**
 * Calculate the SHA1 hash of the data
 */
export async function calculateMd5Hash(data: string | Buffer): Promise<string> {
  if (Utils.isBrowser()) {
    const dataBuffer = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const hashBuffer = await window.crypto.subtle.digest('SHA-1', dataBuffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0')) // convert bytes to hex
      .join('');
  }

  // Node environment
  const createHash = loadModule('crypto').createHash;
  return createHash('sha1').update(data).digest('hex');
}

async function readStream(stream: ByteStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', (err: Error) => reject(err));
  });
}

export async function _fetch<T = JsonData>(resource: string, options: HttpOptions): Promise<HttpResponse<T>> {
  // Apply beforeRequest interceptors if any.
  const fetchOptions: typeof options = options.config.hasInterceptors
    ? options.config.interceptors.reduce((opts: HttpOptions, i: Interceptor) => i.beforeRequest(opts), options)
    : options;

  // prepare and make request using fetch API
  const requestInit = await createRequestInit(fetchOptions);
  const url = Utils.formatUrl(resource, fetchOptions.params);
  const response = await nodeFetch(url, { ...requestInit, redirect: 'manual' });

  // Extract response data and headers
  const contentType = response.headers.get('content-type') ?? '';
  const responseBytesBuffer = await response.arrayBuffer();
  const content = Streamer.fromBuffer(responseBytesBuffer);
  const jsonData = ((): T => {
    if (contentType.includes('application/json')) {
      const text = new TextDecoder().decode(responseBytesBuffer);
      return Serializable.deserialize(text);
    }
    return null as T;
  })();

  let httpResponse: HttpResponse<T> = {
    status: response.status,
    data: jsonData,
    buffer: content,
    headers: Object.fromEntries(response.headers.entries()),
  };

  // Apply afterRequest interceptors if any.
  if (fetchOptions.config?.hasInterceptors) {
    httpResponse = fetchOptions.config.interceptors.reduce(
      (rsp: HttpResponse<T>, i: Interceptor) => i.afterRequest(rsp),
      httpResponse,
    ) as HttpResponse<T>;
  }

  // Should retry the request?
  if (httpResponse.status >= 400) {
    const { retries = 0 } = fetchOptions;

    // when unauthorized
    if (
      httpResponse.status == 401 &&
      fetchOptions.config.auth?.type === 'oauth' &&
      retries < fetchOptions.config.maxRetries
    ) {
      await fetchOptions.config.auth.oauth?.refreshToken(fetchOptions.config);
      return _fetch(resource, { ...fetchOptions, retries: retries + 1 });
    }

    // when rate limit exceeded
    if (httpResponse.status === 429 && retries < fetchOptions.config.maxRetries) {
      const retryTimeout = httpResponse.headers['x-retry-after']
        ? parseFloat(httpResponse.headers['x-retry-after']!) * 1000
        : getRetryTimeout(retries);

      await new Promise((resolve) => setTimeout(resolve, retryTimeout));
      return _fetch(resource, { ...fetchOptions, retries: retries + 1 });
    }

    throw SparkApiError.when(httpResponse.status, {
      message: `failed to fetch <${resource}>`,
      cause: {
        request: {
          url,
          method: requestInit.method!,
          headers: requestInit.headers as Record<string, string>,
          body: requestInit.body,
        },
        response: {
          headers: httpResponse.headers,
          body: httpResponse.data,
          raw: new TextDecoder().decode(responseBytesBuffer),
        },
      },
    });
  }

  // otherwise, ok response.
  return httpResponse;
}

export async function _download(
  resource: string,
  options: RequestOptions & { method?: HttpMethod },
): Promise<HttpResponse> {
  const { method = 'GET', headers: _headers = {}, params, cancellationToken } = options;
  const url = Utils.formatUrl(resource, params);
  const headers = { 'Content-Type': 'application/json', ..._headers };

  return nodeFetch(url, { method, headers, redirect: 'manual', signal: cancellationToken as RequestInit['signal'] })
    .then(async (response) => {
      if (!response.ok || response.status >= 400) throw response;
      return {
        buffer: Streamer.fromBuffer(await response.arrayBuffer()),
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        data: null,
      };
    })
    .catch(async (response) => {
      const raw = new TextDecoder().decode(await response.arrayBuffer());
      throw SparkApiError.when(response.status, {
        message: `failed to download resource from <${resource}>`,
        cause: {
          request: { url, method, headers, body: null },
          response: { headers: response.headers, body: response.data, raw },
        },
      });
    });
}
