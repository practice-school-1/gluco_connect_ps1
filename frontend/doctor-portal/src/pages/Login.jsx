import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Alert, Button, Input } from "../components/ui";

export default function Login() {
  const { login, registerDoctor } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [regForm, setRegForm] = useState({
    email: "",
    password: "",
    full_name: "",
    license_number: "",
    specialty: "",
    clinic_name: "",
  });

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    if (!loginForm.email || !loginForm.password) {
      setError("Enter email and password.");
      return;
    }
    setBusy(true);
    try {
      await login(loginForm.email, loginForm.password);
      navigate("/overview");
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError("");
    if (!regForm.email || !regForm.password || !regForm.full_name || !regForm.license_number) {
      setError("Email, password, full name and license are required.");
      return;
    }
    setBusy(true);
    try {
      await registerDoctor(regForm);
      navigate("/overview");
    } catch (err) {
      setError(err.message || "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_70%_20%,rgba(249,115,22,0.10)_0%,transparent_55%),radial-gradient(ellipse_at_15%_80%,rgba(255,178,56,0.06)_0%,transparent_50%)]">
      <div className="w-full max-w-[440px] bg-s1 border border-b1 rounded-[20px] p-9 shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-acc to-acc2 text-[#180D02] flex items-center justify-center font-extrabold text-[17px] shadow-[0_4px_14px_rgba(249,115,22,0.35)]">
            G
          </div>
          <div className="text-[17px] font-bold tracking-tight">
            Gluco<span className="text-acc">Connect</span>{" "}
            <span className="text-xs text-t3 font-normal">Doctor</span>
          </div>
        </div>

        <div className="flex bg-s2 rounded-lg p-1 mb-7">
          {["login", "register"].map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setError("");
              }}
              className={`flex-1 text-center py-2 text-[13px] font-semibold rounded-md transition-all ${
                tab === t ? "bg-s3 text-t1 shadow" : "text-t2"
              }`}
            >
              {t === "login" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        {tab === "login" ? (
          <form onSubmit={handleLogin}>
            <h2 className="text-xl font-extrabold tracking-tight mb-1">Welcome back</h2>
            <p className="text-sm text-t2 mb-6 leading-relaxed">
              Sign in with your registered email and password.
            </p>
            <Alert>{error}</Alert>
            <Input
              label="Email"
              type="email"
              placeholder="doctor@example.com"
              autoComplete="email"
              className="mb-4"
              value={loginForm.email}
              onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              className="mb-5"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
            />
            <Button type="submit" disabled={busy} className="w-full justify-center">
              {busy && <span className="spinner w-3.5 h-3.5 rounded-full border-2 border-black/25 border-t-[#180D02]" />}
              Sign in
            </Button>
            <div className="text-center mt-6 text-[13px] text-t3">
              Patient?{" "}
              <a href="/patient" className="text-acc font-semibold no-underline">
                Go to patient portal →
              </a>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <h2 className="text-xl font-extrabold tracking-tight mb-1">Create account</h2>
            <p className="text-sm text-t2 mb-6 leading-relaxed">
              Set up your GlucoConnect doctor account. You'll create your profile right after.
            </p>
            <Alert>{error}</Alert>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Input
                label="Email *"
                type="email"
                placeholder="doctor@example.com"
                value={regForm.email}
                onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
              />
              <Input
                label="Password *"
                type="password"
                placeholder="Min 8 characters"
                value={regForm.password}
                onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Input
                label="Full name *"
                placeholder="Dr. Priya Sharma"
                value={regForm.full_name}
                onChange={(e) => setRegForm({ ...regForm, full_name: e.target.value })}
              />
              <Input
                label="License number *"
                placeholder="MCI-12345"
                value={regForm.license_number}
                onChange={(e) => setRegForm({ ...regForm, license_number: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <Input
                label="Specialty"
                placeholder="Endocrinology"
                value={regForm.specialty}
                onChange={(e) => setRegForm({ ...regForm, specialty: e.target.value })}
              />
              <Input
                label="Clinic / Hospital"
                placeholder="Apollo Hospital"
                value={regForm.clinic_name}
                onChange={(e) => setRegForm({ ...regForm, clinic_name: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full justify-center">
              {busy && <span className="spinner w-3.5 h-3.5 rounded-full border-2 border-black/25 border-t-[#180D02]" />}
              Create account
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
