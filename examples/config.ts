import { type SparkClient, Logger } from '../src';

function retrieveToken(spark: SparkClient) {
  spark.config.auth.oauth
    ?.retrieveToken(spark.config)
    .then(() => console.log(`access token: ${spark.config.auth.oauth?.accessToken}`))
    .catch(console.error);
}

function printLogs() {
  Logger.verbose('verbose message');
  Logger.log('info message');
  Logger.debug('debug message');
  Logger.error('error message');
  Logger.warn('warn message');
  Logger.fatal('fatal message');

  const logger = new Logger({ colorful: false });
  logger.verbose('verbose message');
  logger.log('info message');
  logger.debug('debug message');
  logger.error('error message');
  logger.warn('warn message');
  logger.fatal('fatal message');
}

export default {
  retrieveToken,
  printLogs,
};
