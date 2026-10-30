export interface Branch {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  radius_m: number;
  is_active: boolean;
}

export interface Shift {
  id: string;
  branch_id: string;
  name: string;
  start_time: string;
  end_time: string;
  check_type: 'gps' | 'qr';
  overtime_enabled: boolean;
  overtime_limit_hours: number;
  lunch_deduction_minutes: number;
  is_active: boolean;
  branch?: Branch;
}

export interface RotaItem {
  id: string;
  assignment_id?: string;
  shift_id: string;
  user_id?: string;
  start_date: string;
  end_date: string | null;
  excluded_dates?: string[];
  days_of_week?: number[] | null;
  shift: Shift;
}
