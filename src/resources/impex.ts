import { type Readable } from 'stream';

import Utils, { StringUtils } from '../utils';
import { Config } from '../config';
import { SparkError } from '../error';
import { SPARK_SDK } from '../constants';
import { HttpResponse, Multipart, getRetryTimeout } from '../http';
import { ApiResource, Uri } from './base';

export class ImpEx {
  constructor(protected readonly configs: { readonly export: Config; readonly import: Config }) {}

  static with(config: Config): ImpEx {
    return new ImpEx({ export: config, import: config });
  }

  static migration(from: Config, to: Config): ImpEx {
    return new ImpEx({ export: from, import: to });
  }

  get export() {
    return new Export(this.configs.export);
  }

  get import() {
    return new Import(this.configs.import);
  }
}

class Export extends ApiResource {
  initiate(bodyParams: Readonly<ExportBodyParams> = {}): Promise<HttpResponse<ExportInit>> {
    const url = Uri.from({}, { base: this.config.baseUrl.full, version: 'api/v4', endpoint: 'export' });
    const { filters, ...params } = bodyParams;
    const metadata = {
      file_filter: filters?.file ?? 'migrate',
      version_filter: filters?.version ?? 'all',
      source_system: params?.sourceSystem,
      correlation_id: params?.correlationId,
    };

    const inputs: ExportBody['inputs'] = {};
    if (Utils.isNotEmptyArray(params?.folders)) inputs.folders = params!.folders;
    if (Utils.isNotEmptyArray(params?.services)) inputs.services = params!.services;
    if (Utils.isNotEmptyArray(params?.versionIds)) inputs.version_ids = params!.versionIds;
    if (Utils.isEmptyObject(inputs)) {
      throw new SparkError('at least one of folders, services, or versionIds must be provided');
    }

    return this.request(url.value, { method: 'POST', body: { inputs, ...metadata } });
  }

  async getStatus(
    jobId: string,
    { url: statusUrl, maxRetries = this.config.maxRetries }: { url?: string; maxRetries?: number } = {},
  ): Promise<HttpResponse<ExportResult>> {
    const url = Uri.from({}, { base: this.config.baseUrl.full, version: 'api/v4', endpoint: `export/${jobId}/status` });

    let retries = 0;
    while (retries < maxRetries) {
      const response = await this.request<ExportResult>(statusUrl ?? url.value);
      if (response.data?.status === 'closed' || response.data?.status === 'completed') {
        return response;
      }

      retries++;
      this.logger.log(`waiting for export job to complete (attempt ${retries} of ${maxRetries})`);

      const timeout = getRetryTimeout(retries, 2);
      await new Promise((resolve) => setTimeout(resolve, timeout));
    }
    throw SparkError.sdk({ message: 'export job status timed out' });
  }
}

class Import extends ApiResource {
  initiate(params: Readonly<ImportBodyParams>): Promise<HttpResponse<ImportInit>> {
    const url = Uri.from({}, { base: this.config.baseUrl.full, version: 'api/v4', endpoint: 'import' });
    const metadata = {
      inputs: { services_modify: buildServiceUris(params.service) },
      services_existing: params.ifPresent ?? 'update',
      source_system: params.sourceSystem ?? SPARK_SDK,
      correlation_id: params.correlationId,
    };
    const multiparts: Multipart[] = [
      { name: 'importRequestEntity', data: metadata },
      { name: 'file', fileStream: params.file },
    ];

    return this.request(url.value, { method: 'POST', multiparts });
  }

  async getStatus(
    jobId: string,
    { url: statusUrl, maxRetries = this.config.maxRetries }: { url?: string; maxRetries?: number } = {},
  ): Promise<HttpResponse<ImportResult>> {
    const url = Uri.from({}, { base: this.config.baseUrl.full, version: 'api/v4', endpoint: `import/${jobId}/status` });

    let retries = 0;
    while (retries < maxRetries) {
      const response = await this.request<ImportResult>(statusUrl ?? url.value);
      if (response.data?.status === 'closed' || response.data?.status === 'completed') {
        return response;
      }

      retries++;
      this.logger.log(`waiting for import job to complete (attempt ${retries} of ${maxRetries})`);

      const timeout = getRetryTimeout(retries, 2);
      await new Promise((resolve) => setTimeout(resolve, timeout));
    }
    throw SparkError.sdk({ message: 'import job status timed out' });
  }
}

interface ExportInit {
  id: string;
  object: string;
  status_url: string;
}

export interface ExportResult {
  id: string;
  object: string;
  status: string;
  status_url: string;
  response_timestamp: string;
  process_time: number;
  source_system: string;
  correlation_id: string;
  errors: any;
  outputs: {
    files: { file: string; file_hash: string }[];
    services: {
      service_uri_source: string;
      folder_source: string;
      service_source: string;
      service_id_source: string;
    }[];
    service_versions: {
      service_uri_source: string;
      folder_source: string;
      service_source: string;
      version_source: string;
      service_id_source: string;
      version_id_source: string;
    }[];
  };
}

interface ExportBodyParams {
  // FIXME: unclear whether these are mutually exclusive.
  folders?: string[];
  services?: string[];
  versionIds?: string[];
  // metadata
  filters?: { file?: 'migrate' | 'onpremises'; version?: 'latest' | 'all' };
  sourceSystem?: string;
  correlationId?: string;
}

type ExportBody = {
  inputs: {
    folders?: string[];
    services?: string[];
    version_ids?: string[];
  };
  source_system?: string;
  correlation_id?: string;
};

interface ImportInit {
  id: string;
  object: string;
  status_url: string;
}

interface ImportBodyParams {
  file: Readable;
  service: string | string[] | ServiceUri | ServiceUri[];
  ifPresent?: 'abort' | 'replace' | 'add_version';
  sourceSystem?: string;
  correlationId?: string;
}

interface ServiceUri {
  source: string;
  target?: string;
  upgrade?: UpgradeType;
}

type UpgradeType = 'major' | 'minor' | 'patch';

type ImportBody = {
  inputs: {
    services_modify: {
      service_uri_source: string;
      service_uri_destination: string;
      update_version_type: UpgradeType;
    }[];
  };
  services_existing: 'update' | 'replace' | 'abort';
  source_system?: string;
  correlation_id?: string;
};

export interface ImportResult {
  id: string;
  object: string;
  status: string;
  status_url: string;
  response_timestamp: string;
  process_time: number;
  source_system: string;
  correlation_id: string;
  errors: any;
  outputs: {
    services: {
      service_uri_source: string;
      folder_source: string;
      service_source: string;
      service_id_source: string;
      service_uri_destination: string;
      folder_destination: string;
      service_destination: string;
      service_id_destination: string;
      status: string;
    }[];
    service_versions: {
      service_uri_source: string;
      folder_source: string;
      service_source: string;
      version_source: string;
      service_id_source: string;
      version_id_source: string;
      folder_destination: string;
      service_destination: string;
      version_destination: string;
      service_uri_destination: string;
      service_id_destination: string;
      version_id_destination: string;
      status: string;
    }[];
  };
}

function buildServiceUris(
  serviceUri: string | string[] | ServiceUri | ServiceUri[],
  upgradeType: UpgradeType = 'minor',
): ImportBody['inputs']['services_modify'] {
  if (StringUtils.isString(serviceUri)) {
    const source = serviceUri as string;
    return [{ service_uri_source: source, service_uri_destination: source, update_version_type: upgradeType }];
  }

  if (Array.isArray(serviceUri)) {
    const serviceUris = [];
    for (const uri of serviceUri) {
      if (!uri) continue;
      serviceUris.push(...buildServiceUris(uri, upgradeType));
    }
    return serviceUris;
  }

  if (serviceUri && (serviceUri as ServiceUri)?.source) {
    const { source, target = source, upgrade = upgradeType } = serviceUri as ServiceUri;
    return [{ service_uri_source: source, service_uri_destination: target, update_version_type: upgrade }];
  }

  throw new SparkError('invalid import service uri', serviceUri);
}
