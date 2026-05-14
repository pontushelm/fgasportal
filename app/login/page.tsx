import { Suspense } from "react"
import LoginForm from "@/components/auth/login-form"
import { AuthShell } from "@/components/auth/auth-shell"

export default function LoginPage() {
  return (
    <AuthShell title="Logga in" subtitle="Fortsätt till organisationens F-gasregister.">
      <Suspense fallback={<p className="text-sm text-slate-600">Laddar...</p>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  )
}
