// Problematic "Before" Code (in app.js)
/*
const GEMINI_API_KEY = "AIza...5bymw"; // VULNERABLE! 
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

btnAskAI.addEventListener('click', () => {
  const prompt =...;
  fetch(API_URL, {... }) // FAILS due to CORS
   .then(response => response.json())
   .catch(error => {
      console.error('Connection fail:', error); // This is the bug
    });
});
*/

// Corrected "After" Code (in app.js)

// Refactored app.js
function showModal() {
  document.body.classList.add('modal-open');
}

function hideModal() {
  document.body.classList.remove('modal-open');
}

// All other event listeners remain the same.

btnAskAI.addEventListener('click', () => {
  const userPrompt = document.getElementById('prompt-input').value;

  // The NEW fetch call. It points to OUR server (a same-origin request).
  // No API key. No CORS error.
  fetch('/api/askAI', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt: userPrompt }),
  })
 .then(response => {
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    return response.json();
  })
 .then(data => {
    // Assumes Gemini response is in data.candidates.content.parts.text
    const aiResponse = data.candidates.content.parts.text;
    displayResponse(aiResponse); // Function to show response in the modal
  })
 .catch(error => {
    console.error('AI Error:', error);
    displayResponse('Sorry, the AI is not available right now.');
  });
});
