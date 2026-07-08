import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { PageHeader } from "../../components/Shell";
import { Alert, Button, Card, Input } from "../../components/ui";

const EMPTY_FORM = { full_name: "", license_number: "", specialty: "", clinic_name: "", years_of_experience: "" };

export default function Profile() {
  const { refreshProfile } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [inviteCode, setInviteCode] = useState("—");
  const [saving, setSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState({ tone: "error", text: "" });

  useEffect(() => {
    api("GET", "/doctors/profile")
      .then((p) => {
        if (!p) return;
        setForm({
          full_name: p.full_name || "",
          license_number: p.license_number || "",
          specialty: p.specialty || "",
          clinic_name: p.clinic_name || "",
          years_of_experience: p.years_of_experience || "",
        });
        setInviteCode(p.invite_code || "—");
      })
      .catch(() => {});
  }, []);

  async function save(e) {
    e.preventDefault();
    if (!form.full_name.trim() || !form.license_number.trim()) {
      setAlertMsg({ tone: "error", text: "Full name and license are required." });
      return;
    }
    setSaving(true);
    setAlertMsg({ tone: "error", text: "" });
    const body = {
      full_name: form.full_name,
      license_number: form.license_number,
      specialty: form.specialty || undefined,
      clinic_name: form.clinic_name || undefined,
      years_of_experience: form.years_of_experience ? parseInt(form.years_of_experience, 10) : undefined,
    };
    try {
      try {
        await api("PATCH", "/doctors/profile", body);
      } catch {
        await api("POST", "/doctors/profile", body);
      }
      setAlertMsg({ tone: "success", text: "✓ Profile saved!" });
      await refreshProfile();
    } catch (err) {
      setAlertMsg({ tone: "error", text: err.message || "Failed to save." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="My profile" subtitle="Your professional details." />
      <Card className="max-w-xl">
        <form onSubmit={save}>
          <Alert tone={alertMsg.tone}>{alertMsg.text}</Alert>

          <h3 className="text-[11px] font-bold text-t3 uppercase tracking-wider mb-4 pb-2 border-b border-b1">Personal information</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Input label="Full name *" placeholder="Dr. Name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <Input label="License number *" placeholder="MCI-12345" value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Input label="Specialty" placeholder="Endocrinology" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
            <Input label="Clinic / Hospital" placeholder="Apollo Hospital" value={form.clinic_name} onChange={(e) => setForm({ ...form, clinic_name: e.target.value })} />
          </div>
          <Input
            label="Years of experience"
            type="number"
            min="0"
            placeholder="e.g. 10"
            className="mb-6"
            value={form.years_of_experience}
            onChange={(e) => setForm({ ...form, years_of_experience: e.target.value })}
          />
          <Button type="submit" disabled={saving}>Save profile</Button>
        </form>

        <div className="mt-6 pt-6 border-t border-b1">
          <div className="text-xs text-t3 mb-2">Your invite code (share with patients)</div>
          <code className="block bg-s2 border border-b1 rounded-lg px-3.5 py-2 text-sm text-acc">{inviteCode}</code>
        </div>
      </Card>
    </div>
  );
}
