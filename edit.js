// edit.js
const API_BASE_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYED_SCRIPT_ID/exec'; // <-- REPLACE

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) {
    alert('No record id provided.');
    return;
  }
  init(id);
});

let currentRecord = null;

async function init(householdId) {
  try {
    setMessage('Loading record...');
    const record = await fetchRecordById(householdId);
    if (!record || record.error) {
      setMessage('Record not found.');
      return;
    }
    currentRecord = record;
    populateForm(record);
    setMessage('');
    setupButtons();
  } catch (err) {
    console.error('init error', err);
    setMessage('Error loading record.');
  }
}

function setMessage(msg) {
  document.getElementById('message').textContent = msg || '';
}

async function fetchRecordById(id) {
  const res = await fetch(`${API_BASE_URL}?action=getRecordById&id=${encodeURIComponent(id)}`);
  return await res.json();
}

function populateForm(record) {
  document.getElementById('household-id').value = record.Household_ID || '';
  document.getElementById('block-name').value = record.Block_Name || '';
  document.getElementById('residential-address').value = record.Residential_Address || '';
  document.getElementById('contact-no').value = record.Contact_No || '';

  // Clear containers
  const membersCont = document.getElementById('members-container');
  const childrenCont = document.getElementById('children-container');
  membersCont.innerHTML = '';
  childrenCont.innerHTML = '';

  // Members: record.members is expected to be array of objects or arrays.
  if (Array.isArray(record.members)) {
    record.members.forEach(m => {
      addMemberSection(m);
    });
  }

  // Children
  if (Array.isArray(record.children)) {
    record.children.forEach(c => {
      addChildSection(c);
    });
  }
}

function setupButtons() {
  document.getElementById('add-member').addEventListener('click', (e) => {
    e.preventDefault();
    addMemberSection();
  });

  document.getElementById('add-child').addEventListener('click', (e) => {
    e.preventDefault();
    addChildSection();
  });

  document.getElementById('update-btn').addEventListener('click', async () => {
    try {
      setMessage('Saving changes...');
      const payload = collectFormData();
      payload.householdId = document.getElementById('household-id').value;

      const res = await fetch(API_BASE_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'updateRecord',
          data: payload
        })
      });

      const result = await res.json();
      if (result && result.status === 'success') {
        setMessage('Record updated. Redirecting to admin...');
        // redirect back to admin dashboard
        setTimeout(() => window.location.href = 'admin.html', 600);
      } else {
        setMessage('Failed to update: ' + (result.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('update error', err);
      setMessage('Error saving changes.');
    }
  });

  document.getElementById('cancel-btn').addEventListener('click', () => {
    window.location.href = 'admin.html';
  });
}

function addMemberSection(memberData = null) {
  const cont = document.getElementById('members-container');
  const div = document.createElement('div');
  div.className = 'item';

  // If memberData is array (sheet row), try to map; else object use keys
  const name = (memberData && (memberData.Full_Name || (Array.isArray(memberData) ? memberData[2] : ''))) || '';
  const gender = (memberData && (memberData.Gender || (Array.isArray(memberData) ? memberData[3] : ''))) || '';
  const dob = (memberData && (memberData.DOB || (Array.isArray(memberData) ? memberData[4] : ''))) || '';
  const sacraments = (memberData && (memberData.Sacraments || (Array.isArray(memberData) ? memberData[5] : ''))) || '';
  const memberId = (memberData && (memberData.Member_ID || (Array.isArray(memberData) ? memberData[0] : ''))) || generateTempId('MEM');

  div.innerHTML = `
    <label>Member ID</label>
    <input class="member-id" value="${escapeHtml(memberId)}" readonly />
    <label>Full Name</label>
    <input class="member-name" value="${escapeHtml(name)}" />
    <div class="row">
      <div class="col">
        <label>Gender</label>
        <select class="member-gender">
          <option value="">--</option>
          <option value="Male" ${gender === 'Male' ? 'selected' : ''}>Male</option>
          <option value="Female" ${gender === 'Female' ? 'selected' : ''}>Female</option>
        </select>
      </div>
      <div class="col">
        <label>DOB</label>
        <input class="member-dob" type="date" value="${escapeHtml(dob)}" />
      </div>
    </div>
    <label>Sacraments</label>
    <input class="member-sacraments" value="${escapeHtml(sacraments)}" />
    <div style="margin-top:8px">
      <button class="remove-member btn btn-secondary">Remove Member</button>
    </div>
  `;

  cont.appendChild(div);

  div.querySelector('.remove-member').addEventListener('click', () => div.remove());
}

function addChildSection(childData = null) {
  const cont = document.getElementById('children-container');
  const div = document.createElement('div');
  div.className = 'item';

  const name = (childData && (childData.Full_Name || (Array.isArray(childData) ? childData[2] : ''))) || '';
  const dob = (childData && (childData.DOB || (Array.isArray(childData) ? childData[3] : ''))) || '';
  const age = (childData && (childData.Age || '')) || calculateAgeFromDate(dob);
  const sacraments = (childData && (childData.Sacraments || (Array.isArray(childData) ? childData[5] : ''))) || '';
  const childId = (childData && (childData.Child_ID || (Array.isArray(childData) ? childData[0] : ''))) || generateTempId('CHD');

  div.innerHTML = `
    <label>Child ID</label>
    <input class="child-id" value="${escapeHtml(childId)}" readonly />
    <label>Full Name</label>
    <input class="child-name" value="${escapeHtml(name)}" />
    <div class="row">
      <div class="col">
        <label>DOB</label>
        <input class="child-dob" type="date" value="${escapeHtml(dob)}" />
      </div>
      <div class="col">
        <label>Age</label>
        <input class="child-age" value="${escapeHtml(age)}" readonly />
      </div>
    </div>
    <label>Sacraments</label>
    <input class="child-sacraments" value="${escapeHtml(sacraments)}" />
    <div style="margin-top:8px">
      <button class="remove-child btn btn-secondary">Remove Child</button>
    </div>
  `;

  cont.appendChild(div);

  const dobInput = div.querySelector('.child-dob');
  dobInput.addEventListener('change', (e) => {
    const a = div.querySelector('.child-age');
    a.value = calculateAgeFromDate(e.target.value);
  });

  div.querySelector('.remove-child').addEventListener('click', () => div.remove());
}

function calculateAgeFromDate(dobStr) {
  if (!dobStr) return '';
  const dob = new Date(dobStr);
  const diff = Date.now() - dob.getTime();
  const ageDt = new Date(diff);
  return Math.abs(ageDt.getUTCFullYear() - 1970);
}

function collectFormData() {
  const household = {
    Block_Name: document.getElementById('block-name').value || '',
    Residential_Address: document.getElementById('residential-address').value || '',
    Contact_No: document.getElementById('contact-no').value || ''
  };

  const members = [];
  document.querySelectorAll('#members-container .item').forEach(node => {
    members.push({
      Member_ID: node.querySelector('.member-id').value || generateTempId('MEM'),
      Full_Name: node.querySelector('.member-name').value || '',
      Gender: node.querySelector('.member-gender').value || '',
      DOB: node.querySelector('.member-dob').value || '',
      Sacraments: node.querySelector('.member-sacraments').value || ''
    });
  });

  const children = [];
  document.querySelectorAll('#children-container .item').forEach(node => {
    children.push({
      Child_ID: node.querySelector('.child-id').value || generateTempId('CHD'),
      Full_Name: node.querySelector('.child-name').value || '',
      DOB: node.querySelector('.child-dob').value || '',
      Age: node.querySelector('.child-age').value || '',
      Sacraments: node.querySelector('.child-sacraments').value || ''
    });
  });

  return { household, members, children };
}

function generateTempId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random()*1000)}`;
}

function escapeHtml(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
