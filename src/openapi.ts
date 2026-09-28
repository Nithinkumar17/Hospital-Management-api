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
  },
  components: {
    schemas: {
      Patient: patientSchema,
      PatientInput: patientInputSchema,
      Doctor: doctorSchema,
      DoctorInput: doctorInputSchema,
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
