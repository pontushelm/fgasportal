import { describe, expect, it } from "vitest"
import { getServicePartnerInvitationMetadata } from "@/lib/service-partner-invitations"
import { createInvitationSchema } from "@/lib/validations"

describe("service partner invitation metadata", () => {
  it("marks service partner invitations as responsible admin invitations", () => {
    const metadata = getServicePartnerInvitationMetadata({
      role: "CONTRACTOR",
      servicePartnerCompanyId: "spc_123",
    })

    expect(metadata).toEqual({
      servicePartnerCompanyId: "spc_123",
      isServicePartnerAdmin: true,
    })
  })

  it("does not attach service partner metadata to internal invitations", () => {
    const metadata = getServicePartnerInvitationMetadata({
      role: "ADMIN",
      servicePartnerCompanyId: "spc_123",
    })

    expect(metadata).toEqual({
      servicePartnerCompanyId: null,
      isServicePartnerAdmin: false,
    })
  })

  it("keeps old contractor invitations without a company as non-admin metadata", () => {
    const metadata = getServicePartnerInvitationMetadata({
      role: "CONTRACTOR",
    })

    expect(metadata).toEqual({
      servicePartnerCompanyId: null,
      isServicePartnerAdmin: false,
    })
  })

  it("can mark service partner technician invitations as non-admin", () => {
    const metadata = getServicePartnerInvitationMetadata({
      role: "CONTRACTOR",
      servicePartnerCompanyId: "spc_123",
      isServicePartnerAdminInvite: false,
    })

    expect(metadata).toEqual({
      servicePartnerCompanyId: "spc_123",
      isServicePartnerAdmin: false,
    })
  })

  it("accepts service partner company id in invitation payload validation", () => {
    expect(
      createInvitationSchema.parse({
        email: "servicepartner@example.com",
        role: "CONTRACTOR",
        servicePartnerCompanyId: "spc_123",
        isServicePartnerAdminInvite: false,
      })
    ).toEqual({
      email: "servicepartner@example.com",
      role: "CONTRACTOR",
      servicePartnerCompanyId: "spc_123",
      isServicePartnerAdminInvite: false,
    })
  })
})
