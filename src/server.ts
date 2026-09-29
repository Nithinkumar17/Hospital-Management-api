import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import swaggerUi from "swagger-ui-express";
import { openapiDocument } from "./openapi.js";
import {
  checkDatabaseConnection,
  readDatabase,
  transactDatabase,
  type Database,
} from "./store.js";
import type { Doctor, DoctorInput, Patient, PatientInput } from "./types.js";
import type { Appointment, AppointmentStatus, DoctorSchedule } from "./types.js";
import {
  dayForDate,
  generateTimeSlots,
  getAvailableDates,
  isValidDate,
  validateSchedule,
} from "./scheduling.js";

dotenv.config({ path: [".env.local", ".env"] });

const app = express();
const port = Number(process.env.PORT ?? 4000);

// API responses must reflect the latest Firestore state. Disable Express ETags
// and instruct browsers and intermediate caches not to store API responses.
app.set("etag", false);
app.use("/api", (_req, res, next) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
  });
  next();
});

app.use(
  cors({
    origin: [/^http:\/\/(localhost|127\.0\.0\.1):\d+$/],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(openapiDocument, { explorer: true }),
);
app.get("/api/openapi.json", (_req, res) => res.json(openapiDocument));

let writeQueue: Promise<void> = Promise.resolve();
async function mutate<T>(
  operation: (database: Database) => T | Promise<T>,
): Promise<T> {
  let result!: T;
  const current = writeQueue.then(async () => {
    result = await transactDatabase(operation);
  });
  writeQueue = current.catch(() => undefined);
  await current;
  return result;
}

function fail(
  res: Response,
  status: number,
  message: string,
  details?: string[],
) {
  return res
    .status(status)
    .json({ error: message, ...(details?.length ? { details } : {}) });
}

function requiredFields(
  body: Record<string, unknown>,
  fields: string[],
): string[] {
  return fields
    .filter(
      (field) => typeof body[field] !== "string" || !String(body[field]).trim(),
    )
    .map((field) => `${field} is required`);
}

function validGender(value: unknown): value is Patient["gender"] {
  return value === "Male" || value === "Female" || value === "Other";
}

function validatePatient(body: Record<string, unknown>): string[] {
  const issues = requiredFields(body, [
    "name",
    "phone",
    "email",
    "bloodGroup",
    "disease",
    "address",
    "doctor",
    "admissionDate",
  ]);
  if (
    !Number.isInteger(body.age) ||
    Number(body.age) < 1 ||
    Number(body.age) > 120
  )
    issues.push("age must be an integer between 1 and 120");
  if (!validGender(body.gender))
    issues.push("gender must be Male, Female, or Other");
  if (typeof body.email === "string" && !/^\S+@\S+\.\S+$/.test(body.email))
    issues.push("email must be valid");
  if (body.status !== "Admitted" && body.status !== "Discharged")
    issues.push("status must be Admitted or Discharged");
  if (
    typeof body.admissionDate === "string" &&
    !/^\d{4}-\d{2}-\d{2}$/.test(body.admissionDate)
  )
    issues.push("admissionDate must use YYYY-MM-DD");
  return issues;
}

function validateDoctor(body: Record<string, unknown>): string[] {
  const issues = requiredFields(body, [
    "name",
    "specialization",
    "department",
    "phone",
    "email",
    "qualification",
  ]);
  if (!validGender(body.gender))
    issues.push("gender must be Male, Female, or Other");
  if (typeof body.email === "string" && !/^\S+@\S+\.\S+$/.test(body.email))
    issues.push("email must be valid");
  if (
    !Number.isInteger(body.experience) ||
    Number(body.experience) < 0 ||
    Number(body.experience) > 70
  )
    issues.push("experience must be an integer between 0 and 70");
  if (
    typeof body.consultationFee !== "number" ||
    !Number.isFinite(body.consultationFee) ||
    body.consultationFee <= 0
  )
    issues.push("consultationFee must be greater than zero");
  if (body.availability !== "Available" && body.availability !== "Unavailable")
    issues.push("availability must be Available or Unavailable");
  return issues;
}

function numericId(value: string): number | undefined {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

app.get("/api/health", async (_req, res, next) => {
  try {
    await checkDatabaseConnection();
    return res.json({
      status: "ok",
      service: "hospital-api",
      database: "connected",
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/dashboard", async (_req, res, next) => {
  try {
    const { patients, doctors } = await readDatabase();
    res.json({
      totalPatients: patients.length,
      admittedPatients: patients.filter(
        (patient) => patient.status === "Admitted",
      ).length,
      dischargedPatients: patients.filter(
        (patient) => patient.status === "Discharged",
      ).length,
      totalDoctors: doctors.length,
      availableDoctors: doctors.filter(
        (doctor) => doctor.availability === "Available",
      ).length,
      departments: new Set(doctors.map((doctor) => doctor.department)).size,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/patients", async (req, res, next) => {
  try {
    const { patients } = await readDatabase();
    const status = req.query.status;
    const q = typeof req.query.q === "string" ? req.query.q.toLowerCase() : "";
    const result = patients.filter(
      (patient) =>
        (!status || status === "All patients" || patient.status === status) &&
        (!q ||
          `${patient.id} ${patient.name} ${patient.phone} ${patient.disease} ${patient.doctor}`
            .toLowerCase()
            .includes(q)),
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/patients/:id", async (req, res, next) => {
  try {
    const id = numericId(req.params.id);
    if (!id) return fail(res, 400, "Patient id must be a positive integer");
    const patient = (await readDatabase()).patients.find(
      (row) => row.id === id,
    );
    return patient ? res.json(patient) : fail(res, 404, "Patient not found");
  } catch (error) {
    next(error);
  }
});

app.post("/api/patients", async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const issues = validatePatient(body);
    if (issues.length) return fail(res, 400, "Invalid patient record", issues);
    const patient = await mutate((database) => {
      const created: Patient = {
        ...(body as unknown as PatientInput),
        id: Math.max(1000, ...database.patients.map((row) => row.id)) + 1,
      };
      database.patients.push(created);
      return created;
    });
    return res.status(201).json(patient);
  } catch (error) {
    next(error);
  }
});

app.put("/api/patients/:id", async (req, res, next) => {
  try {
    const id = numericId(req.params.id);
    if (!id) return fail(res, 400, "Patient id must be a positive integer");
    const body = req.body as Record<string, unknown>;
    const issues = validatePatient(body);
    if (issues.length) return fail(res, 400, "Invalid patient record", issues);
    const result = await mutate((database) => {
      const index = database.patients.findIndex((row) => row.id === id);
      if (index < 0) return undefined;
      database.patients[index] = { ...(body as unknown as PatientInput), id };
      return database.patients[index];
    });
    return result ? res.json(result) : fail(res, 404, "Patient not found");
  } catch (error) {
    next(error);
  }
});

app.delete("/api/patients/:id", async (req, res, next) => {
  try {
    const id = numericId(req.params.id);
    if (!id) return fail(res, 400, "Patient id must be a positive integer");
    const deleted = await mutate((database) => {
      const index = database.patients.findIndex((row) => row.id === id);
      if (index < 0) return false;
      database.patients.splice(index, 1);
      return true;
    });
    return deleted
      ? res.status(204).end()
      : fail(res, 404, "Patient not found");
  } catch (error) {
    next(error);
  }
});

app.get("/api/doctors", async (req, res, next) => {
  try {
    const { doctors } = await readDatabase();
    const availability = req.query.availability;
    const q = typeof req.query.q === "string" ? req.query.q.toLowerCase() : "";
    const result = doctors.filter(
      (doctor) =>
        (!availability ||
          availability === "All doctors" ||
          doctor.availability === availability) &&
        (!q ||
          `${doctor.id} ${doctor.name} ${doctor.specialization} ${doctor.department} ${doctor.phone}`
            .toLowerCase()
            .includes(q)),
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/doctors/:id", async (req, res, next) => {
  try {
    const id = numericId(req.params.id);
    if (!id) return fail(res, 400, "Doctor id must be a positive integer");
    const doctor = (await readDatabase()).doctors.find((row) => row.id === id);
    return doctor ? res.json(doctor) : fail(res, 404, "Doctor not found");
  } catch (error) {
    next(error);
  }
});

app.post("/api/doctors", async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const issues = validateDoctor(body);
    if (issues.length) return fail(res, 400, "Invalid doctor record", issues);
    const doctor = await mutate((database) => {
      const created: Doctor = {
        ...(body as unknown as DoctorInput),
        id: Math.max(200, ...database.doctors.map((row) => row.id)) + 1,
      };
      database.doctors.push(created);
      return created;
    });
    return res.status(201).json(doctor);
  } catch (error) {
    next(error);
  }
});

app.put("/api/doctors/:id", async (req, res, next) => {
  try {
    const id = numericId(req.params.id);
    if (!id) return fail(res, 400, "Doctor id must be a positive integer");
    const body = req.body as Record<string, unknown>;
    const issues = validateDoctor(body);
    if (issues.length) return fail(res, 400, "Invalid doctor record", issues);
    const result = await mutate((database) => {
      const index = database.doctors.findIndex((row) => row.id === id);
      if (index < 0) return undefined;
      database.doctors[index] = { ...(body as unknown as DoctorInput), id };
      return database.doctors[index];
    });
    return result ? res.json(result) : fail(res, 404, "Doctor not found");
  } catch (error) {
    next(error);
  }
});

app.delete("/api/doctors/:id", async (req, res, next) => {
  try {
    const id = numericId(req.params.id);
    if (!id) return fail(res, 400, "Doctor id must be a positive integer");
    const deleted = await mutate((database) => {
      const index = database.doctors.findIndex((row) => row.id === id);
      if (index < 0) return false;
      database.doctors.splice(index, 1);
      return true;
    });
    return deleted ? res.status(204).end() : fail(res, 404, "Doctor not found");
  } catch (error) {
    next(error);
  }
});

const emptySchedule: DoctorSchedule = {
  availableDays: [], timeFrom: "09:00", timeTo: "17:00", slotDuration: 30,
};
const appointmentStatuses: AppointmentStatus[] = ["Booked", "Completed", "Cancelled"];
const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function currentDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function doctorCanBook(database: Database): boolean {
  return database.doctors.length > 0 && database.doctors[0].availability === "Available";
}

app.get("/api/doctor-schedule", async (_req, res, next) => {
  try {
    const database = await readDatabase();
    res.json(database.doctorSchedule ?? emptySchedule);
  } catch (error) { next(error); }
});

app.put("/api/doctor-schedule", async (req, res, next) => {
  try {
    const issues = validateSchedule(req.body);
    if (issues.length) return fail(res, 400, "Invalid doctor schedule", issues);
    const schedule = req.body as DoctorSchedule;
    await mutate((database) => { database.doctorSchedule = schedule; });
    return res.json({ message: "Schedule updated successfully", schedule });
  } catch (error) { next(error); }
});

app.get("/api/appointments/available-dates", async (req, res, next) => {
  try {
    const database = await readDatabase();
    if (!doctorCanBook(database)) return fail(res, 409, "Doctor is currently unavailable for appointments.");
    const schedule = database.doctorSchedule;
    if (!schedule || validateSchedule(schedule).length) return res.json([]);
    const from = typeof req.query.from === "string" ? req.query.from : currentDate();
    if (!isValidDate(from)) return fail(res, 400, "from must use YYYY-MM-DD");
    return res.json(getAvailableDates(schedule, from < currentDate() ? currentDate() : from));
  } catch (error) { next(error); }
});

app.get("/api/appointments/slots", async (req, res, next) => {
  try {
    const date = typeof req.query.date === "string" ? req.query.date : "";
    if (!isValidDate(date)) return fail(res, 400, "date must use YYYY-MM-DD");
    if (date < currentDate()) return fail(res, 400, "Past appointment dates are not allowed");
    const database = await readDatabase();
    if (!doctorCanBook(database)) return fail(res, 409, "Doctor is currently unavailable for appointments.");
    const schedule = database.doctorSchedule;
    if (!schedule || validateSchedule(schedule).length || !schedule.availableDays.includes(dayForDate(date)!)) return res.json([]);
    const taken = new Set((database.appointments ?? [])
      .filter((item) => item.appointmentDate === date && item.status !== "Cancelled")
      .map((item) => item.appointmentTime));
    return res.json(generateTimeSlots(schedule.timeFrom, schedule.timeTo, schedule.slotDuration)
      .map((time) => ({ time, booked: taken.has(time) })));
  } catch (error) { next(error); }
});

app.get("/api/appointments", async (req, res, next) => {
  try {
    const database = await readDatabase();
    const status = req.query.status;
    if (status && status !== "All" && !appointmentStatuses.includes(status as AppointmentStatus))
      return fail(res, 400, "status must be All, Booked, Completed, or Cancelled");
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const appointments = (database.appointments ?? []).filter((item) =>
      (!status || status === "All" || item.status === status) &&
      (!q || `${item.id} ${item.patientName} ${item.phone}`.toLowerCase().includes(q)))
      .sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate) || a.appointmentTime.localeCompare(b.appointmentTime));
    return res.json(appointments);
  } catch (error) { next(error); }
});

app.post("/api/appointments", async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const issues = requiredFields(body, ["patientName", "phone", "email", "bloodGroup", "problem", "appointmentDate", "appointmentTime"]);
    if (!Number.isInteger(body.age) || Number(body.age) < 1 || Number(body.age) > 120) issues.push("age must be an integer between 1 and 120");
    if (!validGender(body.gender)) issues.push("gender must be Male, Female, or Other");
    if (typeof body.email === "string" && !/^\S+@\S+\.\S+$/.test(body.email)) issues.push("email must be valid");
    if (typeof body.bloodGroup === "string" && !bloodGroups.includes(body.bloodGroup)) issues.push("bloodGroup must be a supported blood group");
    if (typeof body.appointmentDate !== "string" || !isValidDate(body.appointmentDate)) issues.push("appointmentDate must use YYYY-MM-DD");
    if (typeof body.appointmentTime !== "string" || !/^\d{2}:\d{2}$/.test(body.appointmentTime)) issues.push("appointmentTime must use HH:mm");
    if (issues.length) return fail(res, 400, "Invalid appointment", issues);

    const appointment = await transactDatabase((database) => {
      if (!doctorCanBook(database)) throw Object.assign(new Error("Doctor is currently unavailable for appointments."), { status: 409 });
      const schedule = database.doctorSchedule;
      if (!schedule || validateSchedule(schedule).length) throw Object.assign(new Error("Doctor schedule is not configured"), { status: 409 });
      const date = body.appointmentDate as string;
      const time = body.appointmentTime as string;
      if (date < currentDate()) throw Object.assign(new Error("Past appointment dates are not allowed"), { status: 400 });
      const allowedSlots = generateTimeSlots(schedule.timeFrom, schedule.timeTo, schedule.slotDuration);
      if (!schedule.availableDays.includes(dayForDate(date)!) || !allowedSlots.includes(time))
        throw Object.assign(new Error("Selected date or time is outside the doctor's schedule"), { status: 400 });
      database.appointments ??= [];
      if (database.appointments.some((item) => item.appointmentDate === date && item.appointmentTime === time && item.status !== "Cancelled"))
        throw Object.assign(new Error("This appointment slot has already been booked. Please select another available time."), { status: 409, code: "SLOT_TAKEN" });
      const created: Appointment = {
        id: randomUUID(), patientName: String(body.patientName).trim(), age: Number(body.age),
        gender: body.gender as Appointment["gender"], phone: String(body.phone).trim(),
        email: String(body.email).trim(), bloodGroup: String(body.bloodGroup).trim(),
        problem: String(body.problem).trim(), appointmentDate: date, appointmentTime: time,
        status: "Booked", createdAt: new Date().toISOString(),
      };
      database.appointments.push(created);
      return created;
    });
    return res.status(201).json(appointment);
  } catch (error) {
    if (typeof error === "object" && error !== null && "status" in error) {
      const problem = error as { status: number; message: string; code?: string };
      return fail(res, problem.status, problem.message, problem.code === "SLOT_TAKEN" ? ["This appointment slot has already been booked. Please select another available time."] : undefined);
    }
    return next(error);
  }
});

app.patch("/api/appointments/:id/status", async (req, res, next) => {
  try {
    const status = (req.body as Record<string, unknown>).status;
    if (!appointmentStatuses.includes(status as AppointmentStatus)) return fail(res, 400, "status must be Booked, Completed, or Cancelled");
    const updated = await mutate((database) => {
      const appointment = (database.appointments ?? []).find((item) => item.id === req.params.id);
      if (!appointment) return undefined;
      appointment.status = status as AppointmentStatus;
      return appointment;
    });
    return updated ? res.json(updated) : fail(res, 404, "Appointment not found");
  } catch (error) { next(error); }
});

app.use((_req, res) => fail(res, 404, "Route not found"));
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
  if (
    code === 14 ||
    code === 4 ||
    code === "UNAVAILABLE" ||
    code === "DEADLINE_EXCEEDED"
  ) {
    console.warn("Firestore is temporarily unavailable.");
    res.set("Retry-After", "3");
    return fail(
      res,
      503,
      "Hospital database is temporarily unavailable. Please retry shortly.",
    );
  }
  console.error(error);
  return fail(res, 500, "Internal server error");
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Hospital API listening at http://localhost:${port}`);
});
