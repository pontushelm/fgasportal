import LoginForm from "@/components/auth/login-form"

export default function LoginPage() {
  return (
    <main style={{ maxWidth: 420, margin: "60px auto" }}>
      <h1>Logga in</h1>
      <LoginForm />
    </main>
  )
}