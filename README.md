# PhishVision AI 🛡️

**Automated AI-powered Phishing Domain Detection Platform**

PhishVision uses machine learning, visual similarity analysis, and WHOIS intelligence to detect phishing domains from newly registered websites in real-time.

## Features

- 🔍 **URL & Domain Analysis** — Feature extraction from URLs (length, entropy, TLD, subdomains, special chars)
- 🌐 **WHOIS Intelligence** — Domain age, registrar reputation, registration anomalies
- 🖼️ **Visual Similarity** — Screenshot comparison using perceptual hashing + SSIM
- 📄 **Content Similarity** — HTML structure, text, and JS fingerprint comparison
- 🤖 **ML Scoring** — Random Forest + Gradient Boosting ensemble for probability scores
- 📊 **Real-time Dashboard** — Live scan results with probability scores and drill-down reports
- 📤 **Flexible Export** — JSON, CSV, PDF report formats
- ⏰ **Auto-scanner** — Background scheduler for newly registered domains
- 🎯 **Target Brand Matching** — Match against known legitimate domains

## Tech Stack

- **Frontend**: React 18, TailwindCSS, Recharts, Framer Motion
- **Backend**: Python FastAPI, SQLite, APScheduler
- **ML**: scikit-learn, Pillow, imagehash, BeautifulSoup4
- **Data**: WHOIS, DNS, Certificate Transparency logs

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
python main.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Architecture

```
PhishVision/
├── backend/          # FastAPI server + ML pipeline
│   ├── main.py       # API entrypoint
│   ├── scanner.py    # Domain scanner & scheduler
│   ├── ml_model.py   # ML feature extraction & scoring
│   ├── whois_intel.py# WHOIS + DNS analysis
│   ├── visual.py     # Screenshot & image similarity
│   ├── content.py    # HTML content analysis
│   ├── database.py   # SQLite ORM
│   └── targets.py    # Known legitimate brand targets
├── frontend/         # React dashboard
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── api/
└── README.md
```
