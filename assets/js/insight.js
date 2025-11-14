async function generateInsight() {
  const inputData = document.getElementById("dataText").value.trim();
  if (!inputData) return alert("Hãy nhập dữ liệu hoặc tóm tắt!");

  document.getElementById("insightResult").innerHTML = "⏳ Đang phân tích...";

  const apiKey = "AIzaSyCZDsHthnmh32b9xVN7pjKLG1ACwitRNPA"; 
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Bạn là chuyên gia phân tích kinh doanh B2B tại Kochi24h. Hãy rút ra insight ngắn gọn, có logic và đề xuất hành động thực tiễn." },
        { role: "user", content: `Phân tích dữ liệu sau:\n${inputData}` }
      ]
    })
  });

  const result = await response.json();
  let markdownContent = result.choices[0].message.content;

  // 🔹 Chuyển markdown thành HTML
  document.getElementById("insightResult").innerHTML =
    marked.parse(markdownContent);
}
