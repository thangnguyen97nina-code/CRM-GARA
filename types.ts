export enum UserRole {
  ADMIN = 'ADMIN',
  ADVISOR = 'ADVISOR',
  TECHNICIAN = 'TECHNICIAN'
}

export enum VehicleStatus {
  INTAKE = 'Tiếp nhận & Kiểm tra',
  EXECUTING = 'Kỹ thuật thi công',
  TECH_CHECK = 'Kiểm tra kỹ thuật cuối',
  HANDOVER = 'Bàn giao & Quyết toán',
  COMPLETED = 'Đã hoàn thành'
}

export interface ServiceItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  status: 'PENDING' | 'EXECUTING' | 'DONE'; // Upgraded checklist capability
  timestamp?: string; // Checklist timestamp tracking
  isDone?: boolean; // Keep for backward compatibility
}

export interface UserAccount {
  id: string;
  username: string; // Used for email/username login
  password?: string;
  name: string;
  role: UserRole;
  allowedStages: VehicleStatus[];
}

export interface VehicleImages {
  front?: string;
  rear?: string;
  left?: string;
  right?: string;
  interior?: string;
  engine?: string;
}

export interface IntakeForm {
  id: string;
  orderCode: string; // e.g., GR202600001 (generated sequentially)
  createdAt: string;
  advisorId: string;
  status: VehicleStatus;
  
  // Vehicle Info
  plateNumber: string;
  brand: string;
  color: string;
  modelYear: string;
  carName: string;
  vin: string;
  odometer: string; // current_km
  inspectionExpiry: string;
  dateIn: string;
  dateOut: string;
  
  // Customer Info
  customerName: string;
  customerNamePrinted: string;
  gender: 'Nam' | 'Nữ' | '';
  company: string;
  phone: string;
  email: string;
  address: string;
  district: string;
  city: string;
  birthday: string;
  source: string;
  salesPerson: string;
  
  // Services
  services: string[]; // List of checkbox services initial
  detailedServices: ServiceItem[]; // Concrete itemized proposal
  otherRequests: string;
  
  // Inspections & Surveys
  interiorSurvey: Record<string, string>;
  condition: Record<string, string>;
  fuelLevel: number;
  techNotes: string; // Tech journal notes
  
  // Finances
  discount: number;
  tax: number;
  totalAmount: number;
  
  // Vehicle Images
  vehicleImages?: VehicleImages;
  
  // Customer Signatures
  intakeSignature: string | null;
  handoverSignature: string | null;
  advisorSignature?: string | null; // Signature of service advisor
  advisorName: string;
}

// Relational Structures for Supabase mappings
export interface DBCustomer {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  address?: string;
  created_at?: string;
}

export interface DBVehicle {
  id: string;
  customer_id: string;
  license_plate: string;
  vehicle_brand: string;
  vehicle_model: string;
  vehicle_year?: string;
  vin?: string;
  current_km: number;
  created_at?: string;
}

export interface DBServiceOrder {
  id: string;
  order_code: string;
  customer_id: string;
  vehicle_id: string;
  advisor_id: string;
  status: string;
  received_date: string;
  expected_delivery?: string;
  completed_date?: string;
  total_amount: number;
  created_at?: string;
}
