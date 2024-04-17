import { type Readable } from 'stream';

import { Config } from '../config';
import { Serializable } from '../data';
import { SparkError } from '../error';
import { SPARK_SDK } from '../constants';
import { HttpResponse, Multipart, getRetryTimeout } from '../http';
import Utils, { StringUtils, DateUtils } from '../utils';

import { BatchService } from './batch';
import { ApiResource, ApiResponse, Uri, UriParams } from './base';
import { VersionListed, GetSwaggerParams, GetVersionsParams, GetSchemaParams, GetMetadataParams } from './types';
import { DownloadParams, RecompileParams, CompileParams, CreateParams, PublishParams, GetStatusParams } from './types';
import { ImpEx, ExportResult, ImportResult } from './impex';
import { History } from './history';

export class Service extends ApiResource {
  get compilation() {
    return new Compilation(this.config);
  }

  get batch() {
    return new BatchService(this.config);
  }

  get log() {
    return new History(this.config);
  }

  /**
   * Create a new service by uploading a file and publishing it.
   * @param {CreateParams} params - the service creation parameters
   * @returns a summary of the upload, compilation, and publication process
   * @throws {SparkError} - if the service creation fails
   */
  async create(params: CreateParams) {
    const { upload, compilation } = await this.compile(params);
    const { engine_file_documentid: engineId, original_file_documentid: fileId } = upload.response_data;

    return this.publish({ fileId, engineId, ...params }).then((response) => {
      return { upload, compilation, publication: response.data };
    });
  }

  /**
   * Compile a service after uploading it.
   * @param {CreateParams} params - the service creation parameters
   * @returns a summary of the upload, compilation, and publication process
   */
  async compile(params: CompileParams) {
    const compilation = this.compilation;
    const upload = await compilation.initiate(params);
    const { nodegen_compilation_jobid: jobId } = upload.data.response_data;

    const status = await compilation.getStatus({ jobId, ...params });
    return { upload: upload.data, compilation: status.data };
  }

  /**
   * Publish a service after uploading and compiling it.
   * @param {PublishParams} params - the publication parameters
   * @returns {Promise<HttpResponse<ServicePublished>>} - the publication response
   */
  async publish(params: PublishParams): Promise<HttpResponse<ServicePublished>> {
    const { folder, service } = params;
    const [startDate, endDate] = DateUtils.parse(params.startDate, params.endDate);
    const url = Uri.from({ folder, service }, { base: this.config.baseUrl.full, endpoint: 'publish' });
    const body = {
      request_data: {
        draft_service_name: params.draftName ?? service,
        effective_start_date: startDate.toISOString(),
        effective_end_date: endDate.toISOString(),
        original_file_documentid: params.fileId,
        engine_file_documentid: params.engineId,
        version_difference: params.versioning ?? 'minor',
        should_track_user_action: `${params.trackUser ?? false}`,
      },
    };

    return this.request<ServicePublished>(url.value, { method: 'POST', body }).then((response) => {
      this.logger.log(`service published with version id <${response.data.response_data.version_id}>`);
      return response;
    });
  }

  /**
   * Execute a service with the given inputs.
   * @param {string | UriParams} uri - how to locate the service
   * @param {ExecuteParams<Inputs>} params - optionally the execution parameters (inputs, metadata, etc.)
   * @returns {Promise<HttpResponse<ServiceExecuted<Outputs>>>} - the service execution response
   * @throws {SparkError} - if the service execution fails
   */
  execute<Inputs, Outputs>(
    uri: string,
    params?: ExecuteParams<Inputs>,
  ): Promise<HttpResponse<ServiceExecuted<Outputs>>>;
  execute<Inputs, Outputs>(
    uri: UriParams,
    params?: ExecuteParams<Inputs>,
  ): Promise<HttpResponse<ServiceExecuted<Outputs>>>;
  execute<Inputs, Outputs>(uri: string | UriParams, params?: ExecuteParams<Inputs>) {
    uri = Uri.toParams(uri);
    const url = Uri.from(uri, { base: this.config.baseUrl.full, endpoint: 'execute' });
    const body = this.#buildExecuteBody(uri, params);

    return this.request<ServiceExecuted<Outputs>>(url.value, { method: 'POST', body });
  }

  /**
   * Validate the inputs for a service.
   * @param {string | UriParams} uri - how to locate the service
   * @param {ExecuteParams<Inputs>} params - optionally the validation parameters (inputs, metadata, etc.)
   * @returns {Promise<HttpResponse<ServiceExecuted<Outputs>>>} - the validation response
   * @throws {SparkError} - if the validation fails
   */
  validate<Inputs, Outputs>(
    uri: string,
    params?: ExecuteParams<Inputs>,
  ): Promise<HttpResponse<ServiceExecuted<Outputs>>>;
  validate<Inputs, Outputs>(
    uri: UriParams,
    params?: ExecuteParams<Inputs>,
  ): Promise<HttpResponse<ServiceExecuted<Outputs>>>;
  validate<Inputs, Outputs>(uri: string | UriParams, params?: ExecuteParams<Inputs>) {
    uri = Uri.toParams(uri);
    const url = Uri.from(uri, { base: this.config.baseUrl.full, endpoint: 'validation' });
    const body = this.#buildExecuteBody(uri, params);

    return this.request<ServiceExecuted<Outputs>>(url.value, { method: 'POST', body });
  }

  /**
   * Get the schema for a service.
   * @param {string | GetSchemaParams} uri - how to locate the service
   * @returns {Promise<HttpResponse>} - the service schema
   */
  getSchema(uri: string): Promise<HttpResponse>;
  getSchema(params: GetSchemaParams): Promise<HttpResponse>;
  getSchema(uri: string | GetSchemaParams): Promise<HttpResponse> {
    const { folder, service } = Uri.toParams(uri);
    const endpoint = `product/${folder}/engines/get/${service}`;
    const url = Uri.from(undefined, { base: this.config.baseUrl.value, version: 'api/v1', endpoint });

    return this.request(url.value);
  }

  /**
   * Get the metadata for a service.
   * @param {string | GetMetadataParams} uri - how to locate the service
   * @returns {Promise<HttpResponse<MetadataFound>>} - the service metadata.
   */
  getMetadata(uri: string): Promise<HttpResponse<MetadataFound>>;
  getMetadata(params: GetMetadataParams): Promise<HttpResponse<MetadataFound>>;
  getMetadata(uri: string | GetMetadataParams): Promise<HttpResponse<MetadataFound>> {
    const url = Uri.from(Uri.toParams(uri), { base: this.config.baseUrl.full, endpoint: 'metadata' });

    return this.request(url.value);
  }

  /**
   * Get the list of versions for a service.
   * @param {string | GetVersionsParams} uri - how to locate the service
   * @returns {Promise<HttpResponse<VersionListed>>} - the list of versions
   */
  getVersions(uri: string): Promise<HttpResponse<VersionListed>>;
  getVersions(params: GetVersionsParams): Promise<HttpResponse<VersionListed>>;
  getVersions(uri: string | GetVersionsParams): Promise<HttpResponse<VersionListed>> {
    const { folder, service } = Uri.toParams(uri);
    const endpoint = `product/${folder}/engines/getversions/${service}`;
    const url = Uri.from(undefined, { base: this.config.baseUrl.value, version: 'api/v1', endpoint });

    return this.request(url.value);
  }

  /**
   * Get the Swagger documentation for a service.
   * @param {string | GetSwaggerParams} uri - how to locate the service
   * @returns {Promise<HttpResponse>} - the Swagger documentation as binary data
   * via the `HttpResponse.buffer` property.
   */
  getSwagger(uri: string): Promise<HttpResponse>;
  getSwagger(params: GetSwaggerParams): Promise<HttpResponse>;
  getSwagger(uri: string | GetSwaggerParams): Promise<HttpResponse> {
    const { folder, service, versionId = '', downloadable = false, category = 'All' } = Uri.toParams(uri);
    const endpoint = `downloadswagger/${category}/${downloadable}/${versionId}`;
    const url = Uri.from({ folder, service }, { base: this.config.baseUrl.full, endpoint });

    return this.request(url.value);
  }

  /**
   * Download the original (Excel) or configured file.
   * @param {string | DownloadParams} uri - how to locate the service
   * @returns {Promise<HttpResponse>} - the file as binary data via the `HttpResponse.buffer` property.
   */
  download(uri: string): Promise<HttpResponse>;
  download(params: DownloadParams): Promise<HttpResponse>;
  download(uri: string | DownloadParams): Promise<HttpResponse> {
    const { folder, service, version = '', filename = '', type = 'original' } = Uri.toParams(uri);
    const endpoint = `product/${folder}/engines/${service}/download/${version}`;
    const url = Uri.from(undefined, { base: this.config.baseUrl.value, version: 'api/v1', endpoint });
    const params = { filename, type: type === 'configured' ? 'withmetadata' : '' };

    return this.request(url.value, { params });
  }

  /**
   * Recompile a service using a specific compiler version.
   * @param {string | RecompileParams} uri - how to locate the service
   * @returns {Promise<HttpResponse<ServiceRecompiled>>} - the recompilation status.
   */
  recompile(uri: string): Promise<HttpResponse<ServiceRecompiled>>;
  recompile(params: RecompileParams): Promise<HttpResponse<ServiceRecompiled>>;
  recompile(uri: string | RecompileParams): Promise<HttpResponse<ServiceRecompiled>> {
    const { folder, service, versionId, releaseNotes, ...params } = Uri.toParams(uri);
    const url = Uri.from({ folder, service }, { base: this.config.baseUrl.full, endpoint: 'recompileNodgen' });
    const [startDate, endDate] = DateUtils.parse(params.startDate, params.endDate);
    const data = {
      versionId,
      releaseNotes: releaseNotes ?? `Recompiled via ${SPARK_SDK}`,
      upgradeType: params.upgrade ?? 'patch',
      neuronCompilerVersion: params.compiler ?? 'StableLatest',
      tags: Array.isArray(params.tags) ? params.tags.join(',') : params?.tags,
      versionLabel: params?.label,
      effectiveStartDate: startDate.toISOString(),
      effectiveEndDate: endDate.toISOString(),
    };

    return this.request(url.value, { method: 'POST', body: { request_data: data } });
  }

  async export(uri: string | ExportParams): Promise<HttpResponse<ExportResult>[]> {
    const impex = ImpEx.only(this.config);
    const { folder, service, version, versionId, retries = this.config.maxRetries + 2, ...params } = Uri.toParams(uri);
    const serviceUri = Uri.encode({ folder, service, version }, false);

    const response = await impex.exports.initiate({
      services: serviceUri ? [serviceUri] : [],
      versionIds: versionId ? [versionId] : [],
      ...params,
    });
    const jobId = response.data?.id;
    if (!jobId) throw new SparkError('failed to produce an export job', response);
    this.logger.log(`export job created <${jobId}>`);

    const status = await impex.exports.getStatus(jobId, { maxRetries: retries });
    if (status.data?.outputs?.files?.length === 0) {
      throw new SparkError('export job failed to produce any files', status);
    }

    const downloads: HttpResponse<ExportResult>[] = [];
    for (const file of status.data.outputs.files) {
      if (!file.file) continue;
      try {
        downloads.push(await this.request<ExportResult>(file.file)); // confirm MD5 hash?
      } catch (cause) {
        this.logger.warn(`failed to download file <${file.file}>`, cause);
      }
    }
    return downloads;
  }

  async import(uri: ImportParams): Promise<HttpResponse<ImportResult>> {
    const config = uri.config ?? this.config;
    const impex = ImpEx.only(config);
    const { folder, service, retries = config.maxRetries + 3, ...params } = Uri.toParams(uri);

    const response = await impex.imports.initiate({ destination: Uri.encode({ folder, service }, false), ...params });
    const jobId = response.data?.id;
    if (!jobId) throw new SparkError('failed to produce an import job', response);
    this.logger.log(`import job created <${jobId}>`);

    return impex.imports.getStatus(jobId, { maxRetries: retries });
  }

  async migrate(params: MigrateUriParams) {
    const exported = await this.export(params);
    if (exported.length === 0) throw new SparkError('failed to export any files');
    const imported = await this.import({ ...params, file: exported[0].buffer });

    return { exports: exported, imports: imported };
  }

  #buildExecuteBody<T>(uri: UriParams, { data = {}, inputs: initialInputs, raw }: ExecuteParams<T> = {}): ExecuteBody {
    const defaultValues = { callPurpose: SPARK_SDK, compilerType: 'Neuron', version: uri.version };
    const metadata = {
      service_uri: data?.serviceUri,
      service_id: data?.serviceId ?? uri.serviceId,
      version: data?.version ?? defaultValues.version,
      version_id: data?.versionId ?? uri.versionId,
      transaction_date: DateUtils.isDate(data?.activeSince) ? data.activeSince.toISOString() : undefined,
      source_system: data?.sourceSystem,
      correlation_id: data?.correlationId,
      call_purpose: data?.callPurpose ?? defaultValues.callPurpose,
      array_outputs: Array.isArray(data?.outputs) ? data.outputs.join(',') : data?.outputs,
      compiler_type: data?.compilerType ?? defaultValues.compilerType,
      debug_solve: data?.debugSolve,
      excel_file: data?.downloadable,
      requested_output: Array.isArray(data?.output) ? data.output.join(',') : data?.output,
      requested_output_regex: data?.outputRegex,
      response_data_inputs: data?.withInputs,
      service_category: Array.isArray(data?.subservices) ? data.subservices.join(',') : data?.subservices,
      validation_type: data?.validationType,
    };

    const inputs = data?.inputs || initialInputs;
    if (!Utils.isObject(inputs) && StringUtils.isNotEmpty(raw)) {
      const parsed = Serializable.deserialize(raw as string, () => {
        this.logger.warn('failed to parse the raw input as JSON', raw);
        return { request_data: { inputs: {} }, request_meta: metadata };
      });

      parsed.request_meta = Utils.isObject(parsed?.request_meta)
        ? { ...defaultValues, ...parsed.request_meta }
        : metadata;
      return parsed;
    } else {
      return { request_data: { inputs: inputs ?? {} }, request_meta: metadata };
    }
  }
}

class Compilation extends ApiResource {
  /**
   * Upload a service file and initiate the compilation process.
   * @param {CompileParams} params - the compilation parameters
   * @returns {Promise<HttpResponse<ServiceCompiled>>} - the upload response
   */
  async initiate(params: CompileParams): Promise<HttpResponse<ServiceCompiled>> {
    const url = Uri.from(params, { base: this.config.baseUrl.full, endpoint: 'upload' });
    const [startDate, endDate] = DateUtils.parse(params.startDate, params.endDate);
    const metadata = {
      request_data: {
        version_difference: params.versioning ?? 'minor',
        effective_start_date: startDate.toISOString(),
        effective_end_date: endDate.toISOString(),
      },
    };
    const multiparts: Multipart[] = [
      { name: 'engineUploadRequestEntity', data: metadata },
      { name: 'serviceFile', fileStream: params.file, fileName: params.fileName ?? `${params.service}.xlsx` },
    ];

    return this.request<ServiceCompiled>(url.value, { method: 'POST', multiparts }).then((response) => {
      this.logger.log(`service file uploaded <${response.data.response_data.original_file_documentid}>`);
      return response;
    });
  }

  /**
   * Get the status of a compilation job.
   * @param {GetStatusParams} params - how to locate the compilation job.
   * @returns {Promise<HttpResponse<CompilationStatus>>} - the compilation status.
   */
  async getStatus(params: GetStatusParams): Promise<HttpResponse<CompilationStatus>> {
    const { jobId, maxRetries = this.config.maxRetries, retryInterval = 2 } = params;
    const url = Uri.from(params, { base: this.config.baseUrl.full, endpoint: `getcompilationprogess/${jobId}` });

    let retries = 0;
    let response = await this.request<CompilationStatus>(url.value);
    do {
      const { progress } = response.data.response_data;
      if (progress == 100) return response;

      this.logger.log(`waiting for compilation job to complete - ${progress || 0}%`);
      await new Promise((resolve) => setTimeout(resolve, getRetryTimeout(retries, retryInterval)));

      retries++;
      response = await this.request<CompilationStatus>(url.value);
    } while (response.data.response_data.progress < 100 && retries < maxRetries);

    if (response.data.response_data.status === 'Success') return response;

    const error = SparkError.sdk({ message: `compilation job status check timed out`, cause: response });
    this.logger.error(error.message);
    throw error;
  }
}

type CompilerType = 'Neuron' | 'Type3' | 'Type2' | 'Type1' | 'Xconnector';

type ValidationType = 'default_values' | 'dynamic';

interface ServiceApiResponse<TData, TMeta = Record<string, any>> extends Pick<ApiResponse, 'status' | 'error'> {
  response_data: TData;
  response_meta: TMeta;
}

interface ExportParams extends Pick<UriParams, 'folder' | 'service' | 'version' | 'versionId'> {
  filters?: { file?: 'migrate' | 'onpremises'; version?: 'latest' | 'all' };
  sourceSystem?: string;
  correlationId?: string;
  retries?: number;
}

interface ImportParams extends Pick<UriParams, 'folder' | 'service'> {
  file: Readable;
  ifPresent?: 'abort' | 'replace' | 'add_version';
  sourceSystem?: string;
  correlationId?: string;
  retries?: number;
  config?: Config;
}

interface MigrateUriParams extends Pick<UriParams, 'folder' | 'service' | 'version' | 'versionId'> {
  /** The target configuration for the import operation. */
  config: Config;
  filters?: { file?: 'migrate' | 'onpremises'; version?: 'latest' | 'all' };
  ifPresent?: 'abort' | 'replace' | 'add_version';
  sourceSystem?: string;
  correlationId?: string;
  retries?: number;
}

interface ExecuteData<Inputs = Record<string, any>> {
  // Input definitions for calculation
  inputs?: Inputs | null;

  // Parameters to identify the correct service and version to use:
  serviceUri?: string;
  serviceId?: string;
  version?: string;
  versionId?: string;
  activeSince?: string | number | Date;

  // These fields, if provided as part of the API request, are visible in the API Call History.
  sourceSystem?: string;
  correlationId?: string;
  callPurpose?: string;

  // Parameters to control the response outputs
  outputs?: undefined | string | string[];
  compilerType?: CompilerType;
  debugSolve?: boolean;
  downloadable?: boolean;
  output?: undefined | string | string[];
  outputRegex?: string;
  withInputs?: boolean;
  subservices?: undefined | string | string[];
  validationType?: ValidationType;
}

interface ExecuteParams<Inputs = Record<string, any>> {
  readonly data?: ExecuteData<Inputs>;
  readonly inputs?: Inputs;
  readonly raw?: string;
}

type ExecuteBody<Inputs = Record<string, any>> = {
  request_data: { inputs: Inputs | null };
  request_meta: {
    service_uri?: string;
    service_id?: string;
    version?: string;
    version_id?: string;
    transaction_date?: string;
    source_system?: string;
    correlation_id?: string;
    call_purpose?: string;
    array_outputs?: string;
    compiler_type?: string;
    debug_solve?: boolean;
    excel_file?: boolean;
    requested_output?: string;
    requested_output_regex?: string;
    response_data_inputs?: boolean;
    service_category?: string;
    validation_type?: ValidationType;
  };
};

type ServiceCompiled = ServiceApiResponse<{
  lines_of_code: number;
  hours_saved: number;
  nodegen_compilation_jobid: string;
  original_file_documentid: string;
  engine_file_documentid: string;
  warnings: any[] | null;
  current_statistics: any | null;
  no_of_sheets: number;
  no_of_inputs: number;
  no_of_outputs: number;
  no_of_formulas: number;
  no_of_cellswithdata: number;
}>;

type ServiceExecuted<Outputs = Record<string, any>> = ServiceApiResponse<{
  outputs: Outputs;
  warnings: Partial<{ source_path: string; message: string }>[] | null;
  errors:
    | Partial<{
        error_category: string;
        error_type: string;
        additional_details: string;
        source_path: string;
        message: string;
      }>[]
    | null;
  service_chain:
    | Partial<{
        service_name: string;
        run_if: string;
        requested_report: string;
        requested_report_filename: string;
      }>[]
    | null;
}>;

type MetadataFound = ServiceExecuted;

type CompilationStatus = ServiceApiResponse<{
  status: string;
  last_error_message: string;
  progress: number;
}>;

type ServicePublished = ServiceApiResponse<{ version_id: string }>;

type ServiceRecompiled = ServiceApiResponse<{
  versionId: string;
  revision: string;
  jobId: string;
}>;
