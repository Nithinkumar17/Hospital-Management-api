# Hospital Management API

REST API for the companion `Hospital_web` dashboard. It exposes the same patient and doctor fields as the frontend.

## Run

```sh
npm install
npm run dev
```

## Firebase / Firestore setup

This backend uses the Firebase Admin SDK and Cloud Firestore. In the Firebase console, create a Firebase project and enable its Firestore database. Create a service account key under **Project settings → Service accounts → Generate new private key**. Keep the downloaded key private and never commit it.

Create a `.env` file in this directory (it is ignored by Git):

```env
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
AUTH_TOKEN_SECRET=replace-with-a-long-random-secret
HOSPITAL_STAFF_EMAIL=staff@example.com
HOSPITAL_STAFF_PASSWORD=replace-with-a-strong-password
DOCTOR_LOGIN_EMAIL=doctor@example.com
DOCTOR_LOGIN_PASSWORD=replace-with-a-strong-password
```

Set `FIREBASE_SERVICE_ACCOUNT_JSON` to the complete one-line JSON from the service-account key file. Alternatively, omit it when running on Google Cloud with Application Default Credentials configured; `FIREBASE_PROJECT_ID` may still be needed in that environment. The API creates an empty `hospital/state` document on first use. Existing documents are left intact.

The API stores patients, doctors, the single doctor's schedule, and appointments in the existing `hospital/state` Firestore document. Appointment booking uses a Firestore transaction to reject duplicate active date/time slots, including requests racing across API instances. Cancelled appointments release their slot.

The API listens on `http://localhost:4000` by default. Set `PORT` to change the port. Patient and doctor records are stored in Firestore.

Set the login values above before starting the API. The frontend offers Hospital staff and Doctor sign-in. Sessions expire after eight hours. Hospital staff can manage patient records, doctors, and appointments; doctors can view patient records. Doctors can update the schedule and availability, while staff can view the schedule read-only. The public dashboard returns aggregate counts only, and patient booking endpoints expose bookable dates and slots without the schedule-management endpoint. Do not commit real credentials or the token secret.

Patient record and hospital management routes require a staff bearer token. Doctor schedule read/write and availability changes require a doctor bearer token. These permissions are enforced by the API as well as the frontend.

Interactive Swagger documentation is available at `http://localhost:4000/api-docs`; the raw OpenAPI document is at `http://localhost:4000/api/openapi.json`.

## Endpoints

- `POST /api/auth/login` (returns an eight-hour bearer token)
- `GET /api/health`
- `GET /api/dashboard`
- `GET /api/patients`, `GET /api/patients/:id`
- `POST /api/patients`, `PUT /api/patients/:id`, `DELETE /api/patients/:id`
- `GET /api/doctors`, `GET /api/doctors/:id`
- `POST /api/doctors`, `PUT /api/doctors/:id`, `DELETE /api/doctors/:id`
- `GET /api/doctor-schedule`, `PUT /api/doctor-schedule`
- `GET /api/appointments/available-dates?from=YYYY-MM-DD`
- `GET /api/appointments/slots?date=YYYY-MM-DD`
- `GET /api/appointments` (optional `q` and `status` filters)
- `POST /api/appointments`
- `PATCH /api/appointments/:id/status`

List endpoints return arrays. Optional query parameters: patients accept `q` and `status`; doctors accept `q` and `availability`. Create and update bodies match the frontend `PatientInput` and `DoctorInput` types. Validation errors return HTTP 400 with `{ "error": "...", "details": [...] }`.

The API is ready for the frontend service layer to call; the current frontend still uses its in-memory mock service functions.

Schedule times and appointment times use 24-hour `HH:mm` strings. Schedule writes accept `availableDays` (weekday names), `timeFrom`, `timeTo`, and `slotDuration` (15, 30, 45, or 60). Appointment requests contain patient details, `appointmentDate` (`YYYY-MM-DD`) and `appointmentTime` (`HH:mm`); the server creates the ID, `Booked` status, and timestamp. `/slots` returns entries like `{ "time": "09:00", "booked": false }`. Booking rejects unavailable doctors, past dates, dates/times outside the configured schedule, and already-booked slots with HTTP 409 for conflicts.
