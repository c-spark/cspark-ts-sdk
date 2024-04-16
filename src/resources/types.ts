import { type Readable } from 'stream';
import { ApiResponse, UriParams } from './base';

type UpgradeType = 'major' | 'minor' | 'patch';

export interface VersionApiResponse<T> extends Pick<ApiResponse, 'status'> {
  data: T;
  errorCode: string | null;
  message: string | null;
}

export interface VersionInfo {
  id: string;
  createdAt: string;
  engine: string;
  revision: string;
  effectiveStartDate: string;
  effectiveEndDate: string;
  isActive: boolean;
  releaseNote: string;
  childEngines: any[] | null;
  versionLabel: string;
  defaultEngineType: string;
  tags: null;
  product: string;
  author: string;
  originalFileName: string;
}

export type VersionListed = VersionApiResponse<VersionInfo>;

export interface GetVersionsParams extends Pick<UriParams, 'folder' | 'service'> {}

export interface GetSchemaParams extends Pick<UriParams, 'folder' | 'service'> {}

export interface GetMetadataParams extends Omit<UriParams, 'version'> {}

export interface GetSwaggerParams extends Pick<UriParams, 'folder' | 'service' | 'versionId'> {
  category?: string;
  downloadable?: boolean;
}

export interface DownloadParams extends Pick<UriParams, 'folder' | 'service' | 'version'> {
  filename?: string;
  type?: 'original' | 'configured';
}

export interface RecompileParams extends Pick<UriParams, 'folder' | 'service' | 'versionId'> {
  upgrade?: UpgradeType;
  compiler?: string;
  releaseNotes?: string;
  label?: string;
  startDate?: number | string | Date;
  endDate?: number | string | Date;
  tags?: string | string[];
}

export interface CreateParams extends CompileParams {
  draftName?: string;
  trackUser?: boolean;
  maxRetries?: number;
  retryInterval?: number;
}

export interface CompileParams extends Pick<UriParams, 'folder' | 'service'> {
  folder: string;
  service: string;
  file: Readable;
  fileName?: string;
  versioning?: UpgradeType;
  startDate?: string | number | Date;
  endDate?: string | number | Date;
}

export interface GetStatusParams extends Pick<UriParams, 'folder' | 'service'> {
  folder: string;
  service: string;
  jobId: string;
  maxRetries?: number;
  retryInterval?: number;
}

export interface PublishParams extends Pick<UriParams, 'folder' | 'service'> {
  folder: string;
  service: string;
  fileId: string;
  engineId: string;
  draftName?: string;
  versioning?: UpgradeType;
  startDate?: string | number | Date;
  endDate?: string | number | Date;
  trackUser?: boolean;
}
