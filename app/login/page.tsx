import LoginForm from "@/components/auth/login-form"
import { AuthShell } from "@/components/auth/auth-shell"

export default function LoginPage() {
  return (
    <AuthShell title="Logga in" subtitle="Fortsätt till organisationens F-gasregister.">
      <LoginForm />
    </AuthShell>
  )
}
