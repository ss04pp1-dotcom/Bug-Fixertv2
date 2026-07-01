'use client';

export { apiClient, extractData, getApiErrorMessage } from './axios-client';
export type { ApiResponse } from './axios-client';
export { API_CONFIG, buildImageUrl } from './config/api';

import { API_CONFIG } from './config/api';

export const API_URL = API_CONFIG.BASE_URL;
