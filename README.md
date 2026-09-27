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
```

Set `FIREBASE_SERVICE_ACCOUNT_JSON` to the complete one-line JSON from the service-account key file. Alternatively, omit it when running on Google Cloud with Application Default Credentials configured; `FIREBASE_PROJECT_ID` may still be needed in that environment. The API creates an empty `hospital/state` document on first use. Existing documents are left intact.

The API currently stores both arrays in that single Firestore document to preserve its existing read/modify/write behavior. For multiple API instances receiving simultaneous writes, move to per-record documents and Firestore transactions before scaling out.

The API listens on `http://localhost:4000` by default. Set `PORT` to change the port. Patient and doctor records are stored in Firestore.

Interactive Swagger documentation is available at `http://localhost:4000/api-docs`; the raw OpenAPI document is at `http://localhost:4000/api/openapi.json`.

## Endpoints

- `GET /api/health`
- `GET /api/dashboard`
- `GET /api/patients`, `GET /api/patients/:id`
- `POST /api/patients`, `PUT /api/patients/:id`, `DELETE /api/patients/:id`
- `GET /api/doctors`, `GET /api/doctors/:id`
- `POST /api/doctors`, `PUT /api/doctors/:id`, `DELETE /api/doctors/:id`

List endpoints return arrays. Optional query parameters: patients accept `q` and `status`; doctors accept `q` and `availability`. Create and update bodies match the frontend `PatientInput` and `DoctorInput` types. Validation errors return HTTP 400 with `{ "error": "...", "details": [...] }`.

The API is ready for the frontend service layer to call; the current frontend still uses its in-memory mock service functions.
