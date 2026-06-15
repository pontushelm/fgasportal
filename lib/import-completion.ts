export type ImportCompletionKind = "events" | "installations" | "properties"

export type ImportCompletionSeverity = "info" | "success" | "warning"

export type ImportCompletionWarning = {
  label: string
  value: number
}

export type ImportCompletionAction = {
  href?: string
  label: string
  onClick?: () => void
  variant?: "primary" | "secondary"
}

export type ImportCompletionContext = {
  hasNoProperties?: boolean
  installationsMissingPropertyCount?: number
  servicePartnersConfigured?: boolean
  unmappedColumnCount?: number
  validationIssueCount?: number
}

export type ImportCompletionRecommendation = {
  description: string
  href: string
  label: string
  title: string
}

export function buildImportCompletionWarnings({
  skipped = 0,
  unmappedColumnCount = 0,
  validationIssueCount = 0,
}: {
  skipped?: number
  unmappedColumnCount?: number
  validationIssueCount?: number
}): ImportCompletionWarning[] {
  return [
    skipped > 0 ? { label: "Hoppade över", value: skipped } : null,
    validationIssueCount > 0
      ? { label: "Valideringsproblem", value: validationIssueCount }
      : null,
    unmappedColumnCount > 0
      ? { label: "Ignorerade kolumner", value: unmappedColumnCount }
      : null,
  ].filter((warning): warning is ImportCompletionWarning => Boolean(warning))
}

export function buildImportCompletionRecommendations(
  kind: ImportCompletionKind,
  context: ImportCompletionContext = {}
): ImportCompletionRecommendation[] {
  const recommendations: ImportCompletionRecommendation[] = []

  if (kind === "properties") {
    recommendations.push({
      description:
        "Nästa steg är att importera aggregat och koppla dem till fastigheterna.",
      href: "/dashboard/installations/import",
      label: "Importera aggregat",
      title: "Fortsätt med aggregatregistret",
    })
  }

  if (kind === "installations" && context.hasNoProperties) {
    recommendations.push({
      description:
        "Fastigheter behövs för årsrapporter och tydlig uppföljning per byggnad.",
      href: "/dashboard/properties/import",
      label: "Importera fastigheter",
      title: "Lägg till fastigheter",
    })
  }

  if (
    kind === "installations" &&
    (context.installationsMissingPropertyCount ?? 0) > 0
  ) {
    recommendations.push({
      description:
        "Koppla aggregat till fastigheter så årsrapportering och översikter blir rätt.",
      href: "/dashboard/installations?quality=missing-property",
      label: "Visa aggregat",
      title: "Koppla aggregat till fastigheter",
    })
  }

  if (kind === "installations") {
    recommendations.push({
      description:
        "Om du har kontrollhistorik, läckage eller påfyllningar i registret är nästa steg att importera händelser.",
      href: "/dashboard/installations/import-events",
      label: "Importera händelser",
      title: "Fortsätt med kontrollhistorik",
    })
    recommendations.push({
      description:
        "Granska saknade uppgifter innan du förhandsgranskar årsrapporten.",
      href: "/dashboard/data-quality",
      label: "Granska registerstatus",
      title: "Kontrollera registerstatus",
    })
  }

  if (
    kind === "installations" &&
    context.servicePartnersConfigured === false
  ) {
    recommendations.push({
      description:
        "Bjud in servicepartner om externa tekniker ska arbeta med aggregaten.",
      href: "/dashboard/contractors",
      label: "Visa servicepartners",
      title: "Sätt upp servicepartner",
    })
  }

  if (kind === "events") {
    recommendations.push({
      description:
        "Granska saknade uppgifter och varningar innan årsrapporten förhandsgranskas.",
      href: "/dashboard/data-quality",
      label: "Granska registerstatus",
      title: "Kontrollera registerstatus",
    })
    recommendations.push({
      description:
        "När underlaget ser bra ut kan du välja fastighet och förhandsgranska årsrapporten.",
      href: "/dashboard/reports",
      label: "Förhandsgranska årsrapport",
      title: "Gå vidare till årsrapport",
    })
    recommendations.push({
      description:
        "Kontrollera om importerade händelser skapade nya uppföljningar.",
      href: "/dashboard/actions",
      label: "Granska åtgärder",
      title: "Granska åtgärder efter import",
    })
  }

  if (recommendations.length === 0) {
    recommendations.push({
      description:
        "Öppna registerstatus för att se om registret behöver kompletteras.",
      href: "/dashboard/data-quality",
      label: "Öppna registerstatus",
      title: "Kontrollera registerstatus",
    })
  }

  return recommendations
}
