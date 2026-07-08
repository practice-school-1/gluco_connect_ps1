import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { PageHeader } from "../../components/Shell";
import { Badge, Button, Card, Empty, Loader, fmtDate } from "../../components/ui";

export default function Medications() {
  const [loading, setLoading] = useState(true);
  const [adherence, setAdherence] = useState([]);
  const [meds, setMeds] = useState([]);

  function load() {
    setLoading(true);
    Promise.allSettled([api("GET", "/medications/adherence/today"), api("GET", "/medications")]).then(([adh, m]) => {
      setAdherence(adh.status === "fulfilled" ? adh.value || [] : []);
      setMeds(m.status === "fulfilled" ? m.value || [] : []);
      setLoading(false);
    });
  }

  useEffect(load, []);

  async function logDose(id, skip) {
    try {
      await api("POST", `/medications/${id}/log`, { skipped: skip });
      load();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div>
      <PageHeader title="Medications" subtitle="Today's doses and your prescription list." />

      <Card title="Today's checklist" className="mb-5">
        {loading ? (
          <Loader />
        ) : adherence.length === 0 ? (
          <Empty icon="💊">No active medications</Empty>
        ) : (
          <div className="divide-y divide-b1">
            {adherence.map((m) => {
              const status = m.today_log ? (m.today_log.skipped ? "skipped" : "taken") : "";
              return (
                <div key={m.medication_id} className="py-3 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-t1">{m.name}</div>
                    <div className="text-xs text-t3">{[m.dosage, m.frequency].filter(Boolean).join(" · ")}</div>
                  </div>
                  {status ? (
                    <Badge tone={status === "taken" ? "grn" : "yel"}>{status}</Badge>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => logDose(m.medication_id, false)}>Taken</Button>
                      <Button size="sm" variant="secondary" onClick={() => logDose(m.medication_id, true)}>Skip</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="Active prescriptions">
        {loading ? (
          <Loader />
        ) : meds.length === 0 ? (
          <Empty>No medications on file</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-s2">
                  {["Medication", "Dosage", "Frequency", "Route", "Since"].map((h) => (
                    <th key={h} className="text-left px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-t3 border-b border-b1">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {meds.map((m) => (
                  <tr key={m.id} className="hover:bg-s2">
                    <td className="px-3.5 py-2.5 border-b border-b1 text-t1 font-semibold">{m.name}</td>
                    <td className="px-3.5 py-2.5 border-b border-b1 text-t2">{m.dosage || "—"}</td>
                    <td className="px-3.5 py-2.5 border-b border-b1 text-t2">{m.frequency || "—"}</td>
                    <td className="px-3.5 py-2.5 border-b border-b1 text-t2">{m.route || "—"}</td>
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
