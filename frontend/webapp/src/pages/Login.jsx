import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Alert, Button, Input } from "../components/ui";

const VALUE_PROPS = [
  { title: "Unified clinical view", body: "Glucose, meals, activity, and medication adherence in one continuous timeline per patient." },
  { title: "AI-assisted triage", body: "Rule-engine and model-generated insights flag risk before it becomes an emergency room visit." },
  { title: "Built for scale", body: "The same platform serving a single clinic today is architected for national rollout." },
];

export default function Login() {
  const navigate = useNavigate();
  const [portal, setPortal] = useState("doctor");

  return (
    <div className="min-h-screen flex bg-bg">
      <div className="hidden lg:flex lg:w-[46%] bg-bg2 text-white flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }} />
        <div className="relative">
          <div className="flex items-center gap-2.5 font-bold text-lg">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-acc to-acc2 flex items-center justify-center font-extrabold text-[17px]">
              G
            </div>
            GlucoConnect
          </div>
          <p className="text-white/50 text-sm mt-2">Chronic disease management platform</p>
        </div>

        <div className="relative space-y-8">
          {VALUE_PROPS.map((v) => (
            <div key={v.title}>
              <div className="text-[15px] font-semibold mb-1.5">{v.title}</div>
              <div className="text-sm text-white/55 leading-relaxed max-w-sm">{v.body}</div>
            </div>
          ))}
        </div>

        <div className="relative text-xs text-white/35">© {new Date().getFullYear()} GlucoConnect. For clinical evaluation use.</div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[420px]">
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-acc to-acc2 flex items-center justify-center font-extrabold text-sm text-white">
              G
            </div>
            <div className="text-base font-bold text-t1">GlucoConnect</div>
          </div>

          <div className="flex bg-s2 rounded-lg p-1 mb-8">
            {[{ id: "doctor", label: "Clinician" }, { id: "patient", label: "Patient" }].map((p) => (
              <button
                key={p.id}
                onClick={() => setPortal(p.id)}
                className={`flex-1 text-center py-2 text-[13px] font-semibold rounded-md transition-all ${
                  portal === p.id ? "bg-s1 text-t1 shadow-[0_1px_2px_rgba(16,24,40,0.06)]" : "text-t3"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {portal === "doctor" ? <DoctorAuth navigate={navigate} /> : <PatientAuth navigate={navigate} />}
        </div>
      </div>
    </div>
  );
}

function DoctorAuth({ navigate }) {
  const { loginDoctor, registerDoctor } = useAuth();
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
      await loginDoctor(loginForm.email, loginForm.password);
      navigate("/doctor/overview");
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
      navigate("/doctor/overview");
    } catch (err) {
      setError(err.message || "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex gap-1 border-b border-b1 mb-6">
        {["login", "register"].map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setError("");
            }}
            className={`px-1 pb-2.5 mr-5 text-sm border-b-2 transition ${
              tab === t ? "text-acc border-acc font-semibold" : "text-t3 border-transparent hover:text-t1"
            }`}
          >
            {t === "login" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      {tab === "login" ? (
        <form onSubmit={handleLogin}>
          <h2 className="text-xl font-extrabold tracking-tight mb-1 text-t1">Clinician sign in</h2>
          <p className="text-sm text-t2 mb-6 leading-relaxed">Sign in with your registered email and password.</p>
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
          <Button type="submit" disabled={busy} className="w-full">
            {busy && <span className="spinner w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white" />}
            Sign in
          </Button>
        </form>
      ) : (
        <form onSubmit={handleRegister}>
          <h2 className="text-xl font-extrabold tracking-tight mb-1 text-t1">Create clinician account</h2>
          <p className="text-sm text-t2 mb-6 leading-relaxed">You'll set up your profile right after.</p>
          <Alert>{error}</Alert>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Input label="Email *" type="email" placeholder="doctor@example.com" value={regForm.email} onChange={(e) => setRegForm({ ...regForm, email: e.target.value })} />
            <Input label="Password *" type="password" placeholder="Min 8 characters" value={regForm.password} onChange={(e) => setRegForm({ ...regForm, password: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Input label="Full name *" placeholder="Dr. Priya Sharma" value={regForm.full_name} onChange={(e) => setRegForm({ ...regForm, full_name: e.target.value })} />
            <Input label="License number *" placeholder="MCI-12345" value={regForm.license_number} onChange={(e) => setRegForm({ ...regForm, license_number: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <Input label="Specialty" placeholder="Endocrinology" value={regForm.specialty} onChange={(e) => setRegForm({ ...regForm, specialty: e.target.value })} />
            <Input label="Clinic / Hospital" placeholder="Apollo Hospital" value={regForm.clinic_name} onChange={(e) => setRegForm({ ...regForm, clinic_name: e.target.value })} />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy && <span className="spinner w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white" />}
            Create account
          </Button>
        </form>
      )}
    </div>
  );
}

function PatientAuth({ navigate }) {
  const { sendOtp, verifyOtp } = useAuth();
  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSendOtp(e) {
    e.preventDefault();
    setError("");
    if (!phone.trim()) {
      setError("Enter your phone number.");
      return;
    }
    setBusy(true);
    try {
      await sendOtp(phone);
      setStep("otp");
    } catch {
      setError("Failed to send OTP. Is the backend running?");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError("");
    if (otp.trim().length !== 6) {
      setError("Enter the 6-digit OTP.");
      return;
    }
    setBusy(true);
    try {
      const profile = await verifyOtp(phone, otp.trim());
      navigate(profile?.full_name ? "/patient/dashboard" : "/patient/profile");
    } catch (err) {
      setError(err.message || "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "otp") {
    return (
      <form onSubmit={handleVerifyOtp}>
        <h2 className="text-xl font-extrabold tracking-tight mb-1 text-t1">Check your phone</h2>
        <p className="text-sm text-t2 mb-6 leading-relaxed">
          We sent a 6-digit code to {phone}. In dev mode, check the backend terminal logs.
        </p>
        <Alert>{error}</Alert>
        <Input
          label="One-time password"
          type="text"
          maxLength={6}
          placeholder="000000"
          autoComplete="one-time-code"
          className="mb-5"
          style={{ fontSize: 22, letterSpacing: 6, textAlign: "center", fontWeight: 700 }}
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
        />
        <Button type="submit" disabled={busy} className="w-full mb-2">
          {busy && <span className="spinner w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white" />}
          Verify &amp; sign in
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("phone")}>
          ← Change number
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSendOtp}>
      <h2 className="text-xl font-extrabold tracking-tight mb-1 text-t1">Welcome back</h2>
      <p className="text-sm text-t2 mb-6 leading-relaxed">Enter your phone number and we'll send you a one-time password.</p>
      <Alert>{error}</Alert>
      <Input
        label="Phone number"
        type="tel"
        placeholder="+91 98765 43210"
        autoComplete="tel"
        className="mb-5"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <Button type="submit" disabled={busy} className="w-full">
        {busy && <span className="spinner w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white" />}
        Send OTP
      </Button>
    </form>
  );
}
