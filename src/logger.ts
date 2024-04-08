import { isBrowser } from './utils';
import { sdkLogger } from './version';

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  day: '2-digit',
  month: '2-digit',
});

enum Colors {
  orange = '#FFA500',
  yellow = '#FFD700',
  salmon = '#FFA07A',
  coral = '#F08080',
  blue = '#87CEFA',
  steelBlue = '#B0C4DE',
  slateGray = '#778899',
  green = '#90EE90',
  seaGreen = '#20B2AA',
  limeGreen = '#32CD32',
  purple = '#9370DB',
  lavender = '#E6E6FA',
  linen = '#FAF0E6',
  magenta = '#FF00FF',
}

export type LogLevel = 'none' | 'log' | 'debug' | 'verbose' | 'warn' | 'error' | 'fatal';

export interface LoggerService {
  log(message: any, ...params: any[]): any;

  error(message: any, ...params: any[]): any;

  warn(message: any, ...params: any[]): any;

  debug?(message: any, ...params: any[]): any;

  verbose?(message: any, ...params: any[]): any;

  fatal?(message: any, ...params: any[]): any;

  setLogLevels?(levels: LogLevel[]): any;
}

/**
 * A log category.
 */
export class Log {
  static readonly none = new Log('none');
  static readonly verbose = new Log('verbose');
  static readonly debug = new Log('debug');
  static readonly log = new Log('log');
  static readonly warn = new Log('warn');
  static readonly error = new Log('error');
  static readonly fatal = new Log('fatal');

  protected constructor(readonly level: LogLevel) {}

  static weights: Record<LogLevel, number> = {
    verbose: 0,
    debug: 1,
    log: 2,
    warn: 3,
    error: 4,
    fatal: 5,
    none: 6,
  };

  /**
   * Returns the log levels that are enabled for this category.
   */
  get levels(): LogLevel[] {
    return Object.keys(Log.weights).filter(
      (level) => Log.weights[level as LogLevel] >= Log.weights[this.level],
    ) as LogLevel[];
  }

  /**
   * Determines if this log category should print messages.
   * @param levels given these log levels
   */
  isEnabled(levels?: LogLevel[]): boolean {
    if (!levels || (Array.isArray(levels) && levels?.length === 0)) return false;
    if (levels.includes(this.level)) return true;

    const highestValue = levels.map((level) => Log.weights[level]).sort((a, b) => b - a)?.[0];
    return Log.weights[this.level] >= highestValue;
  }
}

export interface LoggerOptions {
  /**
   * Enabled log levels.
   */
  logLevels?: LogLevel[];

  /**
   * If enabled, will print timestamp (time difference) between current and previous log message.
   */
  timestamp?: boolean;

  /**
   * If enabled, will print colorful logs.
   */
  colorful?: boolean;
}

/**
 * A Node console logger.
 *
 * Inspired by NestJS's Logger.
 * @see https://github.com/nestjs/nest/blob/master/packages/common/services/console-logger.service.ts
 */
class NodeLogger implements LoggerService {
  static readonly logLevels: LogLevel[] = ['log', 'error', 'warn', 'debug', 'verbose', 'fatal'];
  protected readonly options!: LoggerOptions;

  constructor();
  constructor(options: LoggerOptions);
  constructor({ logLevels = BrowserLogger.logLevels, timestamp = true, colorful = true }: LoggerOptions = {}) {
    this.options = { logLevels, timestamp, colorful };
  }

  log(message: any, ...params: any[]) {
    if (!Log.log.isEnabled(this.options?.logLevels)) return;

    this.printMessages([message, ...params], 'log');
  }

  error(message: any, ...params: any[]) {
    if (!Log.error.isEnabled(this.options?.logLevels)) return;

    this.printMessages([message, ...params], 'error', 'stderr');
  }

  warn(message: any, ...params: any[]) {
    if (!Log.warn.isEnabled(this.options?.logLevels)) return;

    this.printMessages([message, ...params], 'warn');
  }

  debug(message: any, ...params: any[]) {
    if (!Log.debug.isEnabled(this.options?.logLevels)) return;

    this.printMessages([message, ...params], 'debug');
  }

  verbose(message: any, ...params: any[]) {
    if (!Log.verbose.isEnabled(this.options?.logLevels)) return;

    this.printMessages([message, ...params], 'verbose');
  }

  fatal(message: any, ...params: any[]) {
    if (!Log.fatal.isEnabled(this.options?.logLevels)) return;

    this.printMessages([message, ...params], 'fatal', 'stderr');
  }

  setLogLevels(levels: LogLevel[]) {
    this.options.logLevels = levels;
  }

  protected printMessages(messages: unknown[], logLevel: LogLevel = 'log', writeStreamType?: 'stdout' | 'stderr') {
    messages.forEach((message) => {
      const formattedMessage = this.formatMessage(message, logLevel);
      process[writeStreamType ?? 'stdout'].write(formattedMessage);
    });
  }

  protected formatMessage(message: unknown, logLevel: LogLevel) {
    const heading = sdkLogger;
    const formattedLevel = logLevel.toUpperCase().padStart(7, ' ');
    const timestamp = this.options.timestamp ? dateTimeFormatter.format(Date.now()) : '';

    if (!this.options.colorful) return `${heading} ${timestamp} ${formattedLevel} ${message}\n`;

    const coloredHeading = `\x1B[38;5;3m${heading}\x1B[39m`;
    const coloredTimestamp = `\x1B[34m${timestamp}\x1B[39m`;
    const coloredLevelAndMsg = this.getColorByLogLevel(logLevel)(`${formattedLevel} ${message}`);
    return `${coloredHeading} ${coloredTimestamp} ${coloredLevelAndMsg}\n`;
  }

  /**
   * Color the log message using ANSI escape codes.
   * Special thanks to https://gist.github.com/fnky/458719343aabd01cfb17a3a4f7296797
   */
  private getColorByLogLevel(level: LogLevel) {
    switch (level) {
      case 'debug':
        return (text: string) => `\x1B[95m${text}\x1B[39m`; // magenta
      case 'warn':
        return (text: string) => `\x1B[33m${text}\x1B[39m`; // yellow
      case 'error':
        return (text: string) => `\x1B[31m${text}\x1B[39m`; // red
      case 'verbose':
        return (text: string) => `\x1B[96m${text}\x1B[39m`; // cyan
      case 'fatal':
        return (text: string) => `\x1B[1m${text}\x1B[0m`; // bold
      default:
        return (text: string) => `\x1B[32m${text}\x1B[39m`; // green
    }
  }
}

/**
 * A browser console logger.
 */
class BrowserLogger implements LoggerService {
  static readonly logLevels: LogLevel[] = ['log', 'error', 'warn', 'debug', 'verbose'];
  protected readonly options!: LoggerOptions;

  constructor();
  constructor(options: LoggerOptions);
  constructor({ logLevels = BrowserLogger.logLevels, timestamp = true, colorful = true }: LoggerOptions = {}) {
    this.options = { logLevels, timestamp, colorful };
  }

  log(message: any, ...params: any[]) {
    if (!Log.log.isEnabled(this.options?.logLevels)) return;

    this.printMessages(message, 'log', 'log', ...params);
  }

  warn(message: any, ...params: any[]) {
    if (!Log.warn.isEnabled(this.options.logLevels)) return;

    this.printMessages(message, 'warn', 'warn', ...params);
  }

  debug(message: any, ...params: any[]) {
    if (!Log.debug.isEnabled(this.options.logLevels)) return;

    this.printMessages(message, 'debug', 'info', ...params);
  }

  verbose(message: any, ...params: any[]) {
    if (!Log.verbose.isEnabled(this.options.logLevels)) return;

    this.printMessages(message, 'verbose', 'info', ...params);
  }

  error(message: any, ...params: any[]) {
    if (!Log.error.isEnabled(this.options.logLevels)) return;

    this.printMessages(message, 'error', 'error', ...params);
  }

  fatal(message: any, ...params: any[]) {
    if (!Log.fatal.isEnabled(this.options.logLevels)) return;

    this.printMessages(message, 'error', 'error', ...params);
  }

  protected printMessages(
    message: unknown,
    logLevel: LogLevel = 'log',
    methodName: 'log' | 'warn' | 'error' | 'info' = 'log',
    ...args: any[]
  ) {
    const formattedMessages = this.formatMessage(message as string, logLevel);
    console[methodName](...formattedMessages, ...args);
  }

  protected formatMessage(message: string, logLevel: LogLevel) {
    const heading = sdkLogger;
    const formattedLevel = logLevel.toUpperCase();
    const timestamp = this.options.timestamp ? dateTimeFormatter.format(Date.now()) : '';

    if (!this.options.colorful) return [`${heading} ${timestamp} ${formattedLevel} ${message}`];

    const levelColor = this.getColorByLogLevel(logLevel);
    const formattedMessage = `%c${heading} %c${timestamp} %c${formattedLevel} ${message}`;
    return [formattedMessage, `color: ${Colors.orange}`, `color: ${Colors.blue}`, `color: ${levelColor}`];
  }

  /**
   * Color the log message using CSS.
   * Special thanks to https://stackoverflow.com/q/7505623
   */
  private getColorByLogLevel(level: LogLevel) {
    switch (level) {
      case 'log':
        return Colors.green;
      case 'debug':
        return Colors.limeGreen;
      case 'verbose':
        return Colors.seaGreen;
      case 'warn':
        return Colors.yellow;
      case 'error':
        return Colors.coral;
      case 'fatal':
        return Colors.salmon;
      default:
        return Colors.linen;
    }
  }
}

export const DEFAULT_LOGGER = isBrowser() ? new BrowserLogger() : new NodeLogger();

export class Logger implements LoggerService {
  protected static staticInstanceRef: LoggerService = DEFAULT_LOGGER;

  protected localInstanceRef?: LoggerService;
  protected readonly options!: LoggerOptions;

  constructor();
  constructor(options: LoggerOptions);
  constructor({ logLevels = BrowserLogger.logLevels, timestamp = true, colorful = true }: LoggerOptions = {}) {
    this.options = { logLevels, timestamp, colorful };
  }

  get localInstance(): LoggerService {
    if (Logger.staticInstanceRef === DEFAULT_LOGGER) {
      return this.registerLocalInstanceRef();
    } else if (Logger.staticInstanceRef instanceof Logger) {
      const prototype = Object.getPrototypeOf(Logger.staticInstanceRef);
      if (prototype.constructor === Logger) {
        return this.registerLocalInstanceRef();
      }
    }
    return Logger.staticInstanceRef;
  }

  error(message: any, ...optionalParams: any[]) {
    this.localInstance?.error(message, ...optionalParams);
  }

  log(message: any, ...optionalParams: any[]) {
    this.localInstance?.log(message, ...optionalParams);
  }

  warn(message: any, ...optionalParams: any[]) {
    this.localInstance?.warn(message, ...optionalParams);
  }

  debug(message: any, ...optionalParams: any[]) {
    this.localInstance?.debug?.(message, ...optionalParams);
  }

  verbose(message: any, ...optionalParams: any[]) {
    this.localInstance?.verbose?.(message, ...optionalParams);
  }

  fatal(message: any, ...optionalParams: any[]) {
    this.localInstance?.fatal?.(message, ...optionalParams);
  }

  setLogLevels(levels: LogLevel[]) {
    this.options.logLevels = levels;
  }

  static of(options?: boolean | string | LoggerOptions): LoggerOptions {
    const defaultOptions: LoggerOptions = {
      colorful: true,
      timestamp: true,
      logLevels: isBrowser() ? BrowserLogger.logLevels : NodeLogger.logLevels,
    };

    if (typeof options === 'boolean') return { logLevels: options ? defaultOptions.logLevels : ['none'] };
    if (typeof options === 'string') return { ...defaultOptions, logLevels: [options.toLowerCase() as LogLevel] };
    if (typeof options === 'object' && options !== null) return { ...defaultOptions, ...options };
    return defaultOptions;
  }

  static error(message: any, ...optionalParams: any[]) {
    this.staticInstanceRef?.error(message, ...optionalParams);
  }

  static log(message: any, ...optionalParams: any[]) {
    this.staticInstanceRef?.log(message, ...optionalParams);
  }

  static warn(message: any, ...optionalParams: any[]) {
    this.staticInstanceRef?.warn(message, ...optionalParams);
  }

  static debug(message: any, ...optionalParams: any[]) {
    this.staticInstanceRef?.debug?.(message, ...optionalParams);
  }

  static verbose(message: any, ...optionalParams: any[]) {
    this.staticInstanceRef?.verbose?.(message, ...optionalParams);
  }

  static fatal(message: any, ...optionalParams: any[]) {
    this.staticInstanceRef?.fatal?.(message, ...optionalParams);
  }

  private registerLocalInstanceRef() {
    if (this.localInstanceRef) return this.localInstanceRef;

    const logger = isBrowser() ? BrowserLogger : NodeLogger;
    this.localInstanceRef = new logger(this.options);

    return this.localInstanceRef;
  }
}
