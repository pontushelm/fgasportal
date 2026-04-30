import { z } from "zod"

const passwordSchema = z.string()
  .min(8)
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    "Lösenord måste innehålla stor bokstav, liten bokstav och siffra")

const passwordConfirmationSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Lösenorden matchar inte",
  path: ["confirmPassword"],
})

export const normalRegisterSchema = z.object({
  companyName: z.string()
    .min(2, "Företagsnamn måste vara minst 2 tecken")
    .max(100),

  orgNumber: z.string()
    .min(10)
    .max(10)
    .regex(/^\d+$/, "Organisationsnummer får bara innehålla siffror"),

  companyEmail: z.string()
    .email("Ogiltig emailadress"),

  companyAddress: z.string().optional(),
  companyPhone: z.string().optional(),

  userName: z.string()
    .min(2)
    .max(50),

  userEmail: z.string()
    .email(),

  inviteToken: z.string().optional(),
}).and(passwordConfirmationSchema)

export const invitedRegisterSchema = z.object({
  inviteToken: z.string().min(1),
  userName: z.string()
    .min(2)
    .max(50),
  userEmail: z.string()
    .email(),
}).and(passwordConfirmationSchema)

export const registerSchema = z.union([
  invitedRegisterSchema,
  normalRegisterSchema,
])

export type RegisterFormData = z.infer<typeof registerSchema>
export type NormalRegisterData = z.infer<typeof normalRegisterSchema>
export type InvitedRegisterData = z.infer<typeof invitedRegisterSchema>

export const loginSchema = z.object({
  email: z.string()
    .email("Ogiltig emailadress")
    .min(1, "Email krävs"),

  password: z.string()
    .min(1, "Lösenord krävs")
})

export type LoginFormData = z.infer<typeof loginSchema>

const optionalRegisterField = z.string().optional()
const optionalContractorField = z.union([z.string(), z.null()])
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined
    if (val === null) return null

    const trimmedValue = val.trim()
    return trimmedValue ? trimmedValue : null
  })
const optionalDateField = z.string()
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined
    return val ? new Date(val) : null
  })
const optionalIntegerField = z.string()
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined
    return val ? parseInt(val, 10) : null
  })

const installationRegisterFieldsSchema = {
  equipmentId: optionalRegisterField,
  serialNumber: optionalRegisterField,
  propertyName: optionalRegisterField,
  propertyId: optionalContractorField,
  equipmentType: optionalRegisterField,
  operatorName: optionalRegisterField,
  hasLeakDetectionSystem: z.boolean().optional(),
  assignedContractorId: optionalContractorField,
}

export const createInstallationSchema = z.object({
  name: z.string().min(1, "Namn krävs"),
  location: z.string().min(1, "Plats krävs"),
  ...installationRegisterFieldsSchema,
  refrigerantType: z.string().min(1, "Köldmedietyp krävs"),
  refrigerantAmount: z.string().transform((val) => parseFloat(val)),
  installationDate: z.string().transform((val) => new Date(val)),
  lastInspection: optionalDateField,
  inspectionIntervalMonths: optionalIntegerField,
  notes: z.string().optional(),
})

export type CreateInstallationData = z.infer<typeof createInstallationSchema>

export const createInspectionSchema = z.object({
  inspectionDate: z.string().min(1, "Kontrolldatum krävs")
    .transform((val) => new Date(val)),
  inspectorName: z.string().min(1, "Kontrollant krävs"),
  status: z.string().min(1, "Status krävs"),
  notes: z.string().optional(),
})

export type CreateInspectionData = z.infer<typeof createInspectionSchema>

export const editInstallationSchema = z.object({
  name: z.string().min(1, "Namn krävs"),
  location: z.string().min(1, "Plats krävs"),
  ...installationRegisterFieldsSchema,
  refrigerantType: z.string().min(1, "Köldmedietyp krävs"),
  refrigerantAmount: z.string().transform((val) => parseFloat(val)),
  lastInspection: optionalDateField,
  inspectionIntervalMonths: optionalIntegerField,
  notes: z.string().optional(),
})

export type EditInstallationData = z.infer<typeof editInstallationSchema>

export const createInvitationSchema = z.object({
  email: z.string().email("Ogiltig emailadress"),
  role: z.enum(["ADMIN", "MEMBER", "CONTRACTOR"]),
})

export type CreateInvitationData = z.infer<typeof createInvitationSchema>

export const createInstallationEventSchema = z.object({
  date: z.string().min(1, "Datum krävs").transform((val) => new Date(val)),
  type: z.enum(["INSPECTION", "LEAK", "REFILL", "SERVICE"]),
  refrigerantAddedKg: z.string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : null)),
  notes: z.string().optional(),
}).refine((data) => data.type !== "LEAK" || Boolean(data.notes?.trim()), {
  message: "Anteckningar krävs för läckagehändelser",
  path: ["notes"],
}).refine((data) => data.refrigerantAddedKg === null || data.refrigerantAddedKg >= 0, {
  message: "Påfylld mängd måste vara 0 eller högre",
  path: ["refrigerantAddedKg"],
})

export type CreateInstallationEventData = z.infer<typeof createInstallationEventSchema>
