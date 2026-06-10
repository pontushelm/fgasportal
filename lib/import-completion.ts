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

  if (kind === "installations" && context.hasNoProperties) {
    recommendations.push({
      description:
        "Fastigheter behövs för årsrapporter och tydlig uppföljning per byggnad.",
      href: "/dashboard/properties",
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
      href: "/dashboard/data-quality",
      label: "Öppna datakvalitet",
      title: "Koppla aggregat till fastigheter",
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

  if (kind === "properties") {
    recommendations.push({
      description:
        "Nästa steg är att importera aggregat och koppla dem till fastigheterna.",
      href: "/dashboard/installations",
      label: "Importera aggregat",
      title: "Fortsätt med aggregatregistret",
    })
  }

  if (kind === "events") {
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
        "Öppna datakvalitet för att se om registret behöver kompletteras.",
      href: "/dashboard/data-quality",
      label: "Öppna datakvalitet",
      title: "Kontrollera datakvalitet",
    })
  }

  return recommendations
}
