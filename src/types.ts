export interface Farm {
  id: string;
  name: string;
  location: string;
  ownerUid: string;
  createdAt: number;
}

export interface Transaction {
  id: string;
  farmId: string;
  type: 'INCOME' | 'EXPENSE' | 'CAPITAL_INFLOW';
  amount: number;
  category: string;
  subCategory?: string;
  partyId?: string;
  batchId?: string;
  accountId?: string;
  paymentMethod: string;
  dateBS: string;
  notes?: string;
  createdAt?: number;
  createdBy?: string;
}

export interface InventoryItem {
  id: string;
  farmId: string;
  itemName: string;
  category: string;
  subCategory?: string;
  currentStock: number;
  unit: string;
  minThreshold: number;
  expiryDateBS?: string;
  unitPrice?: number;
}

export interface Category {
  id: string;
  farmId: string;
  name: string;
  type: 'INCOME' | 'EXPENSE' | 'INVENTORY';
}

export interface Party {
  id: string;
  farmId: string;
  name: string;
  type: 'BUYER' | 'SUPPLIER';
  phone: string;
  address?: string;
  email?: string;
  photoUrl?: string;
  panVat?: string;
  pendingBalance: number;
}

export interface Partner {
  id: string;
  farmId: string;
  name: string;
  investmentAmount: number;
  profitSharePercentage: number;
  phone: string;
  address?: string;
  email?: string;
  photoUrl?: string;
  joiningDateBS: string;
  dividendPayable: number;
}

export interface Batch {
  id: string;
  farmId: string;
  batchName: string;
  type: 'CROP' | 'LIVESTOCK';
  startDateBS: string;
  status: 'ACTIVE' | 'COMPLETED';
  totalExpense: number;
  totalIncome: number;
}

export interface Lease {
  id: string;
  farmId: string;
  title: string;
  area: string;
  ponds: number;
  lessorName: string;
  lessorPhone: string;
  startDateBS: string;
  endDateBS: string;
  totalAmount: number;
  paidAmount: number;
  documentUrl?: string;
}

export interface Employee {
  id: string;
  farmId: string;
  name: string;
  role: string;
  type: 'PERMANENT' | 'DAILY_WAGE';
  rate: number;
  joinDateBS: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Attendance {
  id: string;
  farmId: string;
  employeeId: string;
  dateBS: string;
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY';
}

export interface Task {
  id: string;
  farmId: string;
  title: string;
  description?: string;
  category: string;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  assigneeId?: string;
  assignedWorker?: string;
  dueDateBS: string;
  dueTime?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED';
  createdAt?: number;
  updatedAt?: number;
}

export interface GalleryItem {
  id: string;
  farmId: string;
  title: string;
  category: string;
  vendorName?: string;
  dateBS: string;
  amount?: number;
  fileUrl: string;
  fileName: string;
  fileType: 'image' | 'pdf' | string;
  fileSize?: number;
  storagePath?: string;
  notes?: string;
  createdAt: number;
  createdBy?: string;
}

export interface BankAccount {
  id: string;
  farmId: string;
  name: string;
  type: 'CASH' | 'BANK' | 'WALLET';
  accountNumber?: string;
  bankName?: string;
  initialBalance: number;
  currentBalance: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: number;
}

export interface Transfer {
  id: string;
  farmId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  fee: number;
  dateBS: string;
  reference?: string;
  notes?: string;
  createdAt: number;
}

export interface GeneralSettings {
  farmId: string;
  logoUrl?: string;
  farmName: string;
  address: string;
  panNumber: string;
  email: string;
  phone: string;
  photoUrl?: string;
  regNumber: string;
  currencyFormat: 'SOUTH_ASIAN' | 'INTERNATIONAL';
  currencySymbol: string;
  calendarType: 'BS' | 'AD';
}

export interface FarmProfileSettings {
  farmName: string;
  address: string;
  panNumber: string;
  email: string;
  phone: string;
  photoUrl?: string;
  regNumber: string;
  currencyFormat: 'SOUTH_ASIAN' | 'INTERNATIONAL';
  currencySymbol: string;
  calendarType: 'BS' | 'AD';
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  role: 'ADMIN' | 'MANAGER' | 'ACCOUNTANT' | 'STAFF' | 'WORKER';
  status?: 'ACTIVE' | 'INACTIVE';
  farmId: string;
  languagePref: 'en' | 'ne';
  createdAt?: number;
  createdBy?: string;
}

export interface PartnerContribution {
  id: string;
  farmId: string;
  partnerId: string;
  partnerName: string;
  amount: number;
  dateBS: string;
  targetAccountId: string;
  paymentMethod: string;
  notes: string;
  transactionId?: string;
  createdAt: number;
  createdBy?: string;
}

export interface SubCategory {
  id: string;
  farmId: string;
  categoryId: string;
  name: string;
}
