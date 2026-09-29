import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { Appointment, Doctor, DoctorSchedule, Patient } from "./types.js";

export interface Database {
  patients: Patient[];
  doctors: Doctor[];
  doctorSchedule?: DoctorSchedule | null;
  appointments?: Appointment[];
}

function getDatabaseDocument() {
  if (getApps().length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const credential = serviceAccountJson
      ? cert(JSON.parse(serviceAccountJson) as Parameters<typeof cert>[0])
      : applicationDefault();

    initializeApp({
      credential,
      ...(projectId ? { projectId } : {}),
    });
  }

  return getFirestore().collection("hospital").doc("state");
}

export async function checkDatabaseConnection(): Promise<void> {
  await getDatabaseDocument().get();
}

export async function readDatabase(): Promise<Database> {
  const document = getDatabaseDocument();
  return getFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(document);
    if (snapshot.exists) return snapshot.data() as Database;

    const initial: Database = { patients: [], doctors: [] };
    transaction.set(document, initial);
    return initial;
  });
}

export async function writeDatabase(database: Database): Promise<void> {
  await getDatabaseDocument().set(database);
}

/** Run a read/modify/write operation with Firestore's cross-instance transaction lock. */
export async function transactDatabase<T>(
  operation: (database: Database) => T,
): Promise<T> {
  const document = getDatabaseDocument();
  return getFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(document);
    const database = snapshot.exists
      ? (snapshot.data() as Database)
      : { patients: [], doctors: [] };
    database.appointments ??= [];
    const result = operation(database);
    transaction.set(document, database);
    return result;
  });
}
