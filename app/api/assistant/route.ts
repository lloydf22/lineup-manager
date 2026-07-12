import { NextResponse } from "next/server";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, limit } from "firebase/firestore";
import { GoogleGenAI } from "@google/genai";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: "lineup-72c1e.firebaseapp.com",
  projectId: "lineup-72c1e",
  storageBucket: "lineup-72c1e.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Helper to translate weather codes to text and detect precipitation risks
function parseWeatherCode(code: number) {
  const rainCodes = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99];
  let condition = "Clear/Sunny";
  
  if ([1, 2, 3].includes(code)) condition = "Partly Cloudy / Overcast";
  else if ([45, 48].includes(code)) condition = "Foggy";
  else if ([51, 53, 55].includes(code)) condition = "Light Drizzle";
  else if ([61, 63, 65].includes(code)) condition = "Active Heavy Rain";
  else if ([80, 81, 82].includes(code)) condition = "Passing Rain Showers";
  else if ([95, 96, 99].includes(code)) condition = "Thunderstorms Storm Risk";

  return {
    condition,
    isRainyDay: rainCodes.includes(code)
  };
}

export async function POST(request: Request) {
  try {
    const { message, history, restaurantId, currentContextPath } = await request.json();

    // 1. Pull Firestore snapshots
    const usersSnap = await getDocs(collection(db, "restaurants", restaurantId, "users"));
    const rosterSnap = await getDocs(collection(db, "restaurants", restaurantId, "roster"));
    const requestsSnap = await getDocs(collection(db, "restaurants", restaurantId, "time_off_requests"));
    const ordersSnap = await getDocs(query(collection(db, "restaurants", restaurantId, "orders"), limit(20)));

    const activeStaff = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const currentShifts = rosterSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const timeOffLogs = requestsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const recentOrders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 2. FETCH THE 7-DAY DAILY WEATHER FORECAST MATRIX (Palm Coast, FL)
    let weeklyForecastData = [];
    try {
      const weatherRes = await fetch(
        "https://api.open-meteo.com/v1/forecast?latitude=29.5428&longitude=-81.2095&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=America%2FNew_York",
        { next: { revalidate: 900 } } // Cache forecast matrix for 15 minutes
      );
      const weatherData = await weatherRes.json();

      if (weatherData?.daily) {
        const times = weatherData.daily.time; // Array of dates
        const maxTemps = weatherData.daily.temperature_2m_max;
        const minTemps = weatherData.daily.temperature_2m_min;
        const codes = weatherData.daily.weather_code;

        weeklyForecastData = times.map((time: string, index: number) => {
          const parsed = parseWeatherCode(codes[index]);
          return {
            date: time,
            high: `${Math.round(maxTemps[index])}°F`,
            low: `${Math.round(minTemps[index])}°F`,
            condition: parsed.condition,
            impactsOutdoorSeating: parsed.isRainyDay
          };
        });
      }
    } catch (weatherErr) {
      console.error("Predictive weather fetch error:", weatherErr);
    }

    // 3. Compile absolute metadata block
    const venueMetadata = {
      brand: "Lineup",
      location: "Palm Coast, Florida, USA",
      timezone: "America/New_York (EDT)",
      currentSystemTime: new Date().toString(),
      upcomingSevenDayForecast: weeklyForecastData,
      environmentConstraints: "Coastal venue. Highly sensitive to rainy weather conditions. Rain drops outdoor seating capacity to zero and deters regional beach tourism."
    };

    // 4. Set strict system instructions for textual layout delivery
    const systemInstruction = `
      You are "Lineup AI", the core full-suite intelligent operations assistant for our restaurant management platform.
      You have real-time read access to the platform's backend matrices and upcoming multi-day weather predictions below.

      The manager is currently viewing the page path: "${currentContextPath}".

      PREDICTIVE WEATHER INSTRUCTIONS:
      Look directly at "upcomingSevenDayForecast". When the user asks for a sales or scheduling outlook for the week, map out the weather trends you see day-by-day. Use this dataset to forecast sales volumes (e.g., if Tuesday and Wednesday indicate active rain or thunderstorms, explicitly warn them to expect lower sales volume due to the venue's coastal nature, and recommend optimizing or lowering shift hours on those specific days).

      CRITICAL PLAIN-TEXT FORMATTING RULES:
      1. NEVER use Markdown styling. Do NOT output asterisks (**), hashtags (#), underscores (_), backticks (\`), or horizontal divider lines (---).
      2. Write main category section titles in ALL CAPS followed by a simple line break (e.g., SALES OUTLOOK).
      3. For individual structural list points, use a single hyphen followed by a space (- ). Do not wrap labels or headers in bold tags.
      4. Avoid mixing text styles: Output "- Total Gross Sales: $353.01" instead of legacy markdown markup values.
      5. Use standard empty line breaks to separate ideas so the output window stays clean.
      6. If scheduling sheets or logs reflect past data ranges compared to July 12, 2026, call it out cleanly under a ROSTER INTEGRITY WARNING section.

      OPERATIONAL VENUE ENVIRONMENT METADATA:
      ${JSON.stringify(venueMetadata, null, 2)}

      LIVE BUSINESS ENGINE CONTEXT:
      === RECENT ORDERS & TICKET METRICS ===
      ${JSON.stringify(recentOrders, null, 2)}

      === TEAM MEMBER REGISTRY ===
      ${JSON.stringify(activeStaff, null, 2)}

      === ACTIVE ASSIGNED SHIFTS ===
      ${JSON.stringify(currentShifts, null, 2)}

      === APPROVED TIME-OFF REQUESTS ===
      ${JSON.stringify(timeOffLogs, null, 2)}
    `;

    const contents = [
      ...history.map((msg: { sender: string; text: string }) => ({
        role: msg.sender === "user" ? "user" : "model",
        parts: [{ text: msg.text }]
      })),
      { role: "user", parts: [{ text: message }] }
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.15,
      }
    });

    return NextResponse.json({ reply: response.text });

  } catch (error: any) {
    console.error("Lineup AI Assistant Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}