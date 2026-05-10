import { describe, expect, it } from "vitest"
import {
  createInstallationSchema,
  editInstallationSchema,
} from "@/lib/validations"

const validInstallationInput = {
  name: "Kylaggregat 1",
  location: "Tak",
  propertyId: "",
  refrigerantType: "R410A",
  refrigerantAmount: "10",
  installationDate: "2020-01-01",
  lastInspection: "",
  notes: "",
}

describe("installation validation", () => {
  it("allows creating an aggregat with unknown commissioning date", () => {
    const result = createInstallationSchema.safeParse({
      ...validInstallationInput,
      installationDate: null,
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.installationDate).toBeNull()
  })

  it("allows editing an aggregat to clear commissioning date", () => {
    const result = editInstallationSchema.safeParse({
      ...validInstallationInput,
      installationDate: "",
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.installationDate).toBeNull()
  })

  it("still validates known commissioning date bounds", () => {
    const result = createInstallationSchema.safeParse({
      ...validInstallationInput,
      installationDate: "1949-12-31",
    })

    expect(result.success).toBe(false)
  })
})
