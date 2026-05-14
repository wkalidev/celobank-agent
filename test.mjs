import "dotenv/config"

const response = await fetch("https://api.ollama.com/api/chat", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.OLLAMA_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "gemma3:4b",
    messages: [{ role: "user", content: "Dis bonjour en français" }],
    stream: false
  })
})

const data = await response.json()
console.log(data?.message?.content || data)