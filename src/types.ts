export type Gender = 'Male' | 'Female' | 'Other';
export type PatientStatus = 'Admitted' | 'Discharged';
export type Availability = 'Available' | 'Unavailable';
export type AppointmentStatus = 'Booked' | 'Completed' | 'Cancelled';
export type DayOfWeek =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export interface DoctorSchedule {
  availableDays: DayOfWeek[];
  timeFrom: string;
  timeTo: string;
  slotDuration: 15 | 30 | 45 | 60;
}

export interface Appointment {
  id: string;
  patientName: string;
  age: number;
  gender: Gender;
  phone: string;
  email: string;
  bloodGroup: string;
  problem: string;
  appointmentDate: string;
  appointmentTime: string;
  status: AppointmentStatus;
  createdAt: string;
}

export interface Patient {
  id: number;
  name: string;
  age: number;
  gender: Gender;
  phone: string;
  email: string;
  bloodGroup: string;
  disease: string;
  address: string;
  doctor: string;
  admissionDate: string;
  status: PatientStatus;
}

export interface Doctor {
  id: number;
  name: string;
  gender: Gender;
  specialization: string;
  department: string;
  phone: string;
  email: string;
  experience: number;
  qualification: string;
  consultationFee: number;
  availability: Availability;
}

export type PatientInput = Omit<Patient, 'id'>;
export type DoctorInput = Omit<Doctor, 'id'>;
