const express = require('express');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const app = express();
const port = 5000;

// Folder chứa file Excel
const dataDir = path.join(__dirname, 'Transaction Sales Data');

// Cho phép phục vụ file tĩnh (index.html, css, js)
app.use(express.static(__dirname));

// API trả dữ liệu Excel
app.get('/api/excel', (req, res) => {
  try {
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
    const allData = {};

    files.forEach(file => {
      const workbook = XLSX.readFile(path.join(dataDir, file));
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        // Ghi dữ liệu theo file và sheet
        if(!allData[file]) allData[file] = {};
        allData[file][sheetName] = jsonData;
      });
    });

    res.json(allData);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server chạy tại http://localhost:${port}`);
});
