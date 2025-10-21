// admin.js
const API_BASE_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYED_SCRIPT_ID/exec'; // <-- REPLACE

let ALL_RECORDS = [];
let DISPLAYED_RECORDS = [];

document.addEventListener('DOMContentLoaded', () => {
  init();
});

async function init() {
  await fetchSummary();
  await fetchRecords();
  setupEventListeners();
}

function setupEventListeners() {
  document.getElementById('search-btn').addEventListener('click', applySearchFilter);
  document.getElementById('refresh-btn').addEventListener('click', fetchRecords);
  document.getElementById('close-detail-btn').addEventListener('click', () => {
    document.getElementById('detail-panel').style.display = 'none';
  });
  document.getElementById('print-btn').addEventListener('click', () => window.print());

  // Edit button - handler assigned when showing detail
  // Row click: delegate
  document.getElementById('records-tbody').addEventListener('click', handleRecordRowClick);
}

async function fetchSummary() {
  try {
    const res = await fetch(`${API_BASE_URL}?action=summary`);
    const data = await res.json();
    document.getElementById('household-count').textContent = data.households || 0;
    document.getElementById('member-count').textContent = data.members || 0;
    document.getElementById('child-count').textContent = data.children || 0;
  } catch (err) {
    console.error('fetchSummary error', err);
  }
}

async function fetchRecords() {
  try {
    const res = await fetch(`${API_BASE_URL}?action=fetchRecords`);
    const data = await res.json();
    ALL_RECORDS = data || [];
    DISPLAYED_RECORDS = [...ALL_RECORDS];
    renderTable(DISPLAYED_RECORDS);
  } catch (err) {
    console.error('fetchRecords error', err);
  }
}

function renderTable(records) {
  const tbody = document.getElementById('records-tbody');
  tbody.innerHTML = '';
  records.forEach(record => {
    const tr = document.createElement('tr');
    tr.dataset.householdId = record.Household_ID;
    tr.innerHTML = `
      <td>${escapeHtml(record.Household_ID || '')}</td>
      <td>${escapeHtml(record.Block_Name || '')}</td>
      <td>${escapeHtml(record.Residential_Address || '')}</td>
      <td>${escapeHtml(record.Contact_No || '')}</td>
    `;
    tbody.appendChild(tr);
  });
}

function handleRecordRowClick(event) {
  const tr = event.target.closest('tr');
  if (!tr) return;
  const householdId = tr.dataset.householdId;
  const record = ALL_RECORDS.find(r => r.Household_ID === householdId);
  if (!record) return;
  showDetailPanel(record);
}

function showDetailPanel(record) {
  const panel = document.getElementById('detail-panel');
  const content = document.getElementById('detail-content');
  content.innerHTML = '';

  const hh = document.createElement('div');
  hh.innerHTML = `
    <strong>ID:</strong> ${escapeHtml(record.Household_ID || '')}<br/>
    <strong>Block:</strong> ${escapeHtml(record.Block_Name || '')}<br/>
    <strong>Address:</strong> ${escapeHtml(record.Residential_Address || '')}<br/>
    <strong>Contact:</strong> ${escapeHtml(record.Contact_No || '')}<br/>
    <hr/>
    <strong>Members</strong>
  `;
  content.appendChild(hh);

  const membersList = document.createElement('div');
  if (Array.isArray(record.members) && record.members.length) {
    record.members.forEach(m => {
      const mdiv = document.createElement('div');
      // if members in backend are objects, adapt accordingly; here we assume object properties
      if (typeof m === 'object') {
        mdiv.textContent = `${m.Full_Name || ''} — ${m.Gender || ''} — ${m.DOB || ''}`;
      } else {
        // if members came as array of rows, join
        mdiv.textContent = m.join(' | ');
      }
      membersList.appendChild(mdiv);
    });
  } else {
    membersList.textContent = 'No members recorded';
  }
  content.appendChild(membersList);

  const childrenHeader = document.createElement('div');
  childrenHeader.innerHTML = '<hr/><strong>Children</strong>';
  content.appendChild(childrenHeader);

  const childrenList = document.createElement('div');
  if (Array.isArray(record.children) && record.children.length) {
    record.children.forEach(c => {
      const cdiv = document.createElement('div');
      if (typeof c === 'object') {
        cdiv.textContent = `${c.Full_Name || ''} — ${c.DOB || ''} — Age: ${c.Age || ''}`;
      } else {
        cdiv.textContent = c.join(' | ');
      }
      childrenList.appendChild(cdiv);
    });
  } else {
    childrenList.textContent = 'No children recorded';
  }
  content.appendChild(childrenList);

  // Assign edit button action
  document.getElementById('edit-btn').onclick = () => openEditPage(record.Household_ID);

  panel.style.display = 'block';
}

function openEditPage(householdId) {
  if (!householdId) {
    alert('No Household ID selected for edit.');
    return;
  }
  // Redirect to edit page with ID in query param
  window.location.href = `edit.html?id=${encodeURIComponent(householdId)}`;
}

function applySearchFilter() {
  const q = (document.getElementById('search-input').value || '').toLowerCase();
  DISPLAYED_RECORDS = ALL_RECORDS.filter(r => {
    return (r.Block_Name || '').toLowerCase().includes(q) ||
           (r.Residential_Address || '').toLowerCase().includes(q) ||
           (r.Contact_No || '').toLowerCase().includes(q) ||
           (r.Household_ID || '').toLowerCase().includes(q);
  });
  renderTable(DISPLAYED_RECORDS);
}

function escapeHtml(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
