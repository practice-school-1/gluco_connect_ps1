import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { PageHeader } from "../../components/Shell";
import { Alert, Button, Card, Input, Select } from "../../components/ui";

const EMPTY_FORM = {
  full_name: "",
  date_of_birth: "",
  gender: "",
  diabetes_type: "",
  target_glucose_min: "",
  target_glucose_max: "",
  emergency_contact_phone: "",
};

export default function Profile() {
  const { refreshProfile } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [doctorId, setDoctorId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState({ tone: "error", text: "" });
  const [inviteCode, setInviteCode] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkMsg, setLinkMsg] = useState({ tone: "error", text: "" });

  function load() {
    api("GET", "/patients/profile")
      .then((p) => {
        if (!p) return;
        setForm({
          full_name: p.full_name || "",
          date_of_birth: p.date_of_birth?.slice(0, 10) || "",
          gender: p.gender || "",
          diabetes_type: p.diabetes_type || "",
          target_glucose_min: p.target_glucose_min || "",
          target_glucose_max: p.target_glucose_max || "",
          emergency_contact_phone: p.emergency_contact_phone || "",
        });
        setDoctorId(p.doctor_id || null);
      })
      .catch(() => {});
  }

  useEffect(load, []);

  async function saveProfile(e) {
    e.preventDefault();
    if (!form.full_name.trim() || !form.date_of_birth) {
      setAlertMsg({ tone: "error", text: "Full name and date of birth are required." });
      return;
    }
    setSaving(true);
    setAlertMsg({ tone: "error", text: "" });
    const body = {
      full_name: form.full_name,
      date_of_birth: form.date_of_birth,
      gender: form.gender || undefined,
      diabetes_type: form.diabetes_type || undefined,
      target_glucose_min: form.target_glucose_min ? parseInt(form.target_glucose_min, 10) : undefined,
      target_glucose_max: form.target_glucose_max ? parseInt(form.target_glucose_max, 10) : undefined,
      emergency_contact_phone: form.emergency_contact_phone || undefined,
    };
    try {
      try {
        await api("PATCH", "/patients/profile", body);
      } catch {
        await api("POST", "/patients/profile", body);
      }
      setAlertMsg({ tone: "success", text: "✓ Profile saved!" });
      await refreshProfile();
    } catch (err) {
      setAlertMsg({ tone: "error", text: err.message || "Failed to save." });
    } finally {
      setSaving(false);
    }
  }

  async function linkDoctor(e) {
    e.preventDefault();
    const code = inviteCode.trim().toUpperCase();
    if (!code || code.length < 4) {
      setLinkMsg({ tone: "error", text: "Enter a valid invite code." });
      return;
    }
    setLinking(true);
    setLinkMsg({ tone: "error", text: "" });
    try {
      await api("POST", "/patients/link-doctor", { invite_code: code });
      setLinkMsg({ tone: "success", text: "✓ Successfully linked to your doctor!" });
      setInviteCode("");
      load();
    } catch (err) {
      setLinkMsg({ tone: "error", text: err.message || "Invalid invite code." });
    } finally {
      setLinking(false);
    }
  }

  return (
    <div>
      <PageHeader title="My profile" subtitle="Your personal and health details." />

      <Card className="max-w-xl mb-5">
        <form onSubmit={saveProfile}>
          <Alert tone={alertMsg.tone}>{alertMsg.text}</Alert>

          <h3 className="text-[11px] font-bold text-t3 uppercase tracking-wider mb-4 pb-2 border-b border-b1">Personal information</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Input label="Full name *" placeholder="Your full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <Input label="Date of birth *" type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Select label="Gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </Select>
            <Select label="Diabetes type" value={form.diabetes_type} onChange={(e) => setForm({ ...form, diabetes_type: e.target.value })}>
              <option value="">Unknown</option>
              <option value="type_1">Type 1</option>
              <option value="type_2">Type 2</option>
              <option value="gestational">Gestational</option>
              <option value="prediabetes">Prediabetes</option>
            </Select>
          </div>

          <h3 className="text-[11px] font-bold text-t3 uppercase tracking-wider mb-4 pb-2 border-b border-b1">Health goals</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Input label="Target glucose min (mg/dL)" type="number" placeholder="70" value={form.target_glucose_min} onChange={(e) => setForm({ ...form, target_glucose_min: e.target.value })} />
            <Input label="Target glucose max (mg/dL)" type="number" placeholder="140" value={form.target_glucose_max} onChange={(e) => setForm({ ...form, target_glucose_max: e.target.value })} />
          </div>
          <Input label="Emergency contact phone" type="tel" placeholder="+91 98765 43210" className="mb-6" value={form.emergency_contact_phone} onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} />

          <Button type="submit" disabled={saving}>Save profile</Button>
        </form>
      </Card>

      <Card className="max-w-xl">
        <form onSubmit={linkDoctor}>
          <Alert tone={linkMsg.tone}>{linkMsg.text}</Alert>
          <h3 className="text-[11px] font-bold text-t3 uppercase tracking-wider mb-4 pb-2 border-b border-b1">My doctor</h3>
          <div className="mb-4 px-3.5 py-3 bg-s2 rounded-lg text-sm text-t2">
            {doctorId ? (
              <>
                <span className="text-acc font-semibold">✓ Linked to a doctor</span> — Doctor ID: <code className="text-xs text-t2">{doctorId}</code>
              </>
            ) : (
              <>
                <span className="text-yel font-semibold">Not linked to a doctor yet.</span> Enter an invite code below to connect.
              </>
            )}
          </div>
          <Input
            label="Doctor invite code"
            placeholder="Enter code e.g. AB12CD"
            style={{ textTransform: "uppercase", letterSpacing: 2 }}
            className="mb-1.5"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
          />
          <p className="text-xs text-t3 mb-4">Ask your doctor for their invite code to link your account.</p>
          <Button type="submit" disabled={linking}>Link to doctor</Button>
        </form>
      </Card>
    </div>
  );
}
