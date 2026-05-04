import ForgotPasswordForm from "@/components/auth/forgot-password-form"
import { AuthShell } from "@/components/auth/auth-shell"

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Glömt lösenord?"
      subtitle="Ange din e-postadress så skickar vi instruktioner om kontot finns."
    >
      <ForgotPasswordForm />
    </AuthShell>
  )
}
