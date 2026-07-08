import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { PageHeader } from "../../components/Shell";
import { Alert, Badge, Button, Card, Empty, Input, Loader, Select, Textarea, fmtDateTime } from "../../components/ui";

function isToday(d) {
  return d && new Date(d).toDateString() === new Date().toDateString();
}
function nowLocal() {
  const n = new Date();
  n.setMinutes(n.getMinutes() - n.getTimezoneOffset());
  return n.toISOString().slice(0, 16);
}
function giTone(gi) {
  return gi === "low" ? "grn" : gi === "high" ? "red" : "yel";
}

export default function LogMeal() {
  const [type, setType] = useState("breakfast");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [desc, setDesc] = useState("");
  const [carbs, setCarbs] = useState("");
  const [cal, setCal] = useState("");
  const [time, setTime] = useState(nowLocal());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState({ tone: "error", text: "" });
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState([]);
  const debounceRef = useRef(null);

  function loadSide() {
    setLoading(true);
    api("GET", "/meals")
      .then((d) => {
        const t = (d || []).filter((m) => isToday(m.logged_at || m.created_at)).sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at));
        setToday(t);
      })
      .finally(() => setLoading(false));
  }

  useEffect(loadSide, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await api("GET", `/foods?query=${encodeURIComponent(query.trim())}`);
        setResults((r || []).slice(0, 5));
      } catch {
        setResults([]);
      }
    }, 300);
  }, [query]);

  function selectFood(f) {
    if (selected.find((x) => x.id === f.id)) return;
    const next = [...selected, f];
    setSelected(next);
    setQuery("");
    setResults([]);
    const tc = next.reduce((s, x) => s + ((x.carbs_per_100g ?? 0) * (x.typical_portion_grams ?? 100)) / 100, 0);
    setCarbs(Math.round(tc) || "");
    if (!desc) setDesc(next.map((x) => x.name).join(", "));
  }

  function removeFood(id) {
    const next = selected.filter((f) => f.id !== id);
    setSelected(next);
    const tc = next.reduce((s, x) => s + ((x.carbs_per_100g ?? 0) * (x.typical_portion_grams ?? 100)) / 100, 0);
    setCarbs(next.length ? Math.round(tc) || "" : "");
  }

  async function save(e) {
    e.preventDefault();
    if (!desc.trim()) {
      setAlertMsg({ tone: "error", text: "Enter a meal description." });
      return;
    }
    setSaving(true);
    setAlertMsg({ tone: "error", text: "" });
    try {
      const meal_items = selected.map((f) => ({
        name: f.name,
        quantity: `${f.typical_portion_grams ?? 100}g`,
        carbs_grams: Math.round(((f.carbs_per_100g ?? 0) * (f.typical_portion_grams ?? 100)) / 100),
        calories: Math.round(((f.calories_per_100g ?? 0) * (f.typical_portion_grams ?? 100)) / 100),
        glycemic_index: f.gi_index,
        is_regional: !!f.region,
      }));
      if (!meal_items.length && (carbs || cal)) {
        meal_items.push({ name: desc, carbs_grams: carbs ? parseFloat(carbs) : undefined, calories: cal ? parseFloat(cal) : undefined });
      }
      const body = {
        meal_type: type,
        notes: notes.trim() ? `${desc} — ${notes.trim()}` : desc,
        logged_at: time || new Date().toISOString(),
        meal_items,
      };
      await api("POST", "/meals", body);
      setAlertMsg({ tone: "success", text: "✓ Meal saved!" });
      setDesc("");
      setCarbs("");
      setCal("");
      setNotes("");
      setSelected([]);
      setTime(nowLocal());
      loadSide();
    } catch (err) {
      setAlertMsg({ tone: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  const totalCarbs = today.reduce((s, m) => s + (m.total_carbs_grams || 0), 0);

  return (
    <div>
      <PageHeader title="Log meal" subtitle="Record what you ate and when." />
      <div className="flex gap-6 items-start flex-wrap">
        <Card className="max-w-[520px] w-full">
          <form onSubmit={save}>
            <Alert tone={alertMsg.tone}>{alertMsg.text}</Alert>
            <Select label="Meal type *" className="mb-4" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </Select>

            <div className="mb-4">
              <Input
                label="Search Indian foods"
                placeholder="e.g. roti, idli, rajma, chai…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
              />
              {results.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {results.map((f) => (
                    <div
                      key={f.id}
                      onClick={() => selectFood(f)}
                      className="flex items-center justify-between px-3 py-2 bg-s2 border border-b1 rounded-lg text-sm cursor-pointer hover:border-acc hover:bg-acc/5"
                    >
                      <span>
                        <strong className="text-t1">{f.name}</strong>
                        {f.regional_name && <span className="text-t3"> {f.regional_name}</span>}
                        <span className="text-t3 text-xs"> · {f.typical_portion_grams ?? "?"}g</span>
                      </span>
                      <Badge tone={giTone(f.gi_index)}>GI {f.gi_value ?? "?"}</Badge>
                    </div>
                  ))}
                </div>
              )}
              {selected.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selected.map((f) => (
                    <span key={f.id} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-acc/8 border border-acc/20 rounded-full text-xs text-acc">
                      {f.name}
                      <button type="button" onClick={() => removeFood(f.id)} className="text-acc/70 hover:text-acc text-sm leading-none">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <Textarea label="Description *" placeholder="e.g. 2 rotis with dal and sabzi…" className="mb-4" value={desc} onChange={(e) => setDesc(e.target.value)} />
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Input label="Carbs (g)" type="number" min={0} placeholder="Optional" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
              <Input label="Calories" type="number" min={0} placeholder="Optional" value={cal} onChange={(e) => setCal(e.target.value)} />
            </div>
            <Input label="Date & time" type="datetime-local" className="mb-4" value={time} onChange={(e) => setTime(e.target.value)} />
            <Textarea label="Notes" placeholder="Portion size, how you felt…" className="mb-4" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Button type="submit" disabled={saving}>Save meal</Button>
          </form>
        </Card>

        <Card title="Today so far" className="flex-1 min-w-[300px]">
          {loading ? (
            <Loader />
          ) : (
            <>
              <div className="flex gap-6 pb-3.5 mb-1.5 border-b border-b1">
                <div>
                  <div className="text-2xl font-extrabold tracking-tight text-t1">{today.length}</div>
                  <div className="text-[11px] uppercase tracking-wider text-t3 font-semibold mt-1">Meals</div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold tracking-tight text-t1">{Math.round(totalCarbs)}</div>
                  <div className="text-[11px] uppercase tracking-wider text-t3 font-semibold mt-1">Carbs (g)</div>
                </div>
              </div>
              {today.length === 0 ? (
                <Empty icon="🍽">No meals logged yet today</Empty>
              ) : (
                <div className="divide-y divide-b1">
                  {today.map((m) => (
                    <div key={m.id} className="py-2.5">
                      <div className="text-sm font-semibold text-t1">
                        {(m.meal_items?.length ? m.meal_items.map((i) => i.name).join(", ") : m.notes) || m.meal_type}
                      </div>
                      <div className="text-xs text-t3 mt-0.5 capitalize">
                        {(m.meal_type || "").replace(/_/g, " ")} · {m.total_carbs_grams ?? 0}g carbs · {fmtDateTime(m.logged_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
