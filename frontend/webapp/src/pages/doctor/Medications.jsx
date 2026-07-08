import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { PageHeader } from "../../components/Shell";
import { Alert, Button, Card, Empty, Input, Loader, Select, Textarea, fmtDate } from "../../components/ui";

const EMPTY_FORM = { patient_id: "", name: "", dosage: "", frequency: "", route: "oral", start_date: "", end_date: "", notes: "" };

export default function Medications() {
  const [loading, setLoading] = useState(true);
  const [meds, setMeds] = useState([]);
  const [patients, setPatients] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    api("GET", "/medications")
      .then((d) => setMeds(d || []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openForm() {
    if (!patients.length) {
      api("GET", "/doctors/patients").then((d) => setPatients(d || [])).catch(() => {});
    }
    setShowForm(true);
  }

  function patientName(id) {
    return patients.find((p) => p.id === id)?.full_name || `${id?.slice(0, 8)}…`;
  }

  async function prescribe(e) {
    e.preventDefault();
    if (!form.patient_id || !form.name || !form.start_date) {
      setError("Patient, medication name and start date are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api("POST", "/medications", {
        patient_id: form.patient_id,
        name: form.name,
        dosage: form.dosage || undefined,
        frequency: form.frequency || undefined,
        route: form.route,
        start_date: form.start_date,
        end_date: form.end_date || undefined,
        notes: form.notes || undefined,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Medications"
        subtitle="Prescriptions across all patients."
        action={<Button onClick={openForm}>+ Prescribe</Button>}
      />

      {showForm && (
        <Card className="max-w-xl mb-6" title="New prescription" action={<Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>}>
          <form onSubmit={prescribe}>
            <Alert>{error}</Alert>
            <Select label="Patient *" value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })} className="mb-4">
              <option value="">Select patient…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Input label="Medication name *" placeholder="e.g. Metformin" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label="Dosage" placeholder="e.g. 500mg" value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Input label="Frequency" placeholder="e.g. Twice daily" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} />
              <Select label="Route" value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })}>
                <option value="oral">Oral</option>
                <option value="subcutaneous">Subcutaneous</option>
                <option value="intravenous">Intravenous</option>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Input label="Start date *" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              <Input label="End date" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
            <Textarea label="Notes" placeholder="Instructions…" className="mb-4" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <Button type="submit" disabled={saving}>Save prescription</Button>
          </form>
        </Card>
      )}

      <Card>
        {loading ? (
          <Loader />
        ) : meds.length === 0 ? (
          <Empty icon="💊">No prescriptions yet</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-s2">
                  {["Medication", "Patient", "Dosage", "Frequency", "Since"].map((h) => (
                    <th key={h} className="text-left px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-t3 border-b border-b1">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {meds.map((m) => (
                  <tr key={m.id} className="hover:bg-s2">
                    <td className="px-3.5 py-2.5 border-b border-b1 text-t1 font-semibold">{m.name}</td>
                    <td className="px-3.5 py-2.5 border-b border-b1 text-t3 text-xs">{patientName(m.patient_id)}</td>
                    <td className="px-3.5 py-2.5 border-b border-b1 text-t2">{m.dosage || "—"}</td>
                    <td className="px-3.5 py-2.5 border-b border-b1 text-t2">{m.frequency || "—"}</td>
                    <td className="px-3.5 py-2.5 border-b border-b1 text-t2">{fmtDate(m.start_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
