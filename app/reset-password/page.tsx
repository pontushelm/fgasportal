import ResetPasswordForm from "@/components/auth/reset-password-form"
import { AuthShell } from "@/components/auth/auth-shell"

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token = "" } = await searchParams

  return (
    <AuthShell
      title="Återställ lösenord"
      subtitle="Välj ett nytt lösenord för ditt FgasPortal-konto."
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  )
}
