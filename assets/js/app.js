let currentTab = 'data';
let currentInsightSubtab = 'overview';
let navToggleButton = null;
let navTabsContainer = null;
const GEMINI_MODEL_ID = 'gemini-2.0-flash';
const DEFAULT_GEMINI_API_KEY = 'AIzaSyCZDsHthnmh32b9xVN7pjKLG1ACwitRNPA';

function showTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(section => {
    section.style.display = 'none';
  });

  const target = document.getElementById(`${tab}Tab`);
  if (target) {
    target.style.display = 'block';
  }

  if (tab === 'insight') {
    switchInsightSubtab(currentInsightSubtab);
  }

  updateActiveNav();
  closeNavMenu();
}

function updateActiveNav() {
  document.querySelectorAll('.main-nav .tabs a').forEach(anchor => {
    const match = anchor.getAttribute('onclick')?.match(/'([^']+)'/);
    const tabName = match ? match[1] : '';
    anchor.classList.toggle('active', tabName === currentTab);
    anchor.style.display = 'inline-block';
    if (tabName === currentTab) {
      anchor.setAttribute('aria-current', 'page');
    } else {
      anchor.removeAttribute('aria-current');
    }
  });
}

function switchInsightSubtab(tab) {
  currentInsightSubtab = tab;
  const overviewPanel = document.getElementById('insightOverviewPanel');
  const aiPanel = document.getElementById('insightAiPanel');

  if (overviewPanel) {
    overviewPanel.classList.toggle('hidden', tab !== 'overview');
  }

  if (aiPanel) {
    aiPanel.classList.toggle('hidden', tab !== 'ai');
  }

  document.querySelectorAll('.insight-subtab').forEach(btn => {
    const targetTab = btn.getAttribute('data-subtab');
    btn.classList.toggle('active', targetTab === tab);
  });

  if (tab === 'overview') {
    showInsightOverview();
  }
}

function showInsightDetail(id) {
  const overviewPanel = document.getElementById('insightOverviewPanel');
  if (!overviewPanel) return;

  const grid = overviewPanel.querySelector('.insight-grid');
  if (grid) {
    grid.classList.add('hidden');
  }

  const detailWrapper = document.getElementById('insightDetailWrapper');
  if (detailWrapper) {
    detailWrapper.classList.add('show');
  }

  overviewPanel.querySelectorAll('.insight-detail').forEach(detail => {
    detail.classList.remove('active');
  });

  const target = overviewPanel.querySelector(`#${id}`);
  if (target) {
    target.classList.add('active');
  }
}

function backToOverview() {
  showInsightOverview();
}

function showInsightOverview() {
  const overviewPanel = document.getElementById('insightOverviewPanel');
  if (!overviewPanel) return;

  const grid = overviewPanel.querySelector('.insight-grid');
  if (grid) {
    grid.classList.remove('hidden');
  }

  const detailWrapper = document.getElementById('insightDetailWrapper');
  if (detailWrapper) {
    detailWrapper.classList.remove('show');
  }

  overviewPanel.querySelectorAll('.insight-detail').forEach(detail => {
    detail.classList.remove('active');
  });
}

function toggleTheme() {
  document.body.classList.toggle('dark');
}

function searchTabs() {
  const input = document.getElementById('searchBox');
  if (!input) return;

  const query = input.value.trim().toLowerCase();
  const navLinks = Array.from(document.querySelectorAll('.main-nav .tabs a'));

  let matchedTab = null;

  navLinks.forEach(link => {
    const labelText = link.querySelector('.tab-label')?.textContent || link.textContent;
    const label = labelText.trim().toLowerCase();
    const linkMatches = query === '' || label.includes(query);
    link.style.display = linkMatches ? 'inline-block' : 'none';

    if (linkMatches && matchedTab === null) {
      const result = link.getAttribute('onclick')?.match(/'([^']+)'/);
      matchedTab = result ? result[1] : null;
    }
  });

  if (query === '') {
    navLinks.forEach(link => {
      link.style.display = 'inline-block';
    });
    showTab(currentTab || 'data');
    return;
  }

  if (matchedTab) {
    showTab(matchedTab);
  } else {
    document.querySelectorAll('.tab').forEach(section => section.style.display = 'none');
  }
}

function filterCategory(cat) {
  document.querySelectorAll('.card').forEach(card => {
    if (cat === 'all' || card.dataset.category === cat) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  });
}

async function generateInsight() {
  const inputText = document.getElementById('dataText')?.value.trim();
  const resultBox = document.getElementById('insightResult');
  const apiKey = DEFAULT_GEMINI_API_KEY.trim();

  if (!resultBox) return;

  if (!inputText) {
    resultBox.innerHTML = '⚠️ Vui lòng nhập dữ liệu trước khi phân tích.';
    return;
  }

  if (!apiKey) {
    resultBox.innerHTML = '🔑 Chưa cấu hình Gemini API key.';
    return;
  }

  resultBox.innerHTML = `
    <div class="ai-loading">
      <span></span><span></span><span></span>
      <p>Đang phân tích dữ liệu...</p>
    </div>
  `;

  const payload = {
    contents: [{
      parts: [{ text: `Phân tích dữ liệu sau và tạo insight ngắn gọn, dễ hiểu:\n\n${inputText}` }]
    }]
  };

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_ID}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      const apiMessage = data?.error?.message || `HTTP ${response.status}`;
      if (response.status === 429) {
        resultBox.innerHTML = `🚦 API bị giới hạn tốc độ/quota. Vui lòng đợi vài phút rồi thử lại.<br><small>${apiMessage}</small>`;
      } else {
        resultBox.innerHTML = `❌ Lỗi từ Gemini API: ${apiMessage}`;
      }
      return;
    }
    const output = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Không có phản hồi từ AI.';

    resultBox.innerHTML = marked.parse(output);

  } catch (err) {
    console.error(err);
    resultBox.innerHTML = '❌ Không thể kết nối tới Gemini. Kiểm tra lại API key, kết nối mạng hoặc cài đặt CORS.';
  }
}

function clearAiInput() {
  const textarea = document.getElementById('dataText');
  const resultBox = document.getElementById('insightResult');
  if (textarea) textarea.value = '';
  if (resultBox) resultBox.innerHTML = '';
}

document.addEventListener('DOMContentLoaded', () => {
  navToggleButton = document.querySelector('.nav-toggle');
  navTabsContainer = document.querySelector('.main-nav .tabs');

  if (navToggleButton && navTabsContainer) {
    navToggleButton.addEventListener('click', () => {
      const isOpen = navTabsContainer.classList.toggle('open');
      navToggleButton.classList.toggle('active', isOpen);
      navToggleButton.setAttribute('aria-expanded', String(isOpen));
    });

    navTabsContainer.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 900) {
          closeNavMenu();
        }
      });
    });
  }

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) {
      closeNavMenu();
    }
  });

  document.addEventListener('click', event => {
    if (!navTabsContainer || !navToggleButton) return;
    if (window.innerWidth > 900) return;
    const isClickInside = navTabsContainer.contains(event.target) || navToggleButton.contains(event.target);
    if (!isClickInside) {
      closeNavMenu();
    }
  });

  switchInsightSubtab(currentInsightSubtab);
  showTab(currentTab);
});

function closeNavMenu() {
  if (!navTabsContainer || !navToggleButton) return;
  navTabsContainer.classList.remove('open');
  navToggleButton.classList.remove('active');
  navToggleButton.setAttribute('aria-expanded', 'false');
}