"""
PhishVision Report Generator — JSON, CSV, PDF export
"""
import io
import csv
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

logger = logging.getLogger("phishvision.reports")


def _verdict_color(verdict: str):
    """Return a reportlab color for a verdict string."""
    from reportlab.lib import colors
    return {
        "phishing":  colors.HexColor('#dc3545'),
        "suspicious": colors.HexColor('#fd7e14'),
        "safe":       colors.HexColor('#198754'),
    }.get(verdict, colors.HexColor('#6c757d'))


def _score_bar_drawing(score: float, width: float = 200, height: float = 10):
    """Return a ReportLab Drawing of a filled score bar."""
    from reportlab.graphics.shapes import Drawing, Rect
    from reportlab.lib import colors
    d = Drawing(width, height)
    # Background track
    d.add(Rect(0, 0, width, height, fillColor=colors.HexColor('#e9ecef'),
               strokeColor=None, rx=3, ry=3))
    # Fill
    fill_w = max(4, score * width)
    if score >= 0.7:
        fc = colors.HexColor('#dc3545')
    elif score >= 0.45:
        fc = colors.HexColor('#fd7e14')
    else:
        fc = colors.HexColor('#198754')
    d.add(Rect(0, 0, fill_w, height, fillColor=fc,
               strokeColor=None, rx=3, ry=3))
    return d


def generate_single_pdf_report(result: Dict) -> bytes:
    """
    Generate a detailed single-domain PDF report with score breakdown,
    URL features, WHOIS data, content analysis and visual analysis sections.
    """
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.platypus import (
            SimpleDocTemplate, Table, TableStyle, Paragraph,
            Spacer, HRFlowable, KeepTogether,
        )
        from reportlab.graphics.shapes import Drawing, Rect
        from reportlab.platypus.flowables import HRFlowable
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer, pagesize=A4,
            rightMargin=2*cm, leftMargin=2*cm,
            topMargin=2*cm, bottomMargin=2*cm,
        )
        styles = getSampleStyleSheet()
        W = A4[0] - 4*cm   # usable page width

        # ── Custom styles ──────────────────────────────────────────────────
        def sty(name, parent='Normal', **kw):
            return ParagraphStyle(name, parent=styles[parent], **kw)

        title_sty   = sty('PVTitle',    'Title',   fontSize=20, textColor=colors.HexColor('#1a1a2e'), spaceAfter=2)
        sub_sty     = sty('PVSub',                 fontSize=10, textColor=colors.HexColor('#64748b'), spaceAfter=2)
        h2_sty      = sty('PVH2',       'Heading2',fontSize=12, textColor=colors.HexColor('#16213e'), spaceBefore=14, spaceAfter=4)
        h3_sty      = sty('PVH3',                  fontSize=10, textColor=colors.HexColor('#334155'), spaceBefore=8, spaceAfter=3, fontName='Helvetica-Bold')
        normal_sty  = sty('PVNormal',              fontSize=9,  textColor=colors.HexColor('#334155'), spaceAfter=2)
        mono_sty    = sty('PVMono',                fontSize=8,  textColor=colors.HexColor('#475569'), fontName='Courier', spaceAfter=2)
        footer_sty  = sty('PVFooter',              fontSize=7,  textColor=colors.grey, alignment=TA_CENTER)
        label_sty   = sty('PVLabel',               fontSize=8,  textColor=colors.HexColor('#94a3b8'), spaceAfter=1)

        verdict      = result.get('verdict', 'unknown')
        overall      = result.get('overall_score', 0.0)
        domain       = result.get('domain', '')
        url          = result.get('url', '')
        brand        = result.get('target_brand') or '—'
        confidence   = result.get('confidence', '').capitalize()
        scan_time    = result.get('scanned_at', '')
        duration_ms  = result.get('scan_duration_ms', 0)

        whois   = result.get('whois_data') or {}
        dns     = result.get('dns_data') or {}
        content = result.get('content_features') or {}
        url_f   = result.get('url_features') or {}
        visual  = result.get('visual_features') or {}

        DARK  = colors.HexColor('#16213e')
        LIGHT = colors.HexColor('#f8fafc')
        vc    = _verdict_color(verdict)

        elems = []

        # ── Header ─────────────────────────────────────────────────────────
        elems.append(Paragraph("PhishVision AI", title_sty))
        elems.append(Paragraph("Domain Phishing Analysis Report", sub_sty))
        elems.append(Paragraph(
            f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}  |  "
            f"Scan duration: {duration_ms}ms",
            sub_sty,
        ))
        elems.append(HRFlowable(width='100%', thickness=1.5, color=DARK, spaceAfter=8))

        # ── Verdict banner ─────────────────────────────────────────────────
        banner_data = [[
            Paragraph(f"<b>{domain}</b>", sty('BDom', fontSize=13, textColor=colors.white)),
            Paragraph(f"<b>{verdict.upper()}</b>",
                      sty('BVerdict', fontSize=13, textColor=vc,
                          alignment=TA_RIGHT)),
        ]]
        banner = Table(banner_data, colWidths=[W*0.7, W*0.3])
        banner.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), DARK),
            ('PADDING', (0,0), (-1,-1), 10),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        elems.append(banner)
        elems.append(Spacer(1, 0.3*cm))

        # ── URL & meta info ────────────────────────────────────────────────
        meta_data = [
            ["Full URL",         url[:90] + ('…' if len(url) > 90 else '')],
            ["Target Brand",     brand],
            ["Confidence",       confidence],
            ["Scan Time",        str(scan_time)[:19].replace('T', ' ')],
        ]
        meta_table = Table(meta_data, colWidths=[3.5*cm, W - 3.5*cm])
        meta_table.setStyle(TableStyle([
            ('FONTSIZE',   (0,0), (-1,-1), 8),
            ('TEXTCOLOR',  (0,0), (0,-1),  colors.HexColor('#94a3b8')),
            ('TEXTCOLOR',  (1,0), (1,-1),  colors.HexColor('#1e293b')),
            ('FONTNAME',   (0,0), (0,-1),  'Helvetica-Bold'),
            ('FONTNAME',   (1,0), (1,-1),  'Helvetica'),
            ('ROWBACKGROUNDS', (0,0), (-1,-1),
             [colors.HexColor('#f1f5f9'), colors.white]),
            ('GRID',       (0,0), (-1,-1), 0.3, colors.HexColor('#e2e8f0')),
            ('PADDING',    (0,0), (-1,-1), 5),
        ]))
        elems.append(meta_table)
        elems.append(Spacer(1, 0.4*cm))

        # ── Score Breakdown ────────────────────────────────────────────────
        elems.append(Paragraph("Score Breakdown", h2_sty))

        scores = [
            ("Overall Phishing Score",  overall),
            ("URL Analysis",            result.get('url_score', 0)),
            ("WHOIS / DNS Intelligence",result.get('whois_score', 0)),
            ("Content Analysis",        result.get('content_score', 0)),
            ("Visual Similarity",       result.get('visual_score', 0)),
        ]

        score_rows = []
        for label, sc in scores:
            bar = _score_bar_drawing(sc, width=180, height=9)
            pct_color = '#dc3545' if sc >= 0.7 else '#fd7e14' if sc >= 0.45 else '#198754'
            score_rows.append([
                Paragraph(label, sty(f'SL{label}', fontSize=8,
                                     textColor=colors.HexColor('#334155'))),
                bar,
                Paragraph(f"<b>{sc:.0%}</b>",
                          sty(f'SP{label}', fontSize=9, fontName='Helvetica-Bold',
                              textColor=colors.HexColor(pct_color),
                              alignment=TA_RIGHT)),
            ])

        score_table = Table(score_rows, colWidths=[5.5*cm, 7*cm, 2*cm])
        score_table.setStyle(TableStyle([
            ('VALIGN',  (0,0), (-1,-1), 'MIDDLE'),
            ('PADDING', (0,0), (-1,-1), 5),
            ('ROWBACKGROUNDS', (0,0), (-1,-1),
             [colors.HexColor('#f8fafc'), colors.white]),
            ('LINEBELOW', (0,0), (-1,-2), 0.3, colors.HexColor('#e2e8f0')),
            # Bold border around overall row
            ('BOX', (0,0), (-1,0), 1, colors.HexColor('#cbd5e1')),
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
            ('FONTNAME', (0,0), (0,0), 'Helvetica-Bold'),
        ]))
        elems.append(score_table)
        elems.append(Spacer(1, 0.4*cm))

        # ── URL Features ───────────────────────────────────────────────────
        elems.append(Paragraph("URL Feature Analysis", h2_sty))

        flags = []
        if url_f.get('is_suspicious_tld'):       flags.append(('Suspicious TLD',         'red'))
        if url_f.get('is_ip_domain'):             flags.append(('IP as Domain',            'red'))
        if url_f.get('homoglyph_count', 0) > 0:  flags.append((f"Homoglyphs ({url_f['homoglyph_count']})", 'red'))
        if url_f.get('has_login_keyword'):        flags.append(('Login Keyword in URL',    'orange'))
        if url_f.get('has_url_shortener'):        flags.append(('URL Shortener Used',      'orange'))
        if url_f.get('has_redirect'):             flags.append(('Redirect Detected',       'orange'))
        if url_f.get('uses_https'):               flags.append(('HTTPS Present',           'green'))
        else:                                     flags.append(('No HTTPS',                'red'))
        if url_f.get('brand_keyword_in_subdomain'): flags.append(('Brand in Subdomain',   'red'))

        flag_color_map = {
            'red':    colors.HexColor('#dc3545'),
            'orange': colors.HexColor('#fd7e14'),
            'green':  colors.HexColor('#198754'),
        }

        url_feat_rows = [
            ["URL Length",          str(url_f.get('url_length', '—'))],
            ["Domain Length",       str(url_f.get('domain_length', '—'))],
            ["Domain Entropy",      str(url_f.get('domain_entropy', '—'))],
            ["Subdomains",          str(url_f.get('subdomain_count', '—'))],
            ["Hyphens in Domain",   str(url_f.get('hyphens_in_domain', '—'))],
            ["Special Chars (@)",   str(url_f.get('at_signs', '—'))],
            ["Digit Ratio",         f"{url_f.get('digit_ratio_in_domain', 0):.2f}"],
            ["TLD",                 str(url_f.get('tld', '—'))],
            ["Suspicious Keywords", str(url_f.get('suspicious_keyword_count', '—'))],
            ["Homoglyph Count",     str(url_f.get('homoglyph_count', '—'))],
            ["Closest Brand",       str(url_f.get('closest_brand') or '—')],
            ["Brand Edit Distance", str(url_f.get('min_brand_edit_distance', '—'))],
        ]

        # 2-column layout for URL features
        half = len(url_feat_rows) // 2
        left_rows = url_feat_rows[:half]
        right_rows = url_feat_rows[half:]

        def _mini_table(rows):
            t = Table(rows, colWidths=[3.8*cm, 2.6*cm])
            t.setStyle(TableStyle([
                ('FONTSIZE',   (0,0), (-1,-1), 8),
                ('TEXTCOLOR',  (0,0), (0,-1),  colors.HexColor('#94a3b8')),
                ('TEXTCOLOR',  (1,0), (1,-1),  colors.HexColor('#1e293b')),
                ('FONTNAME',   (0,0), (0,-1),  'Helvetica-Bold'),
                ('ROWBACKGROUNDS', (0,0), (-1,-1),
                 [colors.HexColor('#f8fafc'), colors.white]),
                ('GRID',       (0,0), (-1,-1), 0.3, colors.HexColor('#e2e8f0')),
                ('PADDING',    (0,0), (-1,-1), 4),
            ]))
            return t

        side_by_side = Table(
            [[_mini_table(left_rows), _mini_table(right_rows)]],
            colWidths=[W*0.5, W*0.5],
        )
        side_by_side.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (1,0), (1,0), 10),
        ]))
        elems.append(side_by_side)
        elems.append(Spacer(1, 0.25*cm))

        # Flags row
        if flags:
            flag_cells = []
            for label, color_key in flags:
                fc = flag_color_map[color_key]
                flag_cells.append(
                    Paragraph(f"<b>{label}</b>",
                              sty(f'Flg{label}', fontSize=7,
                                  textColor=fc,
                                  borderPadding=(2,4,2,4)))
                )
            # Wrap into rows of 4
            rows_of_4 = [flag_cells[i:i+4] for i in range(0, len(flag_cells), 4)]
            for row in rows_of_4:
                while len(row) < 4:
                    row.append(Paragraph('', normal_sty))
                ft = Table([row], colWidths=[W/4]*4)
                ft.setStyle(TableStyle([('PADDING',(0,0),(-1,-1),3)]))
                elems.append(ft)

        elems.append(Spacer(1, 0.4*cm))

        # ── WHOIS & DNS ────────────────────────────────────────────────────
        elems.append(Paragraph("WHOIS & DNS Intelligence", h2_sty))

        whois_rows = [
            ["Registrar",        str(whois.get('registrar') or '—')],
            ["Domain Age",       f"{whois.get('domain_age_days', '—')} days" if whois.get('domain_age_days') is not None else '—'],
            ["Created",          str(whois.get('creation_date', '—'))[:10]],
            ["Expires",          str(whois.get('expiration_date', '—'))[:10]],
            ["Days Until Expiry",f"{whois.get('days_until_expiry', '—')} days" if whois.get('days_until_expiry') is not None else '—'],
            ["Country",          str(whois.get('registrant_country') or '—')],
        ]
        dns_rows = [
            ["Resolves",   "Yes" if dns.get('resolves') else "No"],
            ["SPF Record", "Present" if dns.get('has_spf') else "Missing"],
            ["DMARC",      "Present" if dns.get('has_dmarc') else "Missing"],
            ["IP Address", str(dns.get('a_records', ['—'])[0]) if dns.get('a_records') else '—'],
            ["Name Servers", str(dns.get('ns_records', ['—'])[0]) if dns.get('ns_records') else '—'],
            ["MX Records",  str(dns.get('mx_records', ['—'])[0]) if dns.get('mx_records') else '—'],
        ]

        def _colored_table(rows):
            t = Table(rows, colWidths=[3.8*cm, 2.6*cm])
            ts = [
                ('FONTSIZE',   (0,0), (-1,-1), 8),
                ('TEXTCOLOR',  (0,0), (0,-1),  colors.HexColor('#94a3b8')),
                ('TEXTCOLOR',  (1,0), (1,-1),  colors.HexColor('#1e293b')),
                ('FONTNAME',   (0,0), (0,-1),  'Helvetica-Bold'),
                ('ROWBACKGROUNDS', (0,0), (-1,-1),
                 [colors.HexColor('#f8fafc'), colors.white]),
                ('GRID',       (0,0), (-1,-1), 0.3, colors.HexColor('#e2e8f0')),
                ('PADDING',    (0,0), (-1,-1), 4),
            ]
            # Highlight bad values
            for i, (k, v) in enumerate(rows):
                if v in ('Missing', 'No'):
                    ts.append(('TEXTCOLOR', (1,i), (1,i), colors.HexColor('#dc3545')))
                elif v in ('Present', 'Yes'):
                    ts.append(('TEXTCOLOR', (1,i), (1,i), colors.HexColor('#198754')))
                elif 'days' in str(v):
                    try:
                        d = int(str(v).split()[0])
                        if d < 30:
                            ts.append(('TEXTCOLOR', (1,i), (1,i), colors.HexColor('#dc3545')))
                    except Exception:
                        pass
            t.setStyle(TableStyle(ts))
            return t

        whois_dns_table = Table(
            [[Paragraph("WHOIS", h3_sty), Paragraph("DNS", h3_sty)],
             [_colored_table(whois_rows), _colored_table(dns_rows)]],
            colWidths=[W*0.5, W*0.5],
        )
        whois_dns_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (1,0), (1,-1), 10),
        ]))
        elems.append(whois_dns_table)
        elems.append(Spacer(1, 0.4*cm))

        # ── Content Analysis ───────────────────────────────────────────────
        elems.append(Paragraph("Content Analysis", h2_sty))

        content_rows = [
            ["Page Title",          str(content.get('title') or '—')[:60]],
            ["Word Count",          str(content.get('word_count', '—'))],
            ["Script Count",        str(content.get('script_count', '—'))],
            ["iFrame Count",        str(content.get('iframe_count', '—'))],
            ["Image Count",         str(content.get('image_count', '—'))],
            ["External Links",      str(content.get('external_links_count', '—'))],
            ["Target Similarity",   f"{content['target_similarity']:.0%}" if content.get('target_similarity') is not None else '—'],
        ]

        content_flags = [
            ("Login Form",         content.get('has_login_form'),         True,  'neg'),
            ("Password Field",     content.get('has_password_field'),     True,  'neg'),
            ("Ext. Form Action",   content.get('form_action_external'),   True,  'neg'),
            ("Obfuscated JS",      content.get('obfuscated_js'),          True,  'neg'),
            ("Meta Redirect",      content.get('meta_redirect'),          True,  'neg'),
            ("Hidden Fields",      content.get('has_hidden_fields'),      True,  'neg'),
            ("CAPTCHA Present",    content.get('has_captcha'),            False, 'pos'),
        ]

        content_feat_table = Table(content_rows, colWidths=[4.5*cm, W-4.5*cm])
        content_feat_table.setStyle(TableStyle([
            ('FONTSIZE',   (0,0), (-1,-1), 8),
            ('TEXTCOLOR',  (0,0), (0,-1),  colors.HexColor('#94a3b8')),
            ('FONTNAME',   (0,0), (0,-1),  'Helvetica-Bold'),
            ('ROWBACKGROUNDS', (0,0), (-1,-1),
             [colors.HexColor('#f8fafc'), colors.white]),
            ('GRID',       (0,0), (-1,-1), 0.3, colors.HexColor('#e2e8f0')),
            ('PADDING',    (0,0), (-1,-1), 4),
        ]))
        elems.append(content_feat_table)
        elems.append(Spacer(1, 0.15*cm))

        flag_row_cells = []
        for label, val, is_bad_if_true, kind in content_flags:
            if val:
                fc = colors.HexColor('#dc3545') if is_bad_if_true else colors.HexColor('#198754')
                sym = '⚠ ' if is_bad_if_true else '✓ '
            else:
                fc = colors.HexColor('#198754') if is_bad_if_true else colors.HexColor('#94a3b8')
                sym = '✓ ' if is_bad_if_true else '— '
            flag_row_cells.append(
                Paragraph(f"<b>{sym}{label}</b>",
                          sty(f'CF{label}', fontSize=7, textColor=fc))
            )

        cf_rows = [flag_row_cells[i:i+4] for i in range(0, len(flag_row_cells), 4)]
        for row in cf_rows:
            while len(row) < 4:
                row.append(Paragraph('', normal_sty))
            ft = Table([row], colWidths=[W/4]*4)
            ft.setStyle(TableStyle([('PADDING',(0,0),(-1,-1),3)]))
            elems.append(ft)

        elems.append(Spacer(1, 0.4*cm))

        # ── Visual Analysis ────────────────────────────────────────────────
        if visual.get('similarity_score') is not None:
            elems.append(Paragraph("Visual Similarity Analysis", h2_sty))
            vis_rows = [
                ["Similarity Score",  f"{visual.get('similarity_score', 0):.0%}"],
                ["Method",            str(visual.get('method', '—'))],
                ["pHash Distance",    str(visual.get('phash_distance', '—'))],
                ["aHash Distance",    str(visual.get('ahash_distance', '—'))],
                ["dHash Distance",    str(visual.get('dhash_distance', '—'))],
            ]
            vis_table = Table(vis_rows, colWidths=[5*cm, W-5*cm])
            vis_table.setStyle(TableStyle([
                ('FONTSIZE',   (0,0), (-1,-1), 8),
                ('TEXTCOLOR',  (0,0), (0,-1),  colors.HexColor('#94a3b8')),
                ('FONTNAME',   (0,0), (0,-1),  'Helvetica-Bold'),
                ('ROWBACKGROUNDS', (0,0), (-1,-1),
                 [colors.HexColor('#f8fafc'), colors.white]),
                ('GRID',       (0,0), (-1,-1), 0.3, colors.HexColor('#e2e8f0')),
                ('PADDING',    (0,0), (-1,-1), 4),
            ]))
            sim = visual.get('similarity_score', 0)
            vis_table.setStyle(TableStyle([
                ('TEXTCOLOR', (1,0), (1,0),
                 colors.HexColor('#dc3545') if sim >= 0.7
                 else colors.HexColor('#fd7e14') if sim >= 0.4
                 else colors.HexColor('#198754')),
            ]))
            elems.append(vis_table)
            elems.append(Spacer(1, 0.4*cm))

        # ── Risk Summary ───────────────────────────────────────────────────
        elems.append(Paragraph("Risk Assessment Summary", h2_sty))

        risk_text = {
            'phishing':  (
                f"This domain exhibits strong phishing indicators with a {overall:.0%} probability score. "
                f"{'It is impersonating ' + brand + '. ' if brand != '—' else ''}"
                "Immediate blocking is recommended. Do not enter credentials on this site."
            ),
            'suspicious': (
                f"This domain shows moderate phishing signals with a {overall:.0%} probability score. "
                "Manual review is recommended before accessing. Treat with caution."
            ),
            'safe': (
                f"This domain appears legitimate with a low risk score of {overall:.0%}. "
                "No significant phishing indicators were detected."
            ),
        }.get(verdict, f"Analysis inconclusive. Score: {overall:.0%}. Manual review recommended.")

        risk_bg = {
            'phishing':  colors.HexColor('#fff5f5'),
            'suspicious': colors.HexColor('#fffbf0'),
            'safe':       colors.HexColor('#f0fdf4'),
        }.get(verdict, colors.HexColor('#f8fafc'))

        risk_box = Table(
            [[Paragraph(risk_text, sty('Risk', fontSize=9,
                                        textColor=colors.HexColor('#1e293b'),
                                        leading=14))]],
            colWidths=[W],
        )
        risk_box.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), risk_bg),
            ('BOX',        (0,0), (-1,-1), 1.5, vc),
            ('PADDING',    (0,0), (-1,-1), 10),
            ('ROUNDEDCORNERS', [4]),
        ]))
        elems.append(risk_box)

        # ── Footer ─────────────────────────────────────────────────────────
        elems.append(Spacer(1, 0.8*cm))
        elems.append(HRFlowable(width='100%', thickness=0.5,
                                color=colors.HexColor('#e2e8f0')))
        elems.append(Paragraph(
            f"PhishVision AI v1.0.0  |  {domain}  |  Confidential Security Report",
            footer_sty,
        ))

        doc.build(elems)
        return buffer.getvalue()

    except Exception as e:
        logger.error(f"Single PDF generation failed: {e}", exc_info=True)
        # Plain-text fallback
        r = result
        text = (
            f"PhishVision AI — Domain Report\n"
            f"Generated: {datetime.utcnow().isoformat()}\n\n"
            f"Domain:  {r.get('domain')}\n"
            f"URL:     {r.get('url')}\n"
            f"Verdict: {r.get('verdict', '').upper()}\n"
            f"Score:   {r.get('overall_score', 0):.0%}\n\n"
            f"URL Score:     {r.get('url_score', 0):.0%}\n"
            f"WHOIS Score:   {r.get('whois_score', 0):.0%}\n"
            f"Content Score: {r.get('content_score', 0):.0%}\n"
            f"Visual Score:  {r.get('visual_score', 0):.0%}\n"
        )
        return text.encode('utf-8')


def generate_json_report(results: List[Dict]) -> bytes:
    """Generate a JSON report from scan results."""
    report = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "tool": "PhishVision AI",
        "version": "1.0.0",
        "total_scanned": len(results),
        "phishing_count": sum(1 for r in results if r.get("verdict") == "phishing"),
        "suspicious_count": sum(1 for r in results if r.get("verdict") == "suspicious"),
        "safe_count": sum(1 for r in results if r.get("verdict") == "safe"),
        "results": results,
    }
    return json.dumps(report, indent=2, default=str).encode("utf-8")


def generate_csv_report(results: List[Dict]) -> bytes:
    """Generate a CSV report with key fields from scan results."""
    output = io.StringIO()

    fieldnames = [
        "id", "domain", "url", "target_brand", "verdict", "confidence",
        "overall_score", "url_score", "whois_score", "content_score",
        "visual_score", "dns_score", "domain_age_days", "registrar",
        "has_login_form", "form_action_external", "obfuscated_js",
        "scan_duration_ms", "scanned_at", "error_message",
    ]

    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
    writer.writeheader()

    for r in results:
        whois = r.get("whois_data") or {}
        content = r.get("content_features") or {}

        row = {
            "id": r.get("id", ""),
            "domain": r.get("domain", ""),
            "url": r.get("url", ""),
            "target_brand": r.get("target_brand", ""),
            "verdict": r.get("verdict", ""),
            "confidence": r.get("confidence", ""),
            "overall_score": r.get("overall_score", 0),
            "url_score": r.get("url_score", 0),
            "whois_score": r.get("whois_score", 0),
            "content_score": r.get("content_score", 0),
            "visual_score": r.get("visual_score", 0),
            "dns_score": r.get("dns_score", 0),
            "domain_age_days": whois.get("domain_age_days", ""),
            "registrar": whois.get("registrar", ""),
            "has_login_form": content.get("has_login_form", ""),
            "form_action_external": content.get("form_action_external", ""),
            "obfuscated_js": content.get("obfuscated_js", ""),
            "scan_duration_ms": r.get("scan_duration_ms", 0),
            "scanned_at": r.get("scanned_at", ""),
            "error_message": r.get("error_message", ""),
        }
        writer.writerow(row)

    return output.getvalue().encode("utf-8")


def generate_pdf_report(results: List[Dict]) -> bytes:
    """Generate a professional PDF report using ReportLab."""
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.platypus import (
            SimpleDocTemplate, Table, TableStyle, Paragraph,
            Spacer, HRFlowable,
        )
        from reportlab.lib.enums import TA_CENTER, TA_LEFT

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2 * cm,
            leftMargin=2 * cm,
            topMargin=2 * cm,
            bottomMargin=2 * cm,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'Title', parent=styles['Title'],
            fontSize=22, textColor=colors.HexColor('#1a1a2e'),
            spaceAfter=6,
        )
        subtitle_style = ParagraphStyle(
            'Subtitle', parent=styles['Normal'],
            fontSize=11, textColor=colors.HexColor('#4a4a6a'),
            spaceAfter=4,
        )
        heading_style = ParagraphStyle(
            'Heading', parent=styles['Heading2'],
            fontSize=13, textColor=colors.HexColor('#16213e'),
            spaceBefore=12, spaceAfter=6,
        )
        normal = styles['Normal']

        elements = []

        # Title
        elements.append(Paragraph("PhishVision AI — Phishing Detection Report", title_style))
        elements.append(Paragraph(
            f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
            subtitle_style,
        ))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e0e0e0')))
        elements.append(Spacer(1, 0.4 * cm))

        # Summary
        total = len(results)
        phishing = sum(1 for r in results if r.get("verdict") == "phishing")
        suspicious = sum(1 for r in results if r.get("verdict") == "suspicious")
        safe = sum(1 for r in results if r.get("verdict") == "safe")

        elements.append(Paragraph("Executive Summary", heading_style))
        summary_data = [
            ["Metric", "Count"],
            ["Total Domains Scanned", str(total)],
            ["Phishing Detected", str(phishing)],
            ["Suspicious", str(suspicious)],
            ["Safe", str(safe)],
        ]
        summary_table = Table(summary_data, colWidths=[8 * cm, 4 * cm])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#16213e')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#f8f9fa'), colors.white]),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dee2e6')),
            ('ALIGN', (1, 0), (1, -1), 'CENTER'),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 0.5 * cm))

        # Results table
        elements.append(Paragraph("Detailed Scan Results", heading_style))

        VERDICT_COLORS = {
            "phishing": colors.HexColor('#dc3545'),
            "suspicious": colors.HexColor('#fd7e14'),
            "safe": colors.HexColor('#198754'),
            "unknown": colors.HexColor('#6c757d'),
        }

        table_header = ["#", "Domain", "Target Brand", "Score", "Verdict", "Confidence"]
        table_data = [table_header]

        for i, r in enumerate(results, 1):
            score = r.get("overall_score", 0)
            verdict = r.get("verdict", "unknown")
            table_data.append([
                str(i),
                r.get("domain", "")[:40],
                r.get("target_brand") or "—",
                f"{score:.1%}",
                verdict.upper(),
                r.get("confidence", "").capitalize(),
            ])

        col_widths = [1 * cm, 6.5 * cm, 4 * cm, 2 * cm, 2.5 * cm, 2.5 * cm]
        result_table = Table(table_data, colWidths=col_widths)
        table_style = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#16213e')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#f8f9fa'), colors.white]),
            ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#dee2e6')),
            ('PADDING', (0, 0), (-1, -1), 5),
            ('ALIGN', (3, 1), (3, -1), 'CENTER'),
            ('ALIGN', (4, 1), (4, -1), 'CENTER'),
        ]

        for i, r in enumerate(results, 1):
            verdict = r.get("verdict", "unknown")
            color = VERDICT_COLORS.get(verdict, colors.HexColor('#6c757d'))
            table_style.append(('TEXTCOLOR', (4, i), (4, i), color))
            table_style.append(('FONTNAME', (4, i), (4, i), 'Helvetica-Bold'))

        result_table.setStyle(TableStyle(table_style))
        elements.append(result_table)

        # Footer
        elements.append(Spacer(1, 1 * cm))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0')))
        elements.append(Paragraph(
            "PhishVision AI — Automated Phishing Detection Platform | Confidential",
            ParagraphStyle('Footer', parent=styles['Normal'],
                           fontSize=8, textColor=colors.grey, alignment=TA_CENTER),
        ))

        doc.build(elements)
        return buffer.getvalue()

    except ImportError:
        # Fallback: minimal text-based "PDF" (won't be a real PDF but won't crash)
        logger.warning("reportlab not installed, returning plain text report")
        text = f"PhishVision AI Report\nGenerated: {datetime.utcnow().isoformat()}\n\n"
        for r in results:
            text += f"{r.get('domain')} | {r.get('verdict')} | {r.get('overall_score'):.2%}\n"
        return text.encode("utf-8")
