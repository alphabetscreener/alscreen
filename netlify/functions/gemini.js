const fetch = require('node-fetch');

// Check both variable names to be safe
const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

exports.handler = async function (event, context) {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS request for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: "Method Not Allowed" };
  }

  if (!apiKey) {
    console.error("API Key Missing in Server Environment");
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: { message: "Server Configuration Error: API Key is missing. Check Netlify Env Vars." } })
    };
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: event.body
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error("Google API Error:", data);
      return {
        statusCode: response.status !== 200 ? response.status : 400,
        headers,
        body: JSON.stringify(data)
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error("Fetch Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: { message: "Failed connecting to Gemini: " + error.message } })
    };
  }
};
