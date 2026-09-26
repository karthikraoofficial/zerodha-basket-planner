import { Stepper } from "@/components/Stepper";

export default function LoginPage() {
  return (
    <>
      <Stepper current={1} />
      <h1>Log in with Kite</h1>
      <p>Sign in with your Zerodha account. This app only reads holdings and funds.</p>
      <a className="button" href="/api/kite/login">
        Log in with Kite
      </a>
    </>
  );
}
