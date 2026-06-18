"""
MediCalc Pro — Backend FastAPI
Déployable sur Render (Free tier)
Variables d'env requises :
  GEMINI_API_KEY    — Google AI Studio (gratuit)
  SUPABASE_URL      — URL de votre projet Supabase
  SUPABASE_KEY      — anon/service key Supabase
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import httpx
import os
import json
from datetime import datetime, date
from io import BytesIO

# PDF
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from fastapi.responses import StreamingResponse

# Supabase
from supabase import create_client, Client

app = FastAPI(title="MediCalc Pro API", version="1.0.0")

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Remplacer par votre domaine en production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Clients ───────────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
SUPABASE_URL   = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY   = os.getenv("SUPABASE_KEY", "")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL else None


# ═══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════

class ImcRequest(BaseModel):
    poids: float        # kg
    taille: float       # cm

class CockcroftRequest(BaseModel):
    age: int
    poids: float
    creatinine: float   # mg/dL
    sexe: str           # "M" ou "F"

class PerfusionRequest(BaseModel):
    volume: float       # mL
    duree: float        # heures
    facteur: int = 20   # gtt/mL

class GestRequest(BaseModel):
    ddr: date           # Date des dernières règles

class NfsRequest(BaseModel):
    hb: Optional[float] = None
    gb: Optional[float] = None
    plt: Optional[float] = None
    vgm: Optional[float] = None
    tcmh: Optional[float] = None
    hematocrite: Optional[float] = None
    sexe: str = "M"

class NfsInterpretRequest(BaseModel):
    values: str
    sexe: str = "M"

class ConversionRequest(BaseModel):
    valeur: float
    from_unit: str
    to_unit: str
    analyte: str

class PdfRequest(BaseModel):
    patient: Optional[str] = "Anonyme"
    calcul: str
    resultats: dict
    interpretation: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def classify(val, low, high):
    if val < low:
        return "low" if val > low * 0.6 else "critical"
    if val > high:
        return "high" if val < high * 1.5 else "critical"
    return "normal"


async def gemini_ask(prompt: str) -> str:
    """Appel à l'API Gemini 1.5 Flash."""
    if not GEMINI_API_KEY:
        return "⚠️ Clé API Gemini non configurée."
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 800}
    }
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


def save_to_supabase(table: str, data: dict):
    """Sauvegarde optionnelle dans Supabase."""
    if supabase:
        try:
            supabase.table(table).insert({**data, "created_at": datetime.utcnow().isoformat()}).execute()
        except Exception as e:
            print(f"Supabase error: {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS CALCULS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/")
def root():
    return {"message": "MediCalc Pro API 🩺", "version": "1.0.0", "status": "ok"}


@app.post("/api/imc")
def calc_imc(req: ImcRequest):
    taille_m = req.taille / 100
    imc = req.poids / (taille_m ** 2)

    if imc < 16:
        niveau, interpretation = "critical", "Dénutrition sévère"
    elif imc < 18.5:
        niveau, interpretation = "low", "Insuffisance pondérale"
    elif imc < 25:
        niveau, interpretation = "normal", "Poids normal"
    elif imc < 30:
        niveau, interpretation = "elevated", "Surpoids"
    elif imc < 35:
        niveau, interpretation = "high", "Obésité modérée (Classe I)"
    elif imc < 40:
        niveau, interpretation = "high", "Obésité sévère (Classe II)"
    else:
        niveau, interpretation = "critical", "Obésité morbide (Classe III)"

    result = {"imc": round(imc, 1), "niveau": niveau, "interpretation": interpretation}
    save_to_supabase("calculs_imc", {**result, "poids": req.poids, "taille": req.taille})
    return result


@app.post("/api/cockcroft")
def calc_cockcroft(req: CockcroftRequest):
    cl = ((140 - req.age) * req.poids) / (72 * req.creatinine)
    if req.sexe == "F":
        cl *= 0.85
    cl = round(cl, 1)

    if cl >= 90:
        stade, niveau = "G1 — Fonction rénale normale", "normal"
    elif cl >= 60:
        stade, niveau = "G2 — Légèrement diminuée", "elevated"
    elif cl >= 45:
        stade, niveau = "G3a — Modérément diminuée", "high"
    elif cl >= 30:
        stade, niveau = "G3b — Sévèrement modérée", "high"
    elif cl >= 15:
        stade, niveau = "G4 — Sévèrement diminuée", "critical"
    else:
        stade, niveau = "G5 — Insuffisance rénale terminale", "critical"

    result = {"clairance_ml_min": cl, "stade": stade, "niveau": niveau}
    save_to_supabase("calculs_cockcroft", {**result, **req.dict()})
    return result


@app.post("/api/perfusion")
def calc_perfusion(req: PerfusionRequest):
    gouttes_min = (req.volume * req.facteur) / (req.duree * 60)
    ml_heure = req.volume / req.duree
    return {
        "gouttes_par_minute": round(gouttes_min, 0),
        "ml_par_heure": round(ml_heure, 1),
        "volume_total": req.volume,
        "duree_heures": req.duree,
    }


@app.post("/api/gestationnel")
def calc_gestationnel(req: GestRequest):
    today = date.today()
    diff = (today - req.ddr).days
    if diff < 0:
        raise HTTPException(400, "La DDR ne peut pas être dans le futur")
    sa = diff // 7
    jours = diff % 7
    from datetime import timedelta
    dpa = req.ddr + timedelta(days=280)

    if sa < 37:
        statut, niveau = "Prématuré", "elevated"
    elif sa <= 42:
        statut, niveau = "À terme", "normal"
    else:
        statut, niveau = "Post-terme", "high"

    return {
        "semaines_amenorrhee": sa,
        "jours_supplementaires": jours,
        "affichage": f"{sa} SA + {jours} j",
        "date_prevue_accouchement": dpa.isoformat(),
        "statut": statut,
        "niveau": niveau,
    }


@app.post("/api/nfs")
def calc_nfs(req: NfsRequest):
    ref = {
        "hb":          {"M": (13.5, 17.5), "F": (12.0, 16.0), "unit": "g/dL",   "label": "Hémoglobine"},
        "gb":          {"M": (4000, 10000), "F": (4000, 10000),"unit": "/mm³",   "label": "Globules blancs"},
        "plt":         {"M": (150000, 400000), "F": (150000, 400000), "unit": "/mm³", "label": "Plaquettes"},
        "vgm":         {"M": (80, 100), "F": (80, 100),         "unit": "fL",    "label": "VGM"},
        "tcmh":        {"M": (27, 33),  "F": (27, 33),          "unit": "pg",    "label": "TCMH"},
        "hematocrite": {"M": (40, 52),  "F": (36, 46),          "unit": "%",     "label": "Hématocrite"},
    }
    resultats = {}
    anomalies = []
    for key, meta in ref.items():
        val = getattr(req, key)
        if val is None:
            continue
        low, high = meta[req.sexe]
        niveau = classify(val, low, high)
        resultats[key] = {
            "valeur": val,
            "unite": meta["unit"],
            "label": meta["label"],
            "niveau": niveau,
            "reference": f"{low}–{high} {meta['unit']}",
        }
        if niveau != "normal":
            anomalies.append(f"{meta['label']} {niveau} ({val} {meta['unit']})")

    interpretation_auto = ""
    if req.hb is not None:
        hb = req.hb
        low, high = ref["hb"][req.sexe]
        if hb < low:
            if hb < 7:
                interpretation_auto += "Anémie sévère. "
            elif hb < 10:
                interpretation_auto += "Anémie modérée. "
            else:
                interpretation_auto += "Anémie légère. "
        if req.vgm is not None:
            if req.vgm < 80:
                interpretation_auto += "Anémie microcytaire (carence martiale ?). "
            elif req.vgm > 100:
                interpretation_auto += "Anémie macrocytaire (B12/folates ?). "

    if req.gb is not None:
        if req.gb > 10000:
            interpretation_auto += "Hyperleucocytose (infection/inflammation ?). "
        elif req.gb < 4000:
            interpretation_auto += "Leucopénie. "

    if req.plt is not None:
        if req.plt < 150000:
            interpretation_auto += "Thrombopénie" + (" sévère." if req.plt < 50000 else " légère à modérée.") + " "
        elif req.plt > 400000:
            interpretation_auto += "Thrombocytose. "

    result = {
        "resultats": resultats,
        "anomalies": anomalies,
        "interpretation_auto": interpretation_auto.strip() or "Tous les paramètres dans les limites normales.",
        "sexe": req.sexe,
    }
    save_to_supabase("calculs_nfs", {"anomalies": json.dumps(anomalies), "sexe": req.sexe, "interpretation": interpretation_auto})
    return result


# ── IA Interprétation NFS ─────────────────────────────────────────────────────
@app.post("/api/interpret-nfs")
async def interpret_nfs_ai(req: NfsInterpretRequest):
    prompt = f"""Tu es un biologiste médical expert. Voici les résultats NFS d'un patient (sexe: {req.sexe}) :

{req.values}

Donne une interprétation clinique structurée en 3–5 phrases maximum :
1. Résumé des anomalies principales
2. Orientations diagnostiques probables
3. Examens complémentaires suggérés

Réponds directement en français, de façon concise et professionnelle. Pas de listes à puces, uniquement du texte fluide."""

    try:
        interpretation = await gemini_ask(prompt)
        return {"interpretation": interpretation}
    except Exception as e:
        raise HTTPException(500, f"Erreur API Gemini: {str(e)}")


# ── Conversion unités ─────────────────────────────────────────────────────────
FACTEURS = {
    ("glucose", "g/L", "mmol/L"): 5.55,
    ("glucose", "mmol/L", "g/L"): 0.18,
    ("creatinine", "mg/dL", "µmol/L"): 88.4,
    ("creatinine", "µmol/L", "mg/dL"): 0.0113,
    ("uree", "g/L", "mmol/L"): 16.65,
    ("uree", "mmol/L", "g/L"): 0.06,
    ("cholesterol", "g/L", "mmol/L"): 2.586,
    ("cholesterol", "mmol/L", "g/L"): 0.387,
}

@app.post("/api/conversion")
def convert_unit(req: ConversionRequest):
    key = (req.analyte.lower(), req.from_unit, req.to_unit)
    facteur = FACTEURS.get(key)
    if facteur is None:
        raise HTTPException(400, "Conversion non supportée")
    return {
        "valeur_convertie": round(req.valeur * facteur, 4),
        "from_unit": req.from_unit,
        "to_unit": req.to_unit,
        "facteur": facteur,
    }


# ── Génération PDF ─────────────────────────────────────────────────────────────
@app.post("/api/generate-pdf")
def generate_pdf(req: PdfRequest):
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    story = []

    # Titre
    title_style = ParagraphStyle("title", parent=styles["Title"], textColor=colors.HexColor("#0B2545"), fontSize=20, spaceAfter=12)
    story.append(Paragraph("🩺 MediCalc Pro — Rapport de Calcul Médical", title_style))
    story.append(Paragraph(f"Patient : {req.patient} — {datetime.now().strftime('%d/%m/%Y %H:%M')}", styles["Normal"]))
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph(f"Type de calcul : <b>{req.calcul}</b>", styles["Normal"]))
    story.append(Spacer(1, 0.5*cm))

    # Tableau résultats
    data = [["Paramètre", "Valeur", "Statut"]]
    for k, v in req.resultats.items():
        if isinstance(v, dict):
            data.append([v.get("label", k), f"{v.get('valeur', '')} {v.get('unite', '')}", v.get("niveau", "")])
        else:
            data.append([k, str(v), ""])

    table = Table(data, colWidths=[7*cm, 5*cm, 5*cm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0B2545")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F0F4F8")]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(table)

    # Interprétation IA
    if req.interpretation:
        story.append(Spacer(1, 0.5*cm))
        story.append(Paragraph("Interprétation IA (Gemini)", ParagraphStyle("h2", parent=styles["Heading2"], textColor=colors.HexColor("#1D4ED8"))))
        story.append(Paragraph(req.interpretation, styles["Normal"]))

    story.append(Spacer(1, 1*cm))
    story.append(Paragraph("⚕️ Ce rapport est généré à titre éducatif et ne remplace pas un avis médical professionnel.", ParagraphStyle("disclaimer", parent=styles["Normal"], fontSize=8, textColor=colors.gray)))

    doc.build(story)
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=medicalc_rapport_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"})


# ═══════════════════════════════════════════════════════════════════════════════
# VALEURS DE REFERENCE
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/references")
def get_references():
    return {
        "nfs": {
            "adulte_masculin": {
                "hemoglobine": {"min": 13.5, "max": 17.5, "unite": "g/dL"},
                "globules_blancs": {"min": 4000, "max": 10000, "unite": "/mm³"},
                "plaquettes": {"min": 150000, "max": 400000, "unite": "/mm³"},
                "hematocrite": {"min": 40, "max": 52, "unite": "%"},
                "vgm": {"min": 80, "max": 100, "unite": "fL"},
                "tcmh": {"min": 27, "max": 33, "unite": "pg"},
            },
            "adulte_feminin": {
                "hemoglobine": {"min": 12, "max": 16, "unite": "g/dL"},
                "globules_blancs": {"min": 4000, "max": 10000, "unite": "/mm³"},
                "plaquettes": {"min": 150000, "max": 400000, "unite": "/mm³"},
                "hematocrite": {"min": 36, "max": 46, "unite": "%"},
                "vgm": {"min": 80, "max": 100, "unite": "fL"},
                "tcmh": {"min": 27, "max": 33, "unite": "pg"},
            },
        },
        "biochimie": {
            "glucose_a_jeun": {"min": 0.7, "max": 1.10, "unite": "g/L"},
            "creatinine_M": {"min": 7, "max": 13, "unite": "mg/L"},
            "creatinine_F": {"min": 6, "max": 11, "unite": "mg/L"},
            "uree": {"min": 0.15, "max": 0.45, "unite": "g/L"},
        }
    }
