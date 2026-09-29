const patientSchema = {
  type: "object",
  required: [
    "id",
    "name",
    "age",
    "gender",
    "phone",
    "email",
    "bloodGroup",
    "disease",
    "address",
    "doctor",
    "admissionDate",
    "status",
  ],
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
    age: { type: "integer", minimum: 1, maximum: 120 },
    gender: { type: "string", enum: ["Male", "Female", "Other"] },
    phone: { type: "string" },
    email: { type: "string", format: "email" },
    bloodGroup: { type: "string" },
    disease: { type: "string" },
    address: { type: "string" },
    doctor: { type: "string" },
    admissionDate: { type: "string", format: "date" },
    status: { type: "string", enum: ["Admitted", "Discharged"] },
  },
};

const doctorSchema = {
  type: "object",
  required: [
    "id",
    "name",
    "gender",
    "specialization",
    "department",
    "phone",
    "email",
    "experience",
    "qualification",
    "consultationFee",
    "availability",
  ],
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
    gender: { type: "string", enum: ["Male", "Female", "Other"] },
    specialization: { type: "string" },
    department: { type: "string" },
    phone: { type: "string" },
    email: { type: "string", format: "email" },
    experience: { type: "integer", minimum: 0, maximum: 70 },
    qualification: { type: "string" },
    consultationFee: { type: "number", exclusiveMinimum: 0 },
    availability: { type: "string", enum: ["Available", "Unavailable"] },
  },
};

const patientInputSchema = {
  ...patientSchema,
  required: patientSchema.required.filter((field) => field !== "id"),
  properties: Object.fromEntries(
    Object.entries(patientSchema.properties).filter(
      ([field]) => field !== "id",
    ),
  ),
};
const doctorInputSchema = {
  ...doctorSchema,
  required: doctorSchema.required.filter((field) => field !== "id"),
  properties: Object.fromEntries(
    Object.entries(doctorSchema.properties).filter(([field]) => field !== "id"),
  ),
};

const errorResponse = {
  description: "Request failed",
  content: {
    "application/json": { schema: { $ref: "#/components/schemas/Error" } },
  },
};

export const openapiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Hospital Management API",
    version: "1.0.0",
    description:
      "REST API for the Hospital Management dashboard. Patient and doctor records are stored in Cloud Firestore.",
  },
  servers: [
    { url: "http://localhost:4000/api", description: "Local development API" },
  ],
  tags: [
    { name: "Health", description: "API status" },
    { name: "Dashboard", description: "Summary counts" },
    { name: "Patients", description: "Patient record management" },
    { name: "Doctors", description: "Doctor record management" },
    { name: "Appointments", description: "Doctor schedule and appointment booking" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Check API status",
        responses: {
          "200": {
            description: "API is running",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    service: { type: "string", example: "hospital-api" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/dashboard": {
      get: {
        tags: ["Dashboard"],
        summary: "Get hospital summary counts",
        responses: {
          "200": {
            description: "Dashboard summary",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    totalPatients: { type: "integer" },
                    admittedPatients: { type: "integer" },
                    dischargedPatients: { type: "integer" },
                    totalDoctors: { type: "integer" },
                    availableDoctors: { type: "integer" },
                    departments: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/patients": {
      get: {
        tags: ["Patients"],
        summary: "List and filter patients",
        parameters: [
          {
            name: "q",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Search ID, name, phone, disease, or doctor",
          },
          {
            name: "status",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["Admitted", "Discharged"] },
          },
        ],
        responses: {
          "200": {
            description: "Patient list",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Patient" },
                },
              },
            },
          },
          "500": errorResponse,
        },
      },
      post: {
        tags: ["Patients"],
        summary: "Create a patient",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PatientInput" },
            },
          },
        },
        responses: {
          "201": {
            description: "Patient created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Patient" },
              },
            },
          },
          "400": errorResponse,
        },
      },
    },
    "/patients/{id}": {
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "integer", minimum: 1 },
        },
      ],
      get: {
        tags: ["Patients"],
        summary: "Get a patient by ID",
        responses: {
          "200": {
            description: "Patient record",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Patient" },
              },
            },
          },
          "400": errorResponse,
          "404": errorResponse,
        },
      },
      put: {
        tags: ["Patients"],
        summary: "Replace a patient record",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PatientInput" },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated patient",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Patient" },
              },
            },
          },
          "400": errorResponse,
          "404": errorResponse,
        },
      },
      delete: {
        tags: ["Patients"],
        summary: "Delete a patient",
        responses: {
          "204": { description: "Patient deleted" },
          "400": errorResponse,
          "404": errorResponse,
        },
      },
    },
    "/doctors": {
      get: {
        tags: ["Doctors"],
        summary: "List and filter doctors",
        parameters: [
          {
            name: "q",
            in: "query",
            required: false,
            schema: { type: "string" },
            description:
              "Search ID, name, specialization, department, or phone",
          },
          {
            name: "availability",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["Available", "Unavailable"] },
          },
        ],
        responses: {
          "200": {
            description: "Doctor list",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Doctor" },
                },
              },
            },
          },
          "500": errorResponse,
        },
      },
      post: {
        tags: ["Doctors"],
        summary: "Create a doctor",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/DoctorInput" },
            },
          },
        },
        responses: {
          "201": {
            description: "Doctor created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Doctor" },
              },
            },
          },
          "400": errorResponse,
        },
      },
    },
    "/doctors/{id}": {
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "integer", minimum: 1 },
        },
      ],
      get: {
        tags: ["Doctors"],
        summary: "Get a doctor by ID",
        responses: {
          "200": {
            description: "Doctor record",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Doctor" },
              },
            },
          },
          "400": errorResponse,
          "404": errorResponse,
        },
      },
      put: {
        tags: ["Doctors"],
        summary: "Replace a doctor record",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/DoctorInput" },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated doctor",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Doctor" },
              },
            },
          },
          "400": errorResponse,
          "404": errorResponse,
        },
      },
      delete: {
        tags: ["Doctors"],
        summary: "Delete a doctor",
        responses: {
          "204": { description: "Doctor deleted" },
          "400": errorResponse,
          "404": errorResponse,
        },
      },
    },
    "/doctor-schedule": {
      get: { tags: ["Appointments"], summary: "Get doctor schedule", responses: { "200": { description: "Schedule", content: { "application/json": { schema: { $ref: "#/components/schemas/DoctorSchedule" } } } } } },
      put: { tags: ["Appointments"], summary: "Save doctor schedule", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/DoctorSchedule" } } } }, responses: { "200": { description: "Saved" }, "400": errorResponse } },
    },
    "/appointments/available-dates": {
      get: { tags: ["Appointments"], summary: "List scheduled dates", parameters: [{ name: "from", in: "query", schema: { type: "string", format: "date" } }], responses: { "200": { description: "Dates", content: { "application/json": { schema: { type: "array", items: { type: "string", format: "date" } } } } } } },
    },
    "/appointments/slots": {
      get: {
        tags: ["Appointments"], summary: "List slots for a date",
        parameters: [{ name: "date", in: "query", required: true, schema: { type: "string", format: "date" } }],
        responses: {
          "200": { description: "Slots", content: { "application/json": { schema: { type: "array", items: { type: "object", properties: { time: { type: "string" }, booked: { type: "boolean" } } } } } } },
        },
      },
    },
    "/appointments": {
      get: {
        tags: ["Appointments"], summary: "Search and filter appointments",
        parameters: [{ name: "q", in: "query", schema: { type: "string" } }, { name: "status", in: "query", schema: { type: "string", enum: ["All", "Booked", "Completed", "Cancelled"] } }],
        responses: { "200": { description: "Appointment list", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Appointment" } } } } } },
      },
      post: {
        tags: ["Appointments"], summary: "Book appointment", description: "Firestore transaction prevents duplicate active slots.",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/AppointmentInput" } } } },
        responses: { "201": { description: "Booked" }, "400": errorResponse, "409": errorResponse },
      },
    },
    "/appointments/{id}/status": {
      patch: {
        tags: ["Appointments"], summary: "Update appointment status",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["Booked", "Completed", "Cancelled"] } } } } } },
        responses: { "200": { description: "Updated" }, "404": errorResponse },
      },
    },
  },
  components: {
    schemas: {
      Patient: patientSchema,
      PatientInput: patientInputSchema,
      Doctor: doctorSchema,
      DoctorInput: doctorInputSchema,
      DoctorSchedule: {
        type: "object", required: ["availableDays", "timeFrom", "timeTo", "slotDuration"],
        properties: {
          availableDays: { type: "array", minItems: 1, items: { type: "string", enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] } },
          timeFrom: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$", example: "09:00" },
          timeTo: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$", example: "12:00" },
          slotDuration: { type: "integer", enum: [15, 30, 45, 60], default: 30 },
        },
      },
      Appointment: {
        type: "object", required: ["id", "patientName", "age", "gender", "phone", "email", "bloodGroup", "problem", "appointmentDate", "appointmentTime", "status", "createdAt"],
        properties: {
          id: { type: "string", format: "uuid" }, patientName: { type: "string" }, age: { type: "integer" },
          gender: { type: "string", enum: ["Male", "Female", "Other"] }, phone: { type: "string" }, email: { type: "string", format: "email" },
          bloodGroup: { type: "string" }, problem: { type: "string" }, appointmentDate: { type: "string", format: "date" },
          appointmentTime: { type: "string", example: "09:00" }, status: { type: "string", enum: ["Booked", "Completed", "Cancelled"] }, createdAt: { type: "string", format: "date-time" },
        },
      },
      AppointmentInput: {
        type: "object", required: ["patientName", "age", "gender", "phone", "email", "bloodGroup", "problem", "appointmentDate", "appointmentTime"],
        properties: {
          patientName: { type: "string" }, age: { type: "integer", minimum: 1, maximum: 120 },
          gender: { type: "string", enum: ["Male", "Female", "Other"] }, phone: { type: "string" }, email: { type: "string", format: "email" },
          bloodGroup: { type: "string" }, problem: { type: "string" }, appointmentDate: { type: "string", format: "date" }, appointmentTime: { type: "string", example: "09:00" },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
          details: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};
