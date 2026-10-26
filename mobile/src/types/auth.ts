export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: 'manager' | 'employee';
  status: 'active' | 'suspended';
  branch_id?: string | null;
  branch_name?: string | null;
  managerial_access?: boolean;
  hourly_rate?: number;
  monthly_hours?: number;
  id_number?: string | null;
  photo_url?: string | null;
  restrict_early_start?: boolean;
  auto_checkout?: boolean;
  branch?: {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    radius_m: number;
    is_active?: boolean;
  } | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
