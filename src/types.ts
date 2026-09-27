export type Gender = 'Male' | 'Female' | 'Other';
export type PatientStatus = 'Admitted' | 'Discharged';
export type Availability = 'Available' | 'Unavailable';

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
