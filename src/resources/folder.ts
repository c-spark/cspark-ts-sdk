import { type Readable } from 'stream';

import { Serializable } from '../data';
import { SparkApiError } from '../error';
import { HttpResponse, Multipart } from '../http';
import { DateUtils, StringUtils } from '../utils';
import { SPARK_SDK } from '../constants';

import { ApiResource, Uri, ApiResponse } from './base';

export class Folder extends ApiResource {
  /**
   * Get the list of folder categories.
   * @returns {Promise<HttpResponse<FolderCategories>>}
   */
  getCategories(): Promise<HttpResponse<FolderCategories>> {
    const url = Uri.from({}, { base: this.config.baseUrl.value, version: 'api/v1', endpoint: 'lookup/getcategories' });
    return this.request(url.value);
  }

  /**
   * Create a new folder.
   * @param {string | CreateParams} params - Folder name (and additional information)
   * If `params` is a string, it will be used as the folder name.
   * @returns {Promise<HttpResponse<FolderCreated>>}
   */
  async create(params: string | CreateParams): Promise<HttpResponse<FolderCreated>> {
    const url = Uri.from({}, { base: this.config.baseUrl.value, version: 'api/v1', endpoint: 'product/create' });
    const createParams = (StringUtils.isString(params) ? { name: params } : params) as CreateParams;
    const { name, category = 'Other', description, status, cover } = createParams;
    const [startDate, launchDate] = DateUtils.parse(createParams.startDate, createParams.launchDate);

    const multiparts: Multipart[] = [
      { name: 'Name', data: name.trim() },
      { name: 'Category', data: category },
      { name: 'Description', data: description ?? `Created by ${SPARK_SDK}` },
      { name: 'StartDate', data: startDate.toISOString() },
      { name: 'LaunchDate', data: launchDate.toISOString() },
      { name: 'Status', data: status ?? 'Design' },
    ];

    const response = await this.request<FolderLocation>(url.value, { method: 'POST', multiparts });
    if (response.data.status === 'Success') {
      if (cover) await this.uploadCover(response.data.data.folderId, cover);
      return this.request<FolderCreated>(response.data.data.get_product_url);
    }

    const cause = {
      request: { url: url.value, method: 'POST', headers: this.defaultHeaders, body: multiparts },
      response: { headers: response.headers, body: response.data, raw: Serializable.serialize(response.data) },
    };

    if (response.data.errorCode === 'PRODUCT_ALREADY_EXISTS') {
      throw SparkApiError.when(409, { message: `folder name <${name}> already exists`, cause });
    }
    throw SparkApiError.when(response.status, { message: `failed to create folder with name <${name}>`, cause });
  }

  /**
   * Find folders by name, status, category, or favorite.
   * @param {string | SearchParams} params - Search parameters (name, status, category, favorite)
   * If `params` is a string, it will be used as the name to search for.
   * @param {Paging} paging - Paging options (page, size, sort)
   * @returns {Promise<HttpResponse<FolderListed>>}
   *
   * Note: `SearchParams.favorite` requires additional permissions if you're using API keys
   * for authentication.
   */
  find(params: string | SearchParams, paging: Paging = {}): Promise<HttpResponse<FolderListed>> {
    const url = Uri.from({}, { base: this.config.baseUrl.value, version: 'api/v1', endpoint: 'product/list' });
    const searchParams = (StringUtils.isString(params) ? { name: params } : params) as SearchParams;
    const search = Object.entries(searchParams)
      .filter(([, value]) => !!value)
      .map(([field, value]) => (field === 'favorite' ? { field: 'isstarred', value } : { field, value }));

    const body = {
      search,
      page: paging?.page ?? 1,
      pageSize: paging?.size ?? 100,
      sort: paging?.sort ?? '-updated',
      shouldFetchActiveServicesCount: true,
    };

    return this.request(url.value, { method: 'POST', body });
  }

  /**
   * Update a folder's information.
   * @param {string} id - Folder ID
   * @param {CreateParams} params - Folder information to update
   * @returns {Promise<HttpResponse<FolderUpdated>>}
   */
  async update(id: string, params: Omit<CreateParams, 'name' | 'status'>): Promise<HttpResponse<FolderUpdated>> {
    id = id?.trim();
    const endpoint = `product/update/${id}`;
    const url = Uri.from({}, { base: this.config.baseUrl.value, version: 'api/v1', endpoint });
    const { cover, ...rest } = params;
    if (cover) await this.uploadCover(id, cover);

    const body = { ...rest, shouldTrackUserAction: true };
    return this.request(url.value, { method: 'POST', body });
  }

  /**
   * Delete a folder by ID.
   * @param {string} id - Folder ID
   * @returns {Promise<HttpResponse<FolderDeleted>>}
   */
  delete(id: string): Promise<HttpResponse<FolderDeleted>> {
    const endpoint = `product/delete/${id?.trim()}`;
    const url = Uri.from({}, { base: this.config.baseUrl.value, version: 'api/v1', endpoint });
    return this.request(url.value, { method: 'DELETE' });
  }

  /**
   * Upload cover image to a folder by ID.
   * @param {string} id - Folder ID
   * @param {Readable} cover - base64 encoded cover image
   * @returns {Promise<HttpResponse<CoverUploaded>>}
   */
  uploadCover(id: string, cover: Readable): Promise<HttpResponse<CoverUploaded>> {
    const endpoint = `product/UploadCoverImage`;
    const url = Uri.from({}, { base: this.config.baseUrl.value, version: 'api/v1', endpoint });
    const multiparts: Multipart[] = [
      { name: 'id', data: id.trim() },
      { name: 'coverImage', fileStream: cover },
    ];

    return this.request(url.value, { method: 'POST', multiparts });
  }
}

export class File extends ApiResource {
  download(url: string): Promise<HttpResponse> {
    return this.request(url);
  }
}

type FolderCategory =
  | 'Medical'
  | 'Critical Illness'
  | 'Lifelong Participation'
  | 'Universal Life'
  | 'Investment Linked'
  | 'Annuity'
  | 'Term'
  | 'VHIS'
  | 'VHIS + Medical'
  | 'Property & Casualty'
  | 'Other';

interface CreateParams {
  name: string;
  description?: string;
  category?: FolderCategory;
  launchDate?: string;
  startDate?: string;
  status?: string;
  cover?: Readable;
}

interface SearchParams {
  id?: string;
  name?: string;
  status?: string;
  category?: FolderCategory;
  favorite?: boolean;
}

interface Paging {
  page?: number;
  size?: number;
  sort?: string;
}

interface FolderInfo {
  id: string;
  name: string;
  status: string;
  category: FolderCategory;
  description: string;
  coverImagePath: string;
  createdAt: string;
  createdBy: string;
  lastModifiedDate: string;
  isStarred: boolean;
  kanbanStatus: string;
  startDate: string;
  launchDate: string;
  activeServiceCount: number;
  totalServiceCount: number;
}

interface FolderApiResponse<T> extends Pick<ApiResponse, 'status'> {
  data: T;
  errorCode: string | null;
  message: string | null;
}

type FolderCategories = FolderApiResponse<Array<{ key: FolderCategory; value: FolderCategory; icon: string }>>;

type FolderLocation = FolderApiResponse<{ folderId: string; get_product_url: string }>;

type FolderListed = FolderApiResponse<FolderInfo[]> & { count: number; next: number; previous: number };

type FolderUpdated = FolderApiResponse<null>;

type FolderDeleted = FolderApiResponse<null>;

type CoverUploaded = FolderApiResponse<null>;

type FolderCreated = FolderApiResponse<
  FolderInfo & {
    totalServiceCount?: number;
    sections: any[];
    calculationEngines: {
      count: number;
      next: string;
      previous: any;
      message: string;
      data: any[];
      errorCode: any;
      status: string;
    };
  }
>;
