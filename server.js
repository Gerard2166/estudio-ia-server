const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin: [
    'https://estudio-ia-app.netlify.app',
    'http://localhost:3000',
    'http://127.0.0.1:5500'
  ]
}));

app.get('/', (req, res) => {
  res.json({ status: 'EstudioIA API funcionando correctamente ✅' });
});

app.post('/generar', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Clave de API no configurada.' });

  const { texto, imagenBase64, imagenTipo, idioma } = req.body;
  if (!texto && !imagenBase64) return res.status(400).json({ error: 'Debes enviar texto o imagen.' });

  const idiomas = { es: 'español', en: 'English', ca: 'català', fr: 'français' };
  const idiomaNombre = idiomas[idioma] || 'español';

  const textContext = texto
    ? `El estudiante ha proporcionado este texto:\n\n${texto}`
    : 'El estudiante ha subido una imagen. Extrae el texto y úsalo como base.';

  const prompt = `${textContext}

Genera material de estudio en ${idiomaNombre}. Responde SOLO con JSON válido sin markdown:

{
  "resumen": "Párrafo claro de 5-8 líneas con los conceptos más importantes.",
  "esquema": ["Punto 1: descripción","Punto 2: descripción","Punto 3: descripción","Punto 4: descripción","Punto 5: descripción"],
  "test": [
    {"pregunta":"texto","opciones":["A. op","B. op","C. op","D. op"],"correcta":1}
  ],
  "flashcards": [
    {"pregunta":"¿Pregunta?","respuesta":"Respuesta clara"}
  ]
}

REQUISITOS: esquema 5-7 puntos, test exactamente 10 preguntas (índice correcta 0-3), flashcards exactamente 5. Solo JSON.`;

  const parts = [];
  if (imagenBase64 && imagenTipo) {
    parts.push({ inline_data: { mime_type: imagenTipo, data: imagenBase64 } });
  }
  parts.push({ text: prompt });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 4000 }
        })
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error?.message || `Error de Gemini (${response.status})` });
    }

    const data = await response.json();
    const raw = data.candidates[0].content.parts[0].text
      .trim().replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();

    const material = JSON.parse(raw);
    res.json(material);

  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Error interno: ' + err.message });
  }
});

app.listen(PORT, () => console.log(`Servidor EstudioIA en puerto ${PORT}`));
