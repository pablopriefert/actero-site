#!/usr/bin/env python3
"""Generate the Actero end-to-end test checklist PDF (brand-styled)."""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table,
    TableStyle, NextPageTemplate, PageBreak,
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER
import datetime

# ── Brand palette ────────────────────────────────────────────────────
GREEN = colors.HexColor("#003725")
OLIVE = colors.HexColor("#A8C490")
CREAM = colors.HexColor("#F9F7F1")
INK = colors.HexColor("#1A1A1A")
MUTED = colors.HexColor("#71717A")
LINE = colors.HexColor("#E5E3DC")
RED = colors.HexColor("#DC2626")
AMBER = colors.HexColor("#D97706")

OUT = "Actero-Test-Checklist-E2E.pdf"

styles = getSampleStyleSheet()

def S(name, **kw):
    base = kw.pop("parent", styles["Normal"])
    return ParagraphStyle(name, parent=base, **kw)

st_title = S("t", fontName="Helvetica-Bold", fontSize=26, textColor=GREEN, leading=30)
st_sub = S("s", fontName="Helvetica", fontSize=11, textColor=MUTED, leading=16)
st_h2 = S("h2", fontName="Helvetica-Bold", fontSize=14, textColor=GREEN, leading=18,
          spaceBefore=18, spaceAfter=4)
st_h2num = S("h2n", fontName="Helvetica-Bold", fontSize=14, textColor=OLIVE, leading=18)
st_secnote = S("sn", fontName="Helvetica-Oblique", fontSize=9, textColor=MUTED, leading=13,
               spaceAfter=6)
st_item = S("it", fontName="Helvetica", fontSize=9.5, textColor=INK, leading=13)
st_exp = S("ex", fontName="Helvetica-Oblique", fontSize=8.5, textColor=MUTED, leading=12)
st_body = S("b", fontName="Helvetica", fontSize=10, textColor=INK, leading=15)
st_tag = S("tg", fontName="Helvetica-Bold", fontSize=7, textColor=colors.white,
           alignment=TA_CENTER, leading=9)
st_foot = S("f", fontName="Helvetica", fontSize=8, textColor=MUTED)

PAGE_W, PAGE_H = A4
MARGIN = 16 * mm


def header_footer(canvas, doc):
    canvas.saveState()
    # top brand bar
    canvas.setFillColor(GREEN)
    canvas.rect(0, PAGE_H - 10 * mm, PAGE_W, 10 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawString(MARGIN, PAGE_H - 7 * mm, "ACTERO")
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - 7 * mm,
                           "Checklist de test end-to-end")
    # footer
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, 12 * mm, PAGE_W - MARGIN, 12 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(MARGIN, 8 * mm,
                      "Confidentiel — usage interne Actero")
    canvas.drawRightString(PAGE_W - MARGIN, 8 * mm, f"Page {doc.page}")
    canvas.restoreState()


def tag(text, color):
    t = Table([[Paragraph(text, st_tag)]], colWidths=[20 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), color),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("ROUNDEDCORNERS", [3, 3, 3, 3]),
    ]))
    return t


def checklist(rows):
    """rows: list of (action, expected, severity) -> Table with checkbox col."""
    data = []
    for action, expected, sev in rows:
        sev_color = {"BLOQUANT": RED, "IMPORTANT": AMBER, "STANDARD": OLIVE}[sev]
        cell = [Paragraph(f"<b>{action}</b>", st_item)]
        if expected:
            cell.append(Paragraph(f"Attendu : {expected}", st_exp))
        inner = Table([[c] for c in cell], colWidths=[118 * mm])
        inner.setStyle(TableStyle([
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ]))
        data.append(["", inner, tag(sev, sev_color)])
    t = Table(data, colWidths=[9 * mm, 120 * mm, 22 * mm])
    style = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
        ("LEFTPADDING", (1, 0), (1, -1), 4),
    ]
    # draw the checkbox square in col 0
    for i in range(len(data)):
        style.append(("BOX", (0, i), (0, i), 0, colors.white))
    t.setStyle(TableStyle(style))
    # overlay real checkbox via a nested table per row
    data2 = []
    for action, expected, sev in rows:
        sev_color = {"BLOQUANT": RED, "IMPORTANT": AMBER, "STANDARD": OLIVE}[sev]
        box = Table([[""]], colWidths=[4.5 * mm], rowHeights=[4.5 * mm])
        box.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.8, GREEN),
            ("ROUNDEDCORNERS", [1, 1, 1, 1]),
        ]))
        cell = [Paragraph(f"<b>{action}</b>", st_item)]
        if expected:
            cell.append(Paragraph(f"<i>Attendu :</i> {expected}", st_exp))
        inner = Table([[c] for c in cell], colWidths=[116 * mm])
        inner.setStyle(TableStyle([
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ]))
        data2.append([box, inner, tag(sev, sev_color)])
    t2 = Table(data2, colWidths=[10 * mm, 119 * mm, 22 * mm])
    t2.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
    ]))
    return t2


def section(story, num, title, note, rows):
    head = Table([[Paragraph(f"{num}", st_h2num), Paragraph(title, st_h2)]],
                 colWidths=[12 * mm, 150 * mm])
    head.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(head)
    if note:
        story.append(Paragraph(note, st_secnote))
    story.append(checklist(rows))


# ── Build document ───────────────────────────────────────────────────
doc = BaseDocTemplate(OUT, pagesize=A4,
                      leftMargin=MARGIN, rightMargin=MARGIN,
                      topMargin=16 * mm, bottomMargin=16 * mm)
frame = Frame(MARGIN, 14 * mm, PAGE_W - 2 * MARGIN, PAGE_H - 30 * mm, id="main")
doc.addPageTemplates([PageTemplate(id="all", frames=[frame],
                                   onPage=header_footer)])

story = []

# Cover block
story.append(Spacer(1, 8 * mm))
story.append(Paragraph("Checklist de test end-to-end", st_title))
story.append(Spacer(1, 3 * mm))
story.append(Paragraph(
    "Parcours complet d'un nouveau marchand : du signup au premier ticket "
    "résolu par l'agent IA, jusqu'à l'usage quotidien du dashboard. "
    "À exécuter sur une <b>vraie boutique Shopify de dev</b> avant toute démo "
    "prospect.", st_body))
story.append(Spacer(1, 4 * mm))

legend = Table([[
    tag("BLOQUANT", RED),
    Paragraph("casse le parcours — à corriger avant toute démo", st_exp),
], [
    tag("IMPORTANT", AMBER),
    Paragraph("dégrade fortement l'expérience", st_exp),
], [
    tag("STANDARD", OLIVE),
    Paragraph("polish / vérification de cohérence", st_exp),
]], colWidths=[24 * mm, 130 * mm])
legend.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("TOPPADDING", (0, 0), (-1, -1), 3),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
]))
story.append(legend)
story.append(Spacer(1, 2 * mm))
story.append(Paragraph(
    f"Généré le {datetime.date.today().strftime('%d/%m/%Y')} · "
    "Coche chaque case au fur et à mesure. Note le commit testé en haut.",
    st_secnote))

# ── Section 0 — Prérequis ───────────────────────────────────────────
section(story, "0", "Prérequis avant de tester",
        "À faire une seule fois pour préparer l'environnement de test.",
        [
 ("Créer une boutique Shopify de développement (Partners -> dev store), avec quelques produits + 2-3 commandes de test",
  "Boutique accessible, produits visibles", "BLOQUANT"),
 ("Vérifier les variables d'env Vercel : SUPABASE_*, SHOPIFY_*, ANTHROPIC_API_KEY, RESEND_*, E2B_API_KEY",
  "Aucune absente — sinon le parcours casse en silence", "BLOQUANT"),
 ("(Voice, optionnel) ELEVENLABS_API_KEY, ELEVENLABS_DEFAULT_VOICE_ID, VOICE_LLM_SECRET, PUBLIC_API_URL, ELEVENLABS_WEBHOOK_SECRET",
  "Set si tu testes le canal voice", "STANDARD"),
 ("Confirmer que le dernier deploy Vercel est READY (pas BUILDING/ERROR)",
  "Build vert sur le commit testé", "BLOQUANT"),
        ])

# ── Section 1 — Signup ──────────────────────────────────────────────
section(story, "1", "Signup",
        "Depuis la homepage. Tester les deux chemins (Google + email).",
        [
 ("Cliquer le CTA hero « Essai gratuit 7 jours » -> arrive sur /signup",
  "Pas de 404, page signup chargée", "BLOQUANT"),
 ("Le bouton Google OAuth est AU-DESSUS du formulaire email",
  "Ordre correct (1-clic visible en premier)", "STANDARD"),
 ("Signup par email : un seul champ mot de passe + eye-toggle fonctionnel (pas de champ « confirmer »)",
  "Toggle masque/affiche, pas de double saisie", "IMPORTANT"),
 ("Saisir un email déjà existant -> message + lien inline « Se connecter avec cet email »",
  "Lien pré-remplit l'email sur /login", "IMPORTANT"),
 ("Recevoir le code 6 chiffres par email, le coller -> auto-avance entre cases",
  "Code accepté, compte créé", "BLOQUANT"),
 ("Cliquer « Renvoyer le code » -> cooldown 30s avec compte à rebours visible",
  "Bouton désactivé 30s, label décompte", "STANDARD"),
 ("Après vérif -> redirection directe vers /client (pas d'étape plan forcée)",
  "Arrive sur le dashboard", "BLOQUANT"),
 ("Burst confetti au premier paint /client (compte < 60s), une seule fois",
  "Confetti joue puis disparaît, pas bloquant", "STANDARD"),
        ])

# ── Section 2 — Onboarding Shopify ──────────────────────────────────
section(story, "2", "Onboarding & connexion Shopify",
        "Le cœur du time-to-first-value. Tester aussi le chemin d'échec.",
        [
 ("Dashboard en setup mode : hero « Connecter ma boutique Shopify » visible + checklist /4 étapes (pas /7)",
  "Dénomination cohérente partout = /4", "IMPORTANT"),
 ("La conversation mock animée s'affiche dans la grille setup et boucle",
  "4 messages apparaissent, loop ~8s", "STANDARD"),
 ("Lancer la connexion Shopify OAuth -> callback -> redirige vers /client (PAS /login)",
  "Pas de re-login forcé", "BLOQUANT"),
 ("Page ShopifySuccess : fond crème (pas noir #030303), couleurs marque",
  "Cohérence visuelle avec le reste", "STANDARD"),
 ("OnboardingProgress s'affiche, le job E2B tire produits/clients/commandes en fond",
  "Barre de progression avance", "BLOQUANT"),
 ("La carte « Activer mes automations » reste cachée tant que l'onboarding n'est pas fini",
  "Pas de dissonance progress vs activer", "IMPORTANT"),
 ("Simuler un échec (couper le job / sandbox) -> état « Réessayer la synchronisation » + alerte Slack interne",
  "Marchand jamais bloqué en silence", "BLOQUANT"),
 ("Cliquer « Réessayer » -> relance le job (gère le 409 dédupe)",
  "Nouveau job ou réutilise l'existant", "IMPORTANT"),
        ])

# ── Section 3 — Widget & premier ticket IA ──────────────────────────
section(story, "3", "Widget sur la boutique & premier ticket IA",
        "La promesse produit. C'est LE moment « wow » à vérifier absolument.",
        [
 ("Le widget est injecté dans le thème Shopify avec une vraie clé (wak_...), pas le client_id UUID",
  "data-actero-key = clé rotative", "IMPORTANT"),
 ("Ouvrir la boutique, envoyer « où est ma commande #1001 ? » dans le widget",
  "Réponse IA pertinente en < 10s", "BLOQUANT"),
 ("La réponse utilise la knowledge base / playbook du client (ton de marque)",
  "Pas de réponse générique LLM", "BLOQUANT"),
 ("Tester un cas à faible confiance -> escalade propre (pas de réponse inventée)",
  "Escalade créée, message d'attente", "IMPORTANT"),
 ("Widget sur compte inactif -> bloqué proprement (403, message clair)",
  "Pas de traitement pour client inactif", "STANDARD"),
 ("La conversation apparaît dans le dashboard (Escalades / Conversations) en < 45s",
  "Temps réel cohérent", "IMPORTANT"),
        ])

# ── Section 4 — Dashboard quotidien ─────────────────────────────────
section(story, "4", "Dashboard — usage quotidien",
        "Ce que le marchand voit tous les jours une fois onboardé.",
        [
 ("Vue d'ensemble : KPIs réels (pas 0 figé), section « Depuis ta dernière visite » à jour",
  "Skeletons au chargement, pas de flash 0", "IMPORTANT"),
 ("Sidebar : « Paramètres » est un lien direct, « Canaux » contient Agent vocal / Appels",
  "Pas d'expandable à 1 enfant", "STANDARD"),
 ("Escalades : filtres date (Aujourd'hui/7j/30j/Tout) fonctionnels",
  "La liste se filtre correctement", "STANDARD"),
 ("Tooltip « Confiance de l'IA » au survol du badge de score",
  "Texte d'aide visible", "STANDARD"),
 ("Pill « Tester » persistante en topbar -> ouvre le simulateur",
  "Accès direct au test agent", "STANDARD"),
 ("Boutons d'enregistrement : libellé « Enregistrer » partout (KB, intégrations, escalades)",
  "Pas de Sauvegarder/Save mélangés", "STANDARD"),
 ("Accents FR corrects partout (Créez, Résolu, réponse) — aucun mot sans accent",
  "Aucune coquille visible", "STANDARD"),
 ("Empty states avec voix humaine (KB vide, templates, escalades résolues)",
  "Ton chaleureux, pas « aucune donnée »", "STANDARD"),
        ])

# ── Section 5 — Voice (optionnel) ───────────────────────────────────
section(story, "5", "Agent vocal — Phase 0 (optionnel)",
        "Seulement si les env ElevenLabs sont configurées.",
        [
 ("Canaux -> Agent vocal accessible depuis la sidebar",
  "Plus caché de la navigation", "IMPORTANT"),
 ("Activer l'agent -> setup-agent crée l'agent ElevenLabs avec le custom-LLM URL",
  "Agent provisionné, pas d'erreur 503", "IMPORTANT"),
 ("Le greeting par défaut contient la mention légale d'enregistrement (CNIL)",
  "« cet appel peut être enregistré... »", "BLOQUANT"),
 ("Changer voix + greeting -> réellement appliqué (pas de no-op silencieux)",
  "update-agent reçoit voice_id/greeting", "IMPORTANT"),
 ("« Tester en navigateur » -> conversation WebRTC fonctionnelle",
  "L'agent répond à la voix", "STANDARD"),
 ("Bouton « Obtenir un numéro français (1 clic) » présent (si Twilio configuré)",
  "Erreur serveur lisible si non configuré", "STANDARD"),
        ])

# ── Section 6 — Billing ─────────────────────────────────────────────
section(story, "6", "Billing & upgrade Stripe",
        "Tester en mode Stripe test.",
        [
 ("Upgrade depuis le dashboard -> Stripe Checkout -> retour /success",
  "Plan mis à jour, pas de re-login", "BLOQUANT"),
 ("La row clients reçoit plan + stripe_subscription_id même si le retrieve échoue",
  "Upgrade atomique (sub_id depuis session)", "IMPORTANT"),
 ("Webhook idempotent : rejouer l'event ne crée pas de doublon",
  "200 duplicate, pas de double onboard", "IMPORTANT"),
        ])

# ── Section 7 — Fiabilité & observabilité ───────────────────────────
section(story, "7", "Fiabilité & observabilité",
        "Vérifier que tu n'es plus aveugle en prod.",
        [
 ("Déclencher une erreur volontaire sur un endpoint -> l'issue apparaît dans Sentry",
  "Capture confirmée (root cause fixé)", "BLOQUANT"),
 ("Vérifier les logs Vercel : aucun cron en échec répété (process-e2b-jobs, etc.)",
  "Crons 200, pas de 500 en boucle", "IMPORTANT"),
 ("Spammer un endpoint public (gorgias-cost-pdf, referral) -> 429 après la limite",
  "Rate-limit actif", "STANDARD"),
        ])

# ── Section 8 — Surface marketing ───────────────────────────────────
section(story, "8", "Surface marketing publique",
        "Ce que voit un prospect avant de signer.",
        [
 ("Homepage : nouvelle accroche « Ne répondez plus jamais à où est ma commande ? »",
  "Hiérarchie visuelle correcte", "STANDARD"),
 ("Tous les CTA mènent à un endroit valide (plus de /audit — repointé /signup)",
  "Aucun lien mort, aucun 404", "BLOQUANT"),
 ("Aucun témoignage « [À compléter] », aucun aggregateRating fabriqué, aucun faux 800€",
  "Zéro claim bidon", "IMPORTANT"),
 ("KPI résolution = 82% partout (jamais 60/94 incohérents)",
  "Chiffre unique cohérent", "STANDARD"),
 ("Footer : tous les liens fonctionnent (plus de 14 liens cassés)",
  "Navigation propre", "STANDARD"),
 ("Mobile : hero lisible, pas d'overflow de la preview dashboard",
  "Rendu mobile propre < 768px", "IMPORTANT"),
        ])

story.append(Spacer(1, 8 * mm))
story.append(Paragraph(
    "Critère de sortie : <b>zéro BLOQUANT non coché</b> avant de montrer le "
    "produit à un prospect. Les IMPORTANT doivent être traités avant le "
    "lancement App Store / cold campaign.", st_body))

doc.build(story)
print("OK ->", OUT)
