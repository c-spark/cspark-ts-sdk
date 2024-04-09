import { HttpResponse } from '../http';
import { Serializable } from '../data';
import { SPARK_SDK } from '../constants';
import Utils, { StringUtils } from '../utils';

import { ApiResource, Uri, UriParams } from './base';

export class BatchService extends ApiResource {
  /**
   * Executes a synchronous batch request.
   *
   * @param uri - how to locate the service
   * @param {BodyParams} params - the request body
   */
  execute(uri: Omit<UriParams, 'proxy' | 'versionId'>, params: BodyParams = {}): Promise<HttpResponse> {
    const { folder, service, version, ...rest } = uri;
    const url = Uri.from(rest, { base: this.config.baseUrl.full, version: 'api/v4', endpoint: 'execute' });
    const serviceUri = Uri.encode({ folder, service, version }, false);

    const body = (({ data, inputs: initialInputs, raw }: BodyParams, otherValues: Record<string, string>) => {
      const metadata = {
        service: data?.serviceUri ?? otherValues.serviceUri,
        version_id: data?.versionId,
        version_by_timestamp: data?.versionByTimestamp,
        subservice: data?.subservice,
        output: data?.output,
        call_purpose: data?.callPurpose ?? otherValues.callPurpose,
        source_system: data?.sourceSystem,
        correlation_id: data?.correlationId,
      };

      const inputs = data?.inputs || initialInputs;
      if ((!Array.isArray(inputs) || inputs?.length === 0) && StringUtils.isNotEmpty(raw)) {
        const parsed = Serializable.deserialize(raw as string, () => {
          this.logger.warn('failed to parse the raw input as JSON', raw);
          return { inputs: [], ...metadata };
        });

        return Utils.isObject(parsed) ? { ...metadata, ...parsed } : { inputs: [], ...metadata };
      } else {
        return { inputs: inputs ?? [], ...metadata };
      }
    })(params, { serviceUri, callPurpose: SPARK_SDK });

    return this.request(url.value, { method: 'POST', body });
  }
}

interface BodyParams {
  readonly data?: ExecData;
  readonly inputs?: Record<string, any>[];
  readonly raw?: string;
}

interface ExecData {
  inputs: Record<string, any>[];
  serviceUri?: string;
  versionId?: string;
  versionByTimestamp?: string;
  subservice?: string;
  output?: string;
  callPurpose?: string;
  sourceSystem?: string;
  correlationId?: string;
}
