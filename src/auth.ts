import Utils, { type Maybe, StringUtils } from './utils';
import { SparkError } from './error';
import { ENV_VARS } from './constants';
import { Config } from './config';
import { Logger } from './logger';

import { OAuth2 as OAuthManager } from './resources/oauth2';

export interface OAuthMethod {
  /**
   * The API key (a.k.a synthetic key) to use for each request, if any.
   * By default, it'll be read from `process.env['CSPARK_API_KEY']`.
   */
  apiKey?: Maybe<string>;

  /**
   * The bearer token to use for requests, if any.
   * By default, it'll be read from `process.env['CSPARK_BEARER_TOKEN']`.
   */
  token?: Maybe<string>;

  /**
   * When using OAuth, client ID and secret are required.
   *
   * You can provide the client ID and secret directly, or you can provide a
   * file path to a JSON file containing the client ID and secret.
   * The file path can also be set using the `CSPARK_OAUTH_PATH` environment variable.
   */
  oauth?: Readonly<
    | {
        /**
         * The client ID to use for generating OAuth tokens.
         * By default, it'll be read from `process.env['CSPARK_CLIENT_ID']`.
         */
        clientId: string;

        /**
         * The client secret to use for generating OAuth tokens.
         * By default, it'll be read from `process.env['CSPARK_CLIENT_SECRET']`.
         */
        clientSecret: string;
      }
    | string
  >;
}

/**
 * User authorization methods.
 *
 * The client can be authorized using exclusively an API key, a bearer token, or
 * OAuth2 credentials.
 *
 * NOTE: The order of precedence is API key > Bearer token > OAuth.
 */
export class Authorization {
  readonly apiKey?: Maybe<string>;
  readonly token?: Maybe<string>;
  readonly oauth?: Maybe<OAuth>;

  private constructor({ apiKey, token, oauth }: OAuthMethod) {
    const clientId = Utils.readEnv(ENV_VARS.CLIENT_ID);
    const clientSecret = Utils.readEnv(ENV_VARS.CLIENT_SECRET);
    const oauthPath = Utils.readEnv(ENV_VARS.OAUTH_PATH);

    this.apiKey = apiKey;
    this.token = token?.replace(/bearer/i, '')?.trim();
    this.oauth = oauth
      ? OAuth.from(oauth!)
      : clientId && clientSecret
        ? new OAuth({ clientId, clientSecret })
        : oauthPath
          ? OAuth.fromFile(oauthPath)
          : undefined;
  }

  /**
   * Returns `true` if the client is authorized to use the API without any credentials.
   *
   * The platform supports "Public API", which are used to access public resources.
   * @see https://docs.coherent.global/spark-apis/public-apis for more information.
   */
  get isOpen(): boolean {
    return this.apiKey === 'open' || this.token === 'open' || this.oauth?.clientId === 'open';
  }

  get isEmpty(): boolean {
    return !this.apiKey && !this.token && !this.oauth;
  }

  get type(): keyof OAuthMethod | undefined {
    return this.apiKey ? 'apiKey' : this.token ? 'token' : this.oauth ? 'oauth' : undefined;
  }

  get asHeader(): Record<string, string> {
    if (this.apiKey) return { 'x-synthetic-key': this.apiKey };
    if (this.token) return { Authorization: `Bearer ${this.token}` };
    if (this.oauth) return { Authorization: `Bearer ${this.oauth.accessToken}` };
    return {};
  }

  static from(props: OAuthMethod): Authorization {
    const auth = new this(props);
    if (auth.isEmpty) {
      throw SparkError.sdk({
        message: ''.concat(
          'user authentication is required; ',
          'provide a valid API key, bearer token, or OAuth credentials to proceed.\n',
          'If you will be fetching public APIs, set API key as "open".',
        ),
        cause: Utils.isObject(props) ? JSON.stringify(props) : props.toString(),
      });
    }
    return auth;
  }
}

export class OAuth {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly filePath?: string | undefined;
  #accessToken?: AccessToken;

  constructor(props: Readonly<{ clientId: string; clientSecret: string }>) {
    this.clientId = props.clientId;
    this.clientSecret = props.clientSecret;

    if (StringUtils.isEmpty(this.clientId) || StringUtils.isEmpty(this.clientSecret)) {
      throw SparkError.sdk({
        message: 'OAuth client ID and secret are required',
        cause: JSON.stringify({ clientId: this.clientId, clientSecret: this.clientSecret }),
      });
    }
  }

  static from(props: Readonly<{ clientId?: string; clientSecret?: string } | string>): OAuth {
    if (Utils.isObject(props) && 'clientId' in props && 'clientSecret' in props) {
      return new this({ clientId: props.clientId!, clientSecret: props.clientSecret! });
    } else if (StringUtils.isString(props)) {
      return OAuth.fromFile(props as string);
    } else {
      throw SparkError.sdk({
        message: ''.concat(
          'invalid authorization properties. ',
          'Provide a JSON object including cliendId and clientSecret ',
          'or a string with the path to a JSON file containing the client ID and secret.',
        ),
        cause: Utils.isObject(props) ? JSON.stringify(props) : (props as string)?.toString(),
      });
    }
  }

  static fromFile(filePath: string): OAuth {
    if (Utils.isBrowser()) {
      throw SparkError.sdk({
        message: 'OAuth path is not supported in browser-like environments',
        cause: filePath,
      });
    }

    try {
      return new this(JSON.parse(Utils.readFile(filePath)));
    } catch (cause) {
      throw SparkError.sdk({
        message: `failed to create oauth credentials from file <${filePath}>`,
        cause,
      });
    }
  }

  get version(): string {
    return '2.0';
  }

  get flow(): OAuthFlow {
    return 'client_credentials';
  }

  get accessToken(): Maybe<string> {
    return this.#accessToken?.accessToken;
  }

  toString(): string {
    return JSON.stringify(this.toJson());
  }

  toJson(): Pick<OAuth, 'clientId' | 'clientSecret'> {
    return { clientId: this.clientId, clientSecret: this.clientSecret };
  }

  async retrieveToken(config: Config): Promise<void> {
    const logger = new Logger(config.logger);
    logger.log('refreshing OAuth2 access token...');

    try {
      const manager = new OAuthManager(config);
      this.#accessToken = await manager.requestAccessToken();
      if (!this.accessToken) logger.warn('failed to retrieve OAuth2 access token');
    } catch (reason) {
      logger.warn('failed to retrieve OAuth2 access token');
      return Promise.reject(reason);
    }
  }

  refreshToken(config: Config): Promise<void> {
    return this.retrieveToken(config);
  }
}

export interface AccessToken {
  readonly accessToken: string;
  readonly expiresIn: number;
  readonly refreshExpiresIn: number;
  readonly tokenType: string;
  readonly notBeforePolicy: number;
  readonly scope: string;
}

type OAuthFlow = 'client_credentials' | 'authorization_code' | 'implicit' | 'password';
