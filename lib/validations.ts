import { z } from "zod"
import { normalizeSwedishOrgNumber } from "@/lib/org-number"

export const passwordSchema = z.string()
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
    .transform((value) => normalizeSwedishOrgNumber(value))
    .refine((value) => /^\d{10}$/.test(value), {
      message: "Organisationsnummer måste innehålla exakt 10 siffror",
    }),

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

export const forgotPasswordSchema = z.object({
  email: z.string().email("Ogiltig emailadress"),
})

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
}).and(passwordConfirmationSchema)

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>

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
const optionalTextField = z.string()
  .optional()
  .transform((val) => val?.trim() ?? "")

const nullableInstallationDateSchema = z.union([z.string(), z.null(), z.undefined()])
  .transform((val) => {
    if (val === undefined) return undefined
    if (val === null) return null

    const trimmedValue = val.trim()
    return trimmedValue ? new Date(trimmedValue) : null
  })
  .refine((date) => date == null || date >= new Date("1950-01-01"), {
    message: "Driftsättningsdatum är för långt bakåt i tiden",
  })
  .refine((date) => {
    if (date == null) return true
    const maxDate = new Date()
    maxDate.setFullYear(maxDate.getFullYear() + 1)
    return date <= maxDate
  }, {
    message: "Driftsättningsdatum ligger för långt fram i tiden",
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
  assignedServicePartnerCompanyId: optionalContractorField,
}

export const createInstallationSchema = z.object({
  name: z.string().min(1, "Namn krävs"),
  location: optionalTextField,
  ...installationRegisterFieldsSchema,
  refrigerantType: z.string().min(1, "Köldmedietyp krävs"),
  refrigerantAmount: z.string().transform((val) => parseFloat(val)),
  installationDate: nullableInstallationDateSchema,
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
  location: optionalTextField,
  ...installationRegisterFieldsSchema,
  refrigerantType: z.string().min(1, "Köldmedietyp krävs"),
  refrigerantAmount: z.string().transform((val) => parseFloat(val)),
  installationDate: nullableInstallationDateSchema,
  lastInspection: optionalDateField,
  inspectionIntervalMonths: optionalIntegerField,
  notes: z.string().optional(),
})

export type EditInstallationData = z.infer<typeof editInstallationSchema>

export const createInvitationSchema = z.object({
  email: z.string().email("Ogiltig emailadress"),
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "CONTRACTOR"]),
})

export type CreateInvitationData = z.infer<typeof createInvitationSchema>

export const createInstallationEventSchema = z.object({
  date: z.string().min(1, "Datum krävs").transform((val) => new Date(val)),
  type: z.enum([
    "INSPECTION",
    "LEAK",
    "REFILL",
    "SERVICE",
    "REPAIR",
    "RECOVERY",
    "REFRIGERANT_CHANGE",
  ]),
  refrigerantAddedKg: z.string()
    .optional()
    .transform((val) => parseOptionalDecimal(val)),
  newRefrigerantType: z.string()
    .optional()
    .transform((val) => val?.trim() ?? ""),
  recoveredRefrigerantKg: z.string()
    .optional()
    .transform((val) => parseOptionalDecimal(val)),
  correctingEventId: z.string().optional(),
  supersededReason: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => data.type !== "REFILL" || data.refrigerantAddedKg !== null, {
  message: "Påfylld mängd krävs för påfyllning",
  path: ["refrigerantAddedKg"],
}).refine((data) => data.type !== "REFRIGERANT_CHANGE" || Boolean(data.newRefrigerantType), {
  message: "Nytt köldmedium krävs vid byte av köldmedium",
  path: ["newRefrigerantType"],
}).refine((data) => data.type !== "REFRIGERANT_CHANGE" || data.refrigerantAddedKg !== null, {
  message: "Ny fyllnadsmängd krävs vid byte av köldmedium",
  path: ["refrigerantAddedKg"],
}).refine((data) => data.refrigerantAddedKg === null || Number.isFinite(data.refrigerantAddedKg), {
  message: "Mängd måste vara ett giltigt tal",
  path: ["refrigerantAddedKg"],
}).refine((data) => data.refrigerantAddedKg === null || data.refrigerantAddedKg >= 0, {
  message: "Mängd måste vara 0 eller högre",
  path: ["refrigerantAddedKg"],
}).refine((data) => data.recoveredRefrigerantKg === null || Number.isFinite(data.recoveredRefrigerantKg), {
  message: "Omhändertagen mängd måste vara ett giltigt tal",
  path: ["recoveredRefrigerantKg"],
}).refine((data) => data.recoveredRefrigerantKg === null || data.recoveredRefrigerantKg >= 0, {
  message: "Omhändertagen mängd måste vara 0 eller högre",
  path: ["recoveredRefrigerantKg"],
})

export type CreateInstallationEventData = z.infer<typeof createInstallationEventSchema>

function parseOptionalDecimal(value?: string) {
  const normalizedValue = value?.trim().replace(",", ".")
  if (!normalizedValue) return null
  return Number(normalizedValue)
}
