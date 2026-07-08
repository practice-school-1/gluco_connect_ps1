import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { PageHeader } from "../../components/Shell";
import { Badge, Card, Empty, Input, Loader, glucoseBadge } from "../../components/ui";

export default function Patients() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api("GET", "/doctors/patients")
      .then((d) => setPatients(d || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) => (p.full_name || "").toLowerCase().includes(q) || (p.diabetes_type || "").toLowerCase().includes(q)
    );
  }, [patients, query]);

  return (
    <div>
      <PageHeader title="Patients" subtitle="All patients linked to your account." />

      <Card className="mb-4">
        <Input
          placeholder="Search patients…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </Card>

      {loading ? (
        <Loader />
      ) : filtered.length === 0 ? (
        <Empty icon="👥">{patients.length === 0 ? "No patients linked yet" : "No patients match your search"}</Empty>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
          {filtered.map((p) => (
            <div
              key={p.id}
              onClick={() => navigate(`/doctor/patients/${p.id}`, { state: { name: p.full_name, diabetesType: p.diabetes_type } })}
              className="bg-s1 border border-b1 rounded-2xl p-5 cursor-pointer transition hover:border-acc hover:shadow-[0_2px_16px_rgba(249,115,22,0.14)]"
            >
              <div className="text-sm font-bold mb-1">{p.full_name || "Unknown"}</div>
              <div className="text-xs text-t3 mb-2.5 capitalize">
                {p.diabetes_type ? p.diabetes_type.replace(/_/g, " ") : "Diabetes type unknown"}
              </div>
              <div className="flex items-center justify-between pt-2 mt-2 border-t border-b1">
                <span>
                  {p.latest_glucose ? glucoseBadge(p.latest_glucose.value_mg_dl) : <span className="text-t3 text-xs">No readings</span>}
                </span>
                {p.unresolved_alerts > 0 ? (
                  <Badge tone="red">
                    {p.unresolved_alerts} alert{p.unresolved_alerts > 1 ? "s" : ""}
                  </Badge>
                ) : (
                  <Badge tone="grn">All clear</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
