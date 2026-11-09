# MedConnect

**AI health companion that reads medical reports, explains them in plain language, and shows the affected organs on an interactive 3D body.**

🔗 **Live demo:** https://medconnect-black-six.vercel.app

MedConnect turns a scanned report, photo or PDF into a short, patient-friendly summary in 7 Indian languages. It also tracks vitals with anomaly detection and alerts caretakers in an emergency.

---

## What it does

**AI report simplification**
- Upload a report as an image or PDF. Text is extracted with Tesseract OCR and OpenCV preprocessing, or with pdfplumber / PyPDF2 for PDFs.
- An LLM writes a 3–5 sentence summary covering key findings, medicines and advice, in English, Hindi, Telugu, Kannada, Malayalam, Tamil or Odia.
- The model also returns the affected organs, which drive the 3D view.

**Multi-model AI with fallback**
- The backend tries several models in order, so one provider outage or quota limit doesn't break the app:
  1. **Google Gemini** (vision): reads the document image directly
  2. **Groq, Llama 3.3 70B**: fast text analysis
  3. **OpenAI GPT-4o-mini**
  4. **Ollama**: local model, works offline
- A follow-up **chat** endpoint lets patients ask questions about their report.

**3D body visualization**
- Built with Three.js / React Three Fiber.
- Highlights the organs flagged in the report.
- Toggle anatomy layers: organs, skeletal, cardiovascular, nervous and muscular.

**Vitals monitoring and anomaly detection**
- Sync vitals from Health Connect (Android), HealthKit (iOS), wearables or IoT devices.
- `vitals_engine.py` checks every reading against warning and critical thresholds.
- It flags outliers with z-scores, smooths noisy readings and detects trends to produce risk flags.

**Emergency response**
- One-tap emergency trigger with escalation, cancel, resolve and override.
- Caretaker alerts by WhatsApp and voice call through Twilio.
- Every emergency event is written to an audit log.

**Patient and caretaker roles**
- Role-based access control.
- A caretaker dashboard for monitoring linked patients remotely.

---

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Three.js (React Three Fiber) |
| Backend | Python, Flask, Waitress |
| AI / ML | Google Gemini, Llama 3.3 (Groq), OpenAI, Ollama, Tesseract OCR, OpenCV |
| Data | Supabase (PostgreSQL, Auth, Storage) |
| Alerts | Twilio (WhatsApp + voice) |
| Deploy | Vercel (frontend) |

---

## Project structure

```
backend/
  app.py              Flask API: reports, AI summary, chat, vitals, emergency, IoT
  vitals_engine.py    Thresholds, z-score outliers, trends, risk flags
  emergency_engine.py Escalation flow, Twilio alerts, audit log
  iot_engine.py       Device registration and data ingest
  rbac.py             Patient / caretaker roles
  run_server.py       Production server (Waitress)
src/pages/
  Reports.tsx         Upload and AI summary
  ThreeDView.tsx      3D anatomy viewer
  Dashboard.tsx       Patient vitals
  Caretaker.tsx       Caretaker dashboard
  Emergency.tsx       Emergency controls
  IoTDashboard.tsx    Connected devices
```

---

## Running locally

**Requirements:** Node.js 18+, Python 3.10+, Tesseract OCR installed, a Supabase project.

**1. Frontend**
```bash
npm install
npm run dev          # http://localhost:5173
```

**2. Backend**
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
copy .env.example .env       # then fill in your keys
python run_server.py         # http://localhost:5000
```

On Windows, `start.bat` launches both the backend and the frontend.

**3. Environment variables**

Put these in `backend/.env`. Never commit this file.

```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
JWT_SECRET=
GOOGLE_API_KEY=        # Gemini
GROQ_API_KEY=          # Llama 3.3
OPENAI_API_KEY=        # optional
TWILIO_ACCOUNT_SID=    # optional, for emergency alerts
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
```

You only need one AI key; the app falls back through whichever providers are configured.

The frontend reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

---

## Author

**Shaviv Ebenezer Medhari**: [LinkedIn](https://linkedin.com/in/shavivebe) · [GitHub](https://github.com/ShavivSoft)

> MedConnect is a final-year project and is not a medical device. Summaries are for understanding only and do not replace a doctor's advice.
