// 🚨 REPLACE THIS WITH YOUR GOOGLE APPS SCRIPT WEB APP URL 🚨
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbyGUp-al-UUrFIPf6Btk0Mb7Cv8x-7DPHn67JR8SAuEbYaM0jriPix62GeahktSs67b/exec'; 

let ALL_RECORDS = []; 
let DISPLAYED_RECORDS = []; 
let ACTIVE_ROW = null; 

document.addEventListener('DOMContentLoaded', async () => {
    await fetchSummary();
    await fetchRecords();
    setupEventListeners();
});

function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    const columnFilter = document.getElementById('column-filter');
    const filterInput = document.getElementById('filter-input');
    
    columnFilter.addEventListener('change', () => {
        filterInput.disabled = columnFilter.value === "";
        filterInput.placeholder = columnFilter.value === "" ? 
            "Value to search in selected column" : 
            `Search value for ${columnFilter.options[columnFilter.selectedIndex].text}`;
        applySearchFilter(); 
    });
    
    searchInput.addEventListener('input', applySearchFilter);

    // Event Delegation on the Table Body
    document.getElementById('records-tbody').addEventListener('click', handleRecordClick);

    // 🌟 NEW: Event listener for the Edit Button 🌟
    document.getElementById('edit-record-btn').addEventListener('click', handleEditClick);

    populateFilterColumns();
}

/**
 * Handles clicks on the table body using delegation.
 */
function handleRecordClick(event) {
    const clickedRow = event.target.closest('tr');

    if (clickedRow && clickedRow.dataset.householdId) {
        showDetailPanel(clickedRow.dataset.householdId, clickedRow);
    }
}

/**
 * 🌟 NEW: Handles the click on the Edit button, navigating to edit.html 🌟
 */
function handleEditClick(event) {
    const editButton = event.target;
    const householdId = editButton.dataset.householdId;
    if (householdId) {
        // Navigate to the new edit page, passing the Household_ID as a URL parameter
        window.location.href = `edit.html?id=${householdId}`;
    }
}


// === API FETCHING ===

async function fetchSummary() {
    try {
        const url = `${API_BASE_URL}?action=getSummary`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        if (data.result === 'success') {
            document.getElementById('total-households').textContent = data.data.households;
            document.getElementById('total-members').textContent = data.data.members;
            document.getElementById('total-children').textContent = data.data.children;
        } else {
            document.getElementById('status-message').textContent = `Error fetching summary: ${data.message}`;
        }
    } catch (error) {
        document.getElementById('status-message').textContent = `Failed to connect to API for summary. Check your API URL.`;
    }
}

async function fetchRecords() {
    document.getElementById('status-message').textContent = "Fetching all records...";
    try {
        const url = `${API_BASE_URL}?action=getRecords`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        if (data.result === 'success') {
            ALL_RECORDS = data.data;
            DISPLAYED_RECORDS = ALL_RECORDS;
            renderRecords(ALL_RECORDS);
            document.getElementById('status-message').style.display = 'none';
        } else {
            document.getElementById('status-message').textContent = `Error fetching records: ${data.message}`;
        }
    } catch (error) {
        document.getElementById('status-message').textContent = `Failed to connect to API for records. Check your API URL.`;
    }
}

// === DATA RENDERING AND FILTERING ===
// (Logic unchanged for filtering/searching)

function populateFilterColumns() {
    const allKeys = new Set();
    
    if (ALL_RECORDS.length > 0) {
        const sample = ALL_RECORDS[0];
        Object.keys(sample.Household).forEach(key => allKeys.add(key));
        if (sample.Members.length > 0) {
            Object.keys(sample.Members[0]).forEach(key => allKeys.add(key));
        }
        if (sample.Children.length > 0) {
            Object.keys(sample.Children[0]).forEach(key => allKeys.add(key));
        }
    }

    const select = document.getElementById('column-filter');
    const sortedKeys = Array.from(allKeys).sort();
    
    sortedKeys.forEach(key => {
        if (key.endsWith('_ID') || key === 'Timestamp' || key === 'Age') return; 
        
        const option = document.createElement('option');
        option.value = key;
        option.textContent = key.replace(/_/g, ' ');
        select.appendChild(option);
    });
}

function applySearchFilter() {
    const generalSearchTerm = document.getElementById('search-input').value.toLowerCase().trim();
    const columnFilterKey = document.getElementById('column-filter').value;
    const filterValue = document.getElementById('filter-input').value.toLowerCase().trim();

    DISPLAYED_RECORDS = ALL_RECORDS.filter(record => {
        let matchesGeneralSearch = false;
        
        if (generalSearchTerm) {
            const household = record.Household;
            
            if (
                (household.Block_Name && household.Block_Name.toString().toLowerCase().includes(generalSearchTerm)) ||
                (household.Residential_Address && household.Residential_Address.toString().toLowerCase().includes(generalSearchTerm))
            ) {
                matchesGeneralSearch = true;
            }

            if (record.Members.some(m => 
                (m.First_Name && m.First_Name.toString().toLowerCase().includes(generalSearchTerm)) || 
                (m.Last_Name && m.Last_Name.toString().toLowerCase().includes(generalSearchTerm))
            )) {
                matchesGeneralSearch = true;
            }
            
            if (record.Children.some(c => 
                (c.First_Name && c.First_Name.toString().toLowerCase().includes(generalSearchTerm)) || 
                (c.Last_Name && c.Last_Name.toString().toLowerCase().includes(generalSearchTerm))
            )) {
                matchesGeneralSearch = true;
            }
        } else {
            matchesGeneralSearch = true;
        }
        
        if (generalSearchTerm && !matchesGeneralSearch) {
            return false;
        }

        let matchesColumnFilter = false;
        if (columnFilterKey && filterValue) {
            if (record.Household[columnFilterKey] && record.Household[columnFilterKey].toString().toLowerCase().includes(filterValue)) {
                matchesColumnFilter = true;
            }
            if (record.Members.some(m => m[columnFilterKey] && m[columnFilterKey].toString().toLowerCase().includes(filterValue))) {
                matchesColumnFilter = true;
            }
            if (record.Children.some(c => c[columnFilterKey] && c[columnFilterKey].toString().toLowerCase().includes(filterValue))) {
                matchesColumnFilter = true;
            }
            
            return matchesColumnFilter; 
        } else {
            return matchesGeneralSearch; 
        }
    });

    renderRecords(DISPLAYED_RECORDS);
}

function resetFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('column-filter').value = '';
    document.getElementById('filter-input').value = '';
    document.getElementById('filter-input').disabled = true;
    applySearchFilter(); 
}

function renderRecords(records) {
    const tbody = document.getElementById('records-tbody');
    tbody.innerHTML = '';

    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No records found matching your criteria.</td></tr>';
        return;
    }

    records.forEach(record => {
        const household = record.Household;
        const row = tbody.insertRow();
        row.dataset.householdId = household.Household_ID;
        
        row.insertCell().textContent = household.Household_ID;
        row.insertCell().textContent = household.Block_Name;
        row.insertCell().textContent = household.Residential_Address;
        row.insertCell().textContent = household.Contact_No;
        row.insertCell().textContent = record.Members.length;
        row.insertCell().textContent = record.Children.length;
    });
}


// === DETAIL PANEL VIEW (PRINT & FORMATTING FIXES) ===

function showDetailPanel(householdId, clickedRow) {
    const record = ALL_RECORDS.find(r => r.Household.Household_ID === householdId);
    if (!record) return;

    const detailContent = document.getElementById('detail-content');
    const detailPanel = document.getElementById('detail-panel');
    const printBtn = detailPanel.querySelector('.print-btn');
    const editBtn = document.getElementById('edit-record-btn'); // 🌟 NEW: Get Edit Button 🌟
    
    // Highlight the clicked row
    if (ACTIVE_ROW) {
        ACTIVE_ROW.style.backgroundColor = '';
    }
    clickedRow.style.backgroundColor = '#d3eaff'; // Light blue highlight
    ACTIVE_ROW = clickedRow;
    
    // 🌟 NEW: Set Household ID on Edit button for navigation 🌟
    editBtn.dataset.householdId = householdId;

    // 🌟 FIX: Enhanced Helper to format the key 🌟
    const formatKeyForDisplay = (key) => {
        // Handle YN (Yes/No) keys
        if (key.endsWith('_YN')) {
            key = key.slice(0, -3) + ' (Yes/No)';
        }
        // Specific replacements for clarity
        if (key === 'First_Communion') return 'First Holy Communion';
        if (key === 'Date_1st_Communion') return 'Date of First Communion';
        if (key === 'Church_of_1st_Communion') return 'Church of First Communion';
        if (key === 'Civil_Court_Marriage_Date') return 'Civil Marriage Date';


        // Convert underscores to space and Title Case
        return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    // Helper to format a key-value pair
    const formatPair = (key, value) => {
        const formattedKey = formatKeyForDisplay(key);
        const formattedValue = value instanceof Date ? value.toLocaleDateString() : (value || 'N/A');
        return `<p><strong>${formattedKey}:</strong> ${formattedValue}</p>`;
    };
    
    let html = '';

    // 1. Household Section
    html += '<h2 style="color: #007bff; margin-top: 0;">Household Record: ' + record.Household.Household_ID + '</h2>';
    html += '<h3>General Information</h3>';
    for (const key in record.Household) {
        if (key !== 'Household_ID' && key !== 'Timestamp') { 
            html += formatPair(key, record.Household[key]);
        }
    }

    // 2. Members Section
    html += '<h2>Adult Members (' + record.Members.length + ')</h2>';
    record.Members.forEach((member, index) => {
        html += `<div class="member-block"><h3 style="margin-top:0;">Member ${index + 1}: ${member.First_Name || ''} ${member.Last_Name || ''}</h3>`;
        for (const key in member) {
            if (key !== 'Household_ID' && key !== 'Member_ID' && key !== 'Timestamp') {
                html += formatPair(key, member[key]);
            }
        }
        html += '</div>';
    });

    // 3. Children Section
    html += '<h2>Children Particulars (' + record.Children.length + ')</h2>';
    record.Children.forEach((child, index) => {
        html += `<div class="child-block"><h3 style="margin-top:0;">Child ${index + 1}: ${child.First_Name || ''} ${child.Last_Name || ''} (Age: ${child.Age || 'N/A'})</h3>`;
        for (const key in child) {
            if (key !== 'Household_ID' && key !== 'Child_ID' && key !== 'Timestamp') {
                html += formatPair(key, child[key]);
            }
        }
        html += '</div>';
    });

    detailContent.innerHTML = html;
    detailPanel.style.display = 'block'; 
    printBtn.style.display = 'block'; 
    editBtn.style.display = 'block'; // 🌟 NEW: Show Edit Button 🌟
}

