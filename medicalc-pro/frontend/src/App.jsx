import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ─── Palette & design tokens ────────────────────────────────────────────────
// Deep navy #0B2545 | Cyan-teal accent #00B4D8 | Off-white #F0F4F8
// Warning amber #F59E0B | Danger red #EF4444 | Success green #10B981
// Font: DM Sans (body) + DM Mono (data/values)

const TOOLS = [
  { id: "imc", label: "IMC", icon: "⚖️", desc: "Indice de Masse Corporelle" },
  { id: "cockcroft", label: "Cockcroft-Gault", icon: "🫘", desc: "Clairance créatinine" },
  { id: "perfusion", label: "Débit Perfusion", icon: "💉", desc: "Calcul gouttes/min" },
  { id: "gestationnel", label: "Âge Gestationnel", icon: "🤰", desc: "Semaines d'aménorrhée" },
  { id: "nfs", label: "NFS / NGB", icon: "🔬", desc: "Numération Formule Sanguine" },
  { id: "conversion", label: "Conversion", icon: "🔄", desc: "Unités biologiques" },
  { id: "about", label: "À Propos", icon: "👤", desc: "Le projet" },
];

// ─── Utility ────────────────────────────────────────────────────────────────
function Badge({ level }) {
  const map = {
    normal:   { bg: "#D1FAE5", color: "#065F46", label: "Normal" },
    elevated: { bg: "#FEF3C7", color: "#92400E", label: "Élevé" },
    low:      { bg: "#DBEAFE", color: "#1E40AF", label: "Bas" },
    high:     { bg: "#FEE2E2", color: "#991B1B", label: "Très élevé" },
    critical: { bg: "#FEE2E2", color: "#7F1D1D", label: "⚠ Critique" },
  };
  const s = map[level] || map.normal;
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: "2px 10px", borderRadius: 99, fontSize: 12, fontWeight: 700,
      fontFamily: "'DM Mono', monospace"
    }}>{s.label}</span>
  );
}

function ResultCard({ title, value, unit, level, children }) {
  const borderMap = { normal: "#10B981", elevated: "#F59E0B", low: "#3B82F6", high: "#EF4444", critical: "#7F1D1D" };
  return (
    <div style={{
      background: "#fff", borderRadius: 16,
      border: `2px solid ${borderMap[level] || "#E2E8F0"}`,
      padding: "20px 24px", marginTop: 16
    }}>
      <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>{title}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
        <span style={{ fontSize: 36, fontWeight: 800, fontFamily: "'DM Mono', monospace", color: "#0B2545" }}>{value}</span>
        {unit && <span style={{ fontSize: 14, color: "#94A3B8" }}>{unit}</span>}
        {level && <Badge level={level} />}
      </div>
      {children}
    </div>
  );
}

function Input({ label, value, onChange, type = "number", placeholder, unit, options }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>{label}</label>
      {options ? (
        <select value={value} onChange={e => onChange(e.target.value)}
          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #CBD5E1", fontSize: 14, background: "#F8FAFC", outline: "none" }}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            style={{ flex: 1, padding: "10px 14px", borderRadius: unit ? "10px 0 0 10px" : 10, border: "1.5px solid #CBD5E1", fontSize: 14, background: "#F8FAFC", outline: "none" }} />
          {unit && <span style={{ padding: "10px 12px", background: "#E2E8F0", borderRadius: "0 10px 10px 0", fontSize: 13, color: "#475569", border: "1.5px solid #CBD5E1", borderLeft: "none" }}>{unit}</span>}
        </div>
      )}
    </div>
  );
}

function Btn({ children, onClick, loading, variant = "primary" }) {
  const styles = {
    primary: { background: "linear-gradient(135deg,#0B2545,#00B4D8)", color: "#fff" },
    secondary: { background: "#F1F5F9", color: "#0B2545" },
  };
  return (
    <button onClick={onClick} disabled={loading}
      style={{ ...styles[variant], border: "none", borderRadius: 12, padding: "12px 28px", fontWeight: 700, fontSize: 15, cursor: loading ? "wait" : "pointer", width: "100%", marginTop: 4, transition: "opacity .15s", opacity: loading ? .7 : 1 }}>
      {loading ? "⏳ Calcul…" : children}
    </button>
  );
}

// ─── IMC ────────────────────────────────────────────────────────────────────
function ImcCalc() {
  const [poids, setPoids] = useState("");
  const [taille, setTaille] = useState("");
  const [result, setResult] = useState(null);

  function calc() {
    const p = parseFloat(poids), t = parseFloat(taille) / 100;
    if (!p || !t) return;
    const imc = p / (t * t);
    let level, interp;
    if (imc < 18.5) { level = "low"; interp = "Insuffisance pondérale"; }
    else if (imc < 25) { level = "normal"; interp = "Poids normal"; }
    else if (imc < 30) { level = "elevated"; interp = "Surpoids"; }
    else if (imc < 35) { level = "high"; interp = "Obésité modérée (classe I)"; }
    else if (imc < 40) { level = "high"; interp = "Obésité sévère (classe II)"; }
    else { level = "critical"; interp = "Obésité morbide (classe III)"; }
    setResult({ imc: imc.toFixed(1), level, interp });
  }

  return (
    <div>
      <Input label="Poids" value={poids} onChange={setPoids} unit="kg" placeholder="70" />
      <Input label="Taille" value={taille} onChange={setTaille} unit="cm" placeholder="170" />
      <Btn onClick={calc}>Calculer l'IMC</Btn>
      {result && (
        <ResultCard title="Indice de Masse Corporelle" value={result.imc} unit="kg/m²" level={result.level}>
          <p style={{ marginTop: 8, fontSize: 15, color: "#334155" }}>{result.interp}</p>
          <ImcScale imc={parseFloat(result.imc)} />
        </ResultCard>
      )}
    </div>
  );
}

function ImcScale({ imc }) {
  const pct = Math.min(Math.max(((imc - 10) / 40) * 100, 0), 100);
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ height: 10, borderRadius: 99, background: "linear-gradient(90deg,#3B82F6 0%,#10B981 35%,#F59E0B 60%,#EF4444 80%,#7F1D1D 100%)", position: "relative" }}>
        <div style={{ position: "absolute", left: `${pct}%`, top: -4, transform: "translateX(-50%)", width: 18, height: 18, background: "#0B2545", borderRadius: "50%", border: "3px solid #fff", boxShadow: "0 2px 6px #0004" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94A3B8", marginTop: 4 }}>
        <span>10</span><span>18.5</span><span>25</span><span>30</span><span>35</span><span>40+</span>
      </div>
    </div>
  );
}

// ─── COCKCROFT ───────────────────────────────────────────────────────────────
function CockcroftCalc() {
  const [age, setAge] = useState("");
  const [poids, setPoids] = useState("");
  const [creat, setCreat] = useState("");
  const [sexe, setSexe] = useState("M");
  const [result, setResult] = useState(null);

  function calc() {
    const a = parseFloat(age), p = parseFloat(poids), c = parseFloat(creat);
    if (!a || !p || !c) return;
    let cl = ((140 - a) * p) / (72 * c);
    if (sexe === "F") cl *= 0.85;
    let level, stade;
    if (cl >= 90) { level = "normal"; stade = "G1 — Fonction rénale normale"; }
    else if (cl >= 60) { level = "elevated"; stade = "G2 — Légèrement diminuée"; }
    else if (cl >= 45) { level = "high"; stade = "G3a — Modérément diminuée"; }
    else if (cl >= 30) { level = "high"; stade = "G3b — Modérément à sévèrement diminuée"; }
    else if (cl >= 15) { level = "critical"; stade = "G4 — Sévèrement diminuée"; }
    else { level = "critical"; stade = "G5 — Insuffisance rénale terminale"; }
    setResult({ cl: cl.toFixed(1), level, stade });
  }

  return (
    <div>
      <Input label="Âge" value={age} onChange={setAge} unit="ans" placeholder="45" />
      <Input label="Poids" value={poids} onChange={setPoids} unit="kg" placeholder="70" />
      <Input label="Créatinine sérique" value={creat} onChange={setCreat} unit="mg/dL" placeholder="1.2" />
      <Input label="Sexe" value={sexe} onChange={setSexe} options={[{ value: "M", label: "Masculin" }, { value: "F", label: "Féminin" }]} />
      <Btn onClick={calc}>Calculer la clairance</Btn>
      {result && (
        <ResultCard title="Clairance de la créatinine (Cockcroft-Gault)" value={result.cl} unit="mL/min" level={result.level}>
          <p style={{ marginTop: 8, fontSize: 15, color: "#334155" }}>{result.stade}</p>
        </ResultCard>
      )}
    </div>
  );
}

// ─── PERFUSION ───────────────────────────────────────────────────────────────
function PerfusionCalc() {
  const [volume, setVolume] = useState("");
  const [duree, setDuree] = useState("");
  const [facteur, setFacteur] = useState("20");
  const [result, setResult] = useState(null);

  function calc() {
    const v = parseFloat(volume), d = parseFloat(duree), f = parseFloat(facteur);
    if (!v || !d || !f) return;
    const gouttes = (v * f) / (d * 60);
    const mlH = v / d;
    setResult({ gouttes: gouttes.toFixed(0), mlH: mlH.toFixed(1) });
  }

  return (
    <div>
      <Input label="Volume à perfuser" value={volume} onChange={setVolume} unit="mL" placeholder="500" />
      <Input label="Durée de perfusion" value={duree} onChange={setDuree} unit="heures" placeholder="4" />
      <Input label="Facteur de la tubulure" value={facteur} onChange={setFacteur}
        options={[{ value: "20", label: "20 gtt/mL (macrogouttes)" }, { value: "60", label: "60 gtt/mL (microgouttes)" }, { value: "15", label: "15 gtt/mL (sang)" }]} />
      <Btn onClick={calc}>Calculer le débit</Btn>
      {result && (
        <div>
          <ResultCard title="Débit de perfusion" value={result.gouttes} unit="gouttes/min" level="normal" />
          <ResultCard title="Débit horaire" value={result.mlH} unit="mL/heure" level="normal" />
        </div>
      )}
    </div>
  );
}

// ─── ÂGE GESTATIONNEL ────────────────────────────────────────────────────────
function GestCalc() {
  const [ddr, setDdr] = useState("");
  const [result, setResult] = useState(null);

  function calc() {
    if (!ddr) return;
    const debut = new Date(ddr);
    const today = new Date();
    const diff = Math.floor((today - debut) / (1000 * 60 * 60 * 24));
    const sa = Math.floor(diff / 7);
    const jours = diff % 7;
    const dpa = new Date(debut);
    dpa.setDate(dpa.getDate() + 280);
    const level = sa < 37 ? "elevated" : sa > 42 ? "high" : "normal";
    const term = sa < 37 ? "Prématuré" : sa > 42 ? "Post-terme" : "À terme";
    setResult({ sa, jours, dpa: dpa.toLocaleDateString("fr-FR"), level, term, diff });
  }

  return (
    <div>
      <Input label="Date des Dernières Règles (DDR)" value={ddr} onChange={setDdr} type="date" />
      <Btn onClick={calc}>Calculer l'âge gestationnel</Btn>
      {result && result.diff >= 0 && (
        <ResultCard title="Âge gestationnel" value={`${result.sa} SA + ${result.jours} j`} level={result.level}>
          <p style={{ marginTop: 8, fontSize: 15, color: "#334155" }}>{result.term}</p>
          <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>Date prévue d'accouchement : <strong>{result.dpa}</strong></p>
          <GestBar sa={result.sa} />
        </ResultCard>
      )}
    </div>
  );
}

function GestBar({ sa }) {
  const pct = Math.min((sa / 42) * 100, 100);
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ height: 10, borderRadius: 99, background: "#E2E8F0", position: "relative", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: sa < 37 ? "#F59E0B" : sa > 42 ? "#EF4444" : "#10B981", borderRadius: 99, transition: "width .4s" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94A3B8", marginTop: 4 }}>
        <span>0 SA</span><span>Prématuré &lt;37</span><span>Terme 37-42</span><span>Post-terme 42+</span>
      </div>
    </div>
  );
}

// ─── NFS ─────────────────────────────────────────────────────────────────────
const NFS_REF = {
  hb:     { M: [13.5, 17.5], F: [12, 16],   unit: "g/dL",      label: "Hémoglobine" },
  gb:     { M: [4000, 10000], F: [4000, 10000], unit: "/mm³",   label: "Globules blancs" },
  plt:    { M: [150000, 400000], F: [150000, 400000], unit: "/mm³", label: "Plaquettes" },
  vgm:    { M: [80, 100], F: [80, 100],      unit: "fL",        label: "VGM" },
  tcmh:   { M: [27, 33],  F: [27, 33],       unit: "pg",        label: "TCMH" },
  hematocrite: { M: [40, 52], F: [36, 46],   unit: "%",         label: "Hématocrite" },
};

function classify(val, ref) {
  const v = parseFloat(val);
  if (isNaN(v)) return null;
  if (v < ref[0]) return v < ref[0] * 0.6 ? "critical" : "low";
  if (v > ref[1]) return v > ref[1] * 1.5 ? "critical" : "high";
  return "normal";
}

function NfsCalc() {
  const [fields, setFields] = useState({ hb: "", gb: "", plt: "", vgm: "", tcmh: "", hematocrite: "" });
  const [sexe, setSexe] = useState("M");
  const [result, setResult] = useState(null);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  function set(k, v) { setFields(f => ({ ...f, [k]: v })); }

  function calc() {
    const res = {};
    for (const [k, meta] of Object.entries(NFS_REF)) {
      const v = fields[k];
      if (v !== "") res[k] = { val: v, level: classify(v, meta[sexe]), ...meta };
    }
    setResult(res);
    setAiText("");
  }

  async function askAi() {
    if (!result) return;
    setAiLoading(true);
    const lines = Object.entries(result).map(([k, r]) => `${r.label}: ${r.val} ${r.unit} (${r.level})`).join("\n");
    try {
      const resp = await fetch(`${API_BASE}/api/interpret-nfs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: lines, sexe }),
      });
      const data = await resp.json();
      setAiText(data.interpretation);
    } catch {
      setAiText("❌ Impossible de contacter l'API. Vérifiez votre connexion.");
    }
    setAiLoading(false);
  }

  return (
    <div>
      <Input label="Sexe" value={sexe} onChange={setSexe} options={[{ value: "M", label: "Masculin" }, { value: "F", label: "Féminin" }]} />
      {Object.entries(NFS_REF).map(([k, meta]) => (
        <Input key={k} label={`${meta.label}`} value={fields[k]} onChange={v => set(k, v)} unit={meta.unit} placeholder={`${meta[sexe][0]}–${meta[sexe][1]}`} />
      ))}
      <Btn onClick={calc}>Analyser la NFS</Btn>
      {result && (
        <div style={{ marginTop: 16 }}>
          {Object.entries(result).map(([k, r]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: r.level === "normal" ? "#F0FDF4" : r.level === "critical" ? "#FFF1F2" : "#FFFBEB", borderRadius: 10, marginBottom: 6, border: "1px solid #E2E8F0" }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#1E293B" }}>{r.label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, color: "#0B2545" }}>{r.val} <span style={{ fontSize: 11, color: "#94A3B8" }}>{r.unit}</span></span>
                <Badge level={r.level} />
              </div>
            </div>
          ))}
          <div style={{ marginTop: 12, padding: "12px 16px", background: "#EFF6FF", borderRadius: 12, fontSize: 13, color: "#1E40AF" }}>
            📊 Référence : Hb M {NFS_REF.hb.M.join("–")} / F {NFS_REF.hb.F.join("–")} g/dL &nbsp;|&nbsp; GB {NFS_REF.gb.M.join("–")}/mm³ &nbsp;|&nbsp; Plt {(NFS_REF.plt.M[0]/1000).toFixed(0)}–{(NFS_REF.plt.M[1]/1000).toFixed(0)}k/mm³
          </div>
          <Btn onClick={askAi} loading={aiLoading} variant="primary">🤖 Interprétation IA (Gemini)</Btn>
          {aiText && (
            <div style={{ marginTop: 12, padding: "16px 20px", background: "linear-gradient(135deg,#EFF6FF,#F0FDF4)", borderRadius: 14, fontSize: 14, lineHeight: 1.7, color: "#1E293B", border: "1.5px solid #BFDBFE" }}>
              <div style={{ fontWeight: 700, color: "#1D4ED8", marginBottom: 8, fontSize: 13 }}>🧠 Analyse IA</div>
              {aiText}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── CONVERSION ──────────────────────────────────────────────────────────────
const CONVERSIONS = [
  { label: "Glucose", from: "g/L", to: "mmol/L", factor: 5.55 },
  { label: "Glucose", from: "mmol/L", to: "g/L", factor: 0.18 },
  { label: "Créatinine", from: "mg/dL", to: "µmol/L", factor: 88.4 },
  { label: "Créatinine", from: "µmol/L", to: "mg/dL", factor: 0.0113 },
  { label: "Urée", from: "g/L", to: "mmol/L", factor: 16.65 },
  { label: "Urée", from: "mmol/L", to: "g/L", factor: 0.06 },
  { label: "Cholestérol", from: "g/L", to: "mmol/L", factor: 2.586 },
  { label: "Cholestérol", from: "mmol/L", to: "g/L", factor: 0.387 },
  { label: "Bilirubine", from: "mg/dL", to: "µmol/L", factor: 17.1 },
  { label: "Hémoglobine glyquée", from: "%", to: "mmol/mol", factor: 10.929 },
];

function ConversionCalc() {
  const [sel, setSel] = useState(0);
  const [val, setVal] = useState("");
  const conv = CONVERSIONS[sel];
  const result = val ? (parseFloat(val) * conv.factor).toFixed(3) : null;

  return (
    <div>
      <Input label="Type de conversion" value={sel} onChange={v => setSel(parseInt(v))}
        options={CONVERSIONS.map((c, i) => ({ value: i, label: `${c.label}: ${c.from} → ${c.to}` }))} />
      <Input label={`Valeur en ${conv.from}`} value={val} onChange={setVal} unit={conv.from} placeholder="0.00" />
      {result && (
        <ResultCard title={`${conv.label} en ${conv.to}`} value={result} unit={conv.to} level="normal">
          <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 6 }}>Facteur × {conv.factor}</p>
        </ResultCard>
      )}
    </div>
  );
}

// ─── ABOUT ────────────────────────────────────────────────────────────────────
function About() {
  return (
    <div>
      <div style={{ textAlign: "center", padding: "20px 0 28px" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg,#0B2545,#00B4D8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 16px" }}>🔬</div>
        <h2 style={{ color: "#0B2545", margin: 0, fontSize: 22 }}>MediCalc Pro</h2>
        <p style={{ color: "#64748B", fontSize: 14, marginTop: 4 }}>Calculateur médical intelligent</p>
      </div>
      <div style={{ background: "#F8FAFC", borderRadius: 16, padding: "20px 24px", marginBottom: 16 }}>
        <h3 style={{ color: "#0B2545", margin: "0 0 12px", fontSize: 16 }}>👨‍🔬 À propos du créateur</h3>
        <p style={{ color: "#334155", fontSize: 14, lineHeight: 1.8, margin: 0 }}>
          Étudiant en 2ᵉ année d'analyses médicales, passionné par l'intersection entre la biologie clinique et la technologie. 
          Ce projet est né d'une conviction simple : les outils de calcul médical doivent être <strong>rapides, accessibles et intelligents</strong>. 
          MediCalc Pro est conçu pour les étudiants, les techniciens de laboratoire, les infirmiers et les médecins qui cherchent 
          à interpréter des résultats biologiques avec précision et sans perte de temps.
        </p>
      </div>
      <div style={{ background: "#F8FAFC", borderRadius: 16, padding: "20px 24px", marginBottom: 16 }}>
        <h3 style={{ color: "#0B2545", margin: "0 0 12px", fontSize: 16 }}>⚙️ Technologies</h3>
        {[
          ["Frontend", "React + Vite — déployé sur Netlify / Vercel"],
          ["Backend", "FastAPI (Python) — déployé sur Render"],
          ["Base de données", "Supabase (PostgreSQL)"],
          ["Intelligence artificielle", "Google Gemini 1.5 Flash API"],
          ["Génération PDF", "ReportLab (Python)"],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
            <span style={{ fontWeight: 700, color: "#00B4D8", minWidth: 120, fontSize: 13 }}>{k}</span>
            <span style={{ color: "#475569", fontSize: 13 }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ background: "#EFF6FF", borderRadius: 16, padding: "16px 24px", border: "1.5px solid #BFDBFE" }}>
        <h3 style={{ color: "#1D4ED8", margin: "0 0 8px", fontSize: 15 }}>📱 Contact</h3>
        <a href="https://wa.me/237687692456" target="_blank" rel="noreferrer"
          style={{ color: "#25D366", fontWeight: 700, textDecoration: "none", fontSize: 15 }}>
          💬 WhatsApp : +237 687 692 456
        </a>
        <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 6 }}>⚕️ Usage éducatif — ne remplace pas un avis médical professionnel.</p>
      </div>
    </div>
  );
}

// ─── APP SHELL ────────────────────────────────────────────────────────────────
export default function App() {
  const [active, setActive] = useState("nfs");

  const panels = { imc: <ImcCalc />, cockcroft: <CockcroftCalc />, perfusion: <PerfusionCalc />, gestationnel: <GestCalc />, nfs: <NfsCalc />, conversion: <ConversionCalc />, about: <About /> };
  const cur = TOOLS.find(t => t.id === active);

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: "#F0F4F8", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={{ background: "linear-gradient(135deg,#0B2545 0%,#164e7a 60%,#00B4D8 100%)", padding: "18px 20px 14px", color: "#fff" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 24 }}>🩺</span>
              <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: -0.5 }}>MediCalc Pro</span>
            </div>
            <div style={{ fontSize: 11, color: "#93C5FD", marginTop: 2, marginLeft: 34 }}>Calculateur médical intelligent</div>
          </div>
          <div style={{ background: "rgba(255,255,255,.15)", borderRadius: 99, padding: "4px 12px", fontSize: 11, color: "#E0F2FE" }}>v1.0</div>
        </div>
      </header>

      {/* Nav tabs — horizontal scroll */}
      <nav style={{ background: "#fff", borderBottom: "1.5px solid #E2E8F0", overflowX: "auto", whiteSpace: "nowrap" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex" }}>
          {TOOLS.map(t => (
            <button key={t.id} onClick={() => setActive(t.id)}
              style={{ border: "none", background: "transparent", padding: "12px 14px", cursor: "pointer", fontSize: 13, fontWeight: active === t.id ? 700 : 500, color: active === t.id ? "#00B4D8" : "#64748B", borderBottom: active === t.id ? "2.5px solid #00B4D8" : "2.5px solid transparent", transition: "all .15s", display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 72 }}>
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main */}
      <main style={{ flex: 1, maxWidth: 640, width: "100%", margin: "0 auto", padding: "24px 16px 40px" }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0B2545" }}>{cur?.icon} {cur?.label}</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748B" }}>{cur?.desc}</p>
        </div>
        {panels[active]}
      </main>

      {/* Footer */}
      <footer style={{ textAlign: "center", padding: "16px", fontSize: 11, color: "#94A3B8", borderTop: "1px solid #E2E8F0", background: "#fff" }}>
        ⚕️ Usage éducatif uniquement — ne remplace pas un diagnostic médical
      </footer>
    </div>
  );
}
