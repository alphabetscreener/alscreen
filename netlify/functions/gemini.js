```javascript
const apiKey = process.env.VITE_GEMINI_API_KEY;

exports.handler = async function(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  if (!apiKey) {
    console.error("API Key Missing in Server Environment");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: { message: "Server Configuration Error: VITE_GEMINI_API_KEY is missing." } })
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

// Check if Google returned an error structure
if (!response.ok || data.error) {
    console.error("Google API Error:", data);
    return {
        statusCode: response.status !== 200 ? response.status : 400,
        body: JSON.stringify(data)
    };
}

return {
    statusCode: 200,
    body: JSON.stringify(data)
};
  } catch (error) {
    console.error("Fetch Error:", error);
    return {
        statusCode: 500,
        body: JSON.stringify({ error: { message: "Failed connecting to Gemini: " + error.message } })
    };
}
};
```
