let allData = {};
let currentFile = null;
let currentSheetIndex = 0;
const pageSize = 20;
let currentPage = 1;
let totalPages = 1;
let currentSheetData = [];
let isInitialised = false;
let currentHeaders = [];
let currentSheetName = '';
let filteredRowsCache = [];
const FILTER_ALL = '__all';
let activeFilter = {
  column: FILTER_ALL,
  keyword: ''
};

let columnFilterEl = null;
let keywordFilterEl = null;
let applyFilterBtn = null;
let resetFilterBtn = null;

window.addEventListener('DOMContentLoaded', initExcelViewer);

function initExcelViewer() {
  ensureContainers();
  cacheControls();
  attachControlEvents();
  showLoadingState('Đang tải dữ liệu từ Transaction Sales Data...');

  fetch('/api/excel')
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      allData = data || {};
      const fileNames = Object.keys(allData);

      if (fileNames.length === 0) {
        showEmptyState('Không tìm thấy file Excel nào trong hệ thống.');
        return;
      }

      currentFile = fileNames[0];
      renderFileNav(fileNames);
      isInitialised = true;
      renderCurrentFile();
    })
    .catch(err => {
      console.error(err);
      showErrorState('Không thể tải dữ liệu từ máy chủ. Vui lòng kiểm tra lại server.');
    });
}

function cacheControls() {
  columnFilterEl = document.getElementById('columnFilter');
  keywordFilterEl = document.getElementById('keywordFilter');
  applyFilterBtn = document.getElementById('applyFilterBtn');
  resetFilterBtn = document.getElementById('resetFilterBtn');
}

function attachControlEvents() {
  const applyFilter = () => {
    activeFilter.column = columnFilterEl ? columnFilterEl.value : FILTER_ALL;
    activeFilter.keyword = keywordFilterEl ? keywordFilterEl.value.trim() : '';
    currentPage = 1;
    rerenderCurrentSheet();
  };

  if (applyFilterBtn) {
    applyFilterBtn.addEventListener('click', applyFilter);
  }

  if (resetFilterBtn) {
    resetFilterBtn.addEventListener('click', () => {
      activeFilter = { column: FILTER_ALL, keyword: '' };
      if (columnFilterEl) columnFilterEl.value = FILTER_ALL;
      if (keywordFilterEl) keywordFilterEl.value = '';
      currentPage = 1;
      rerenderCurrentSheet();
    });
  }

  if (columnFilterEl) {
    columnFilterEl.addEventListener('change', () => {
      activeFilter.column = columnFilterEl.value;
      currentPage = 1;
      rerenderCurrentSheet();
    });
  }

  if (keywordFilterEl) {
    keywordFilterEl.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        applyFilter();
      }
    });
  }

}

function ensureContainers() {
  const dataTab = document.getElementById('dataTab');
  if (!dataTab) return;

  const fileNav = document.getElementById('fileNav');
  let sheetNav = document.getElementById('sheetNav');
  if (!sheetNav) {
    sheetNav = document.createElement('div');
    sheetNav.id = 'sheetNav';
    sheetNav.className = 'sheet-nav';
    if (fileNav) {
      fileNav.insertAdjacentElement('afterend', sheetNav);
    } else {
      dataTab.insertBefore(sheetNav, dataTab.firstChild);
    }
  }

  const summaryDiv = document.getElementById('dataSummary');
  let tableContainer = document.getElementById('dataTable');
  if (!tableContainer) {
    tableContainer = document.createElement('div');
    tableContainer.id = 'dataTable';
    tableContainer.className = 'table-wrapper';
    if (summaryDiv) {
      summaryDiv.insertAdjacentElement('afterend', tableContainer);
    } else {
      dataTab.appendChild(tableContainer);
    }
  }

}

function renderFileNav(fileNames) {
  const nav = document.getElementById('fileNav');
  if (!nav) return;

  nav.innerHTML = '';
  fileNames.forEach(file => {
    const btn = document.createElement('button');
    btn.textContent = file;
    btn.className = 'file-btn';
    btn.disabled = file === currentFile;
    if (file === currentFile) {
      btn.classList.add('active');
    }

    btn.addEventListener('click', () => {
      if (currentFile === file) return;
      currentFile = file;
      currentSheetIndex = 0;
      currentPage = 1;
      resetFilterState();
      renderFileNav(fileNames);
      renderCurrentFile();
    });

    nav.appendChild(btn);
  });
}

function renderCurrentFile() {
  if (!currentFile || !allData[currentFile]) {
    showEmptyState('Không có dữ liệu cho file đã chọn.');
    return;
  }

  const sheets = Object.keys(allData[currentFile]);
  if (sheets.length === 0) {
    showEmptyState('File hiện tại không có sheet nào.');
    return;
  }

  currentSheetIndex = Math.max(0, Math.min(currentSheetIndex, sheets.length - 1));
  renderSheetNav(sheets);
  renderSheet(currentFile, sheets[currentSheetIndex]);
}

function renderSheetNav(sheets) {
  const sheetNav = document.getElementById('sheetNav');
  if (!sheetNav) return;

  sheetNav.innerHTML = '';
  sheetNav.style.display = sheets.length > 1 ? 'flex' : 'none';

  sheets.forEach((sheetName, idx) => {
    const btn = document.createElement('button');
    btn.textContent = sheetName;
    btn.className = 'sheet-btn';
    if (idx === currentSheetIndex) {
      btn.classList.add('active');
      btn.disabled = true;
    }

    btn.addEventListener('click', () => {
      if (currentSheetIndex === idx) return;
      currentSheetIndex = idx;
      currentPage = 1;
      renderSheetNav(sheets);
      renderSheet(currentFile, sheets[currentSheetIndex]);
    });

    sheetNav.appendChild(btn);
  });
}

function renderSheet(fileName, sheetName) {
  const data = allData[fileName]?.[sheetName];
  currentSheetData = Array.isArray(data) ? data : [];
  currentPage = 1;
  totalPages = Math.max(1, Math.ceil(currentSheetData.length / pageSize));
  currentHeaders = Array.from(new Set(currentSheetData.flatMap(row => Object.keys(row))));
  currentSheetName = sheetName;

  updateFilterOptions(currentHeaders);
  renderSummary(currentSheetData, sheetName, currentHeaders);
  renderTablePage(currentHeaders);
}

function renderSummary(data, sheetName, headers = []) {
  const summaryDiv = document.getElementById('dataSummary');
  if (!summaryDiv) return;

  if (!isInitialised) return;

  if (!Array.isArray(data) || data.length === 0) {
    summaryDiv.innerHTML = `
      <h3>Thống kê nhanh (${sheetName})</h3>
      <p>Không có dữ liệu để hiển thị.</p>
    `;
    return;
  }

  headers = headers.length ? headers : Array.from(new Set(data.flatMap(row => Object.keys(row))));
  const numRows = data.length;
  const numCols = headers.length;

  let missingCount = 0;
  data.forEach(row => {
    headers.forEach(col => {
      const value = row[col];
      if (value === null || value === undefined || value === '') {
        missingCount += 1;
      }
    });
  });

  const totalCells = numRows * Math.max(numCols, 1);
  const missingPercent = totalCells
    ? ((missingCount / totalCells) * 100).toFixed(2)
    : '0.00';
  const filteredRows = getFilteredRows(data);
  const filteredCount = filteredRows.length;
  const isFiltered =
    activeFilter.column !== FILTER_ALL ||
    (activeFilter.keyword && activeFilter.keyword.length > 0);

  summaryDiv.innerHTML = `
    <h3>Thống kê nhanh (${sheetName})</h3>
    <p><b>Số dòng:</b> ${numRows} | <b>Số cột:</b> ${numCols} | <b>Thiếu dữ liệu:</b> ${missingPercent}%</p>
    <p><b>Tên cột:</b> ${headers.join(', ')}</p>
    ${isFiltered ? `<p><b>Số dòng hiển thị:</b> ${filteredCount} / ${numRows} (đang lọc)</p>` : ''}
  `;

  const describeTable = buildDescribeTable(headers, data);
  if (describeTable) {
    summaryDiv.appendChild(describeTable);
  }
}

function buildDescribeTable(headers, rows) {
  if (!headers.length) return null;

  const wrapper = document.createElement('div');
  const table = document.createElement('table');
  table.className = 'desc-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Cột', 'Mean', 'Median', 'Min', 'Max', 'Std', 'Unique'].forEach(label => {
    const th = document.createElement('th');
    th.textContent = label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  headers.forEach(header => {
    const values = rows
      .map(row => row[header])
      .filter(value => value !== null && value !== undefined && value !== '');
    const numericValues = values
      .map(toNumeric)
      .filter(value => !Number.isNaN(value));

    let mean = '-';
    let median = '-';
    let min = '-';
    let max = '-';
    let std = '-';

    if (numericValues.length) {
      const sum = numericValues.reduce((acc, val) => acc + val, 0);
      const meanNumber = sum / numericValues.length;
      mean = meanNumber.toFixed(2);

      const sorted = [...numericValues].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      median = sorted.length % 2 === 0
        ? ((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2)
        : sorted[mid].toFixed(2);

      min = sorted[0].toFixed(2);
      max = sorted[sorted.length - 1].toFixed(2);

      const variance = numericValues.reduce(
        (acc, val) => acc + Math.pow(val - meanNumber, 2),
        0
      ) / numericValues.length;
      std = Math.sqrt(variance).toFixed(2);
    }

    const unique = new Set(values.map(v => (v === null ? 'null' : String(v)))).size;

    const rowEl = document.createElement('tr');
    [header, mean, median, min, max, std, unique].forEach(value => {
      const td = document.createElement('td');
      td.textContent = value;
      rowEl.appendChild(td);
    });
    tbody.appendChild(rowEl);
  });

  table.appendChild(tbody);
  wrapper.appendChild(table);
  return wrapper;
}

function renderTablePage(headers = currentHeaders) {
  const container = document.getElementById('dataTable');
  if (!container) return;

  container.innerHTML = '';

  if (!isInitialised) {
    container.innerHTML = '';
    return;
  }

  if (!currentSheetData.length) {
    container.innerHTML = '<div class="data-placeholder"><span>📂</span><p>Không có dữ liệu để hiển thị.</p></div>';
    return;
  }

  filteredRowsCache = getFilteredRows();

  if (!filteredRowsCache.length) {
    container.innerHTML = '<div class="data-placeholder"><span>🔍</span><p>Không có dữ liệu khớp bộ lọc.</p></div>';
    return;
  }

  totalPages = Math.max(1, Math.ceil(filteredRowsCache.length / pageSize));
  currentPage = Math.min(currentPage, totalPages);

  const table = document.createElement('table');
  table.className = 'data-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headers.forEach(col => {
    const th = document.createElement('th');
    th.textContent = col;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const start = (currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, filteredRowsCache.length);

  for (let i = start; i < end; i += 1) {
    const row = filteredRowsCache[i];
    const tr = document.createElement('tr');
    headers.forEach(col => {
      const td = document.createElement('td');
      const value = row[col];
      td.textContent = value === null || value === undefined ? '' : value;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  container.appendChild(table);

  if (totalPages > 1) {
    container.appendChild(buildPagingNav());
  }
}

function buildPagingNav() {
  const pagingDiv = document.createElement('div');
  pagingDiv.className = 'paging-nav';

  const createButton = (text, disabled, onClick) => {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.className = 'page-btn';
    btn.disabled = disabled;
    btn.addEventListener('click', onClick);
    return btn;
  };

  pagingDiv.appendChild(
    createButton('Trước', currentPage === 1, () => {
      currentPage = Math.max(1, currentPage - 1);
      renderTablePage();
    })
  );

  const maxDisplay = 10;
  const half = Math.floor(maxDisplay / 2);
  let startPage = Math.max(1, currentPage - half);
  let endPage = Math.min(totalPages, startPage + maxDisplay - 1);

  if (endPage - startPage < maxDisplay - 1) {
    startPage = Math.max(1, endPage - maxDisplay + 1);
  }

  if (startPage > 1) {
    pagingDiv.appendChild(
      createButton('1', false, () => {
        currentPage = 1;
        renderTablePage();
      })
    );

    if (startPage > 2) {
      const dots = document.createElement('span');
      dots.textContent = '...';
      dots.className = 'page-ellipsis';
      pagingDiv.appendChild(dots);
    }
  }

  for (let i = startPage; i <= endPage; i += 1) {
    const isActive = i === currentPage;
    const numBtn = createButton(String(i), isActive, () => {
      currentPage = i;
      renderTablePage();
    });

    if (isActive) {
      numBtn.classList.add('active');
      numBtn.disabled = true;
    }

    pagingDiv.appendChild(numBtn);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const dots = document.createElement('span');
      dots.textContent = '...';
      dots.className = 'page-ellipsis';
      pagingDiv.appendChild(dots);
    }

    pagingDiv.appendChild(
      createButton(String(totalPages), false, () => {
        currentPage = totalPages;
        renderTablePage();
      })
    );
  }

  pagingDiv.appendChild(
    createButton('Sau', currentPage === totalPages, () => {
      currentPage = Math.min(totalPages, currentPage + 1);
      renderTablePage();
    })
  );

  return pagingDiv;
}

function toNumeric(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const normalised = value.replace(/\s/g, '').replace(/,/g, '.');
    const parsed = parseFloat(normalised);
    return Number.isNaN(parsed) ? Number.NaN : parsed;
  }
  return Number.NaN;
}

function showEmptyState(message) {
  isInitialised = true;

  const summaryDiv = document.getElementById('dataSummary');
  if (summaryDiv) {
    summaryDiv.innerHTML = `<div class="data-placeholder"><span>📭</span><p>${message}</p></div>`;
  }

  const tableContainer = document.getElementById('dataTable');
  if (tableContainer) {
    tableContainer.innerHTML = `<div class="data-placeholder"><span>📄</span><p>${message}</p></div>`;
  }

  const sheetNav = document.getElementById('sheetNav');
  if (sheetNav) {
    sheetNav.innerHTML = '';
    sheetNav.style.display = 'none';
  }

  resetFilterState();
}

function showErrorState(message) {
  showEmptyState(message);
}

function showLoadingState(message = 'Đang tải dữ liệu...') {
  const summaryDiv = document.getElementById('dataSummary');
  if (summaryDiv) {
    summaryDiv.innerHTML = `
      <div class="data-loading">
        <div class="loading-spinner"></div>
        <p>${message}</p>
      </div>
      <div class="skeleton skeleton-summary">
        <div class="skeleton-line w-60"></div>
        <div class="skeleton-line w-80"></div>
        <div class="skeleton-line w-40"></div>
      </div>
    `;
  }

  const tableContainer = document.getElementById('dataTable');
  if (tableContainer) {
    const skeletonRows = Array.from({ length: 6 })
      .map(
        () => `
          <div class="skeleton-row">
            <div class="skeleton-line w-20"></div>
            <div class="skeleton-line w-15"></div>
            <div class="skeleton-line w-30"></div>
            <div class="skeleton-line w-25"></div>
          </div>`
      )
      .join('');

    tableContainer.innerHTML = `
      <div class="table-loading">
        <div class="skeleton skeleton-header">
          <div class="skeleton-line w-25"></div>
          <div class="skeleton-line w-20"></div>
          <div class="skeleton-line w-35"></div>
          <div class="skeleton-line w-15"></div>
        </div>
        ${skeletonRows}
      </div>
    `;
  }
}

function getFilteredRows(source = currentSheetData) {
  if (!Array.isArray(source)) return [];
  const keyword = (activeFilter.keyword || '').toLowerCase();
  const useKeyword = keyword.length > 0;
  const filterColumn = activeFilter.column || FILTER_ALL;

  if (!useKeyword && filterColumn === FILTER_ALL) {
    return [...source];
  }

  return source.filter(row => {
    if (!row || typeof row !== 'object') return false;
    const values = filterColumn === FILTER_ALL
      ? Object.values(row)
      : [row[filterColumn]];

    if (!useKeyword) {
      return true;
    }

    return values.some(val => {
      if (val === undefined || val === null) return false;
      return String(val).toLowerCase().includes(keyword);
    });
  });
}

function updateFilterOptions(headers) {
  if (!columnFilterEl) return;
  const previousColumn = activeFilter.column;
  columnFilterEl.innerHTML = '';

  const allOption = document.createElement('option');
  allOption.value = FILTER_ALL;
  allOption.textContent = 'Tất cả';
  columnFilterEl.appendChild(allOption);

  headers.forEach(header => {
    const option = document.createElement('option');
    option.value = header;
    option.textContent = header;
    columnFilterEl.appendChild(option);
  });

  if (previousColumn && headers.includes(previousColumn)) {
    columnFilterEl.value = previousColumn;
    activeFilter.column = previousColumn;
  } else {
    columnFilterEl.value = FILTER_ALL;
    activeFilter.column = FILTER_ALL;
  }

  if (keywordFilterEl && keywordFilterEl.value !== activeFilter.keyword) {
    keywordFilterEl.value = activeFilter.keyword;
  }
}

function resetFilterState() {
  activeFilter = { column: FILTER_ALL, keyword: '' };
  if (columnFilterEl) columnFilterEl.value = FILTER_ALL;
  if (keywordFilterEl) keywordFilterEl.value = '';
}

function rerenderCurrentSheet() {
  renderSummary(currentSheetData, currentSheetName, currentHeaders);
  renderTablePage(currentHeaders);
}