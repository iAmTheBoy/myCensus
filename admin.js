// 🚨 REPLACE THIS WITH YOUR GOOGLE APPS SCRIPT WEB APP URL 🚨
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbxCETjVqQEAl_BAoW3wuUM9nCJWTfcJdPG_IQtk_Awqtgy2NyMMQa88PVLehuqQNnaQ/exec'; 

let ALL_RECORDS = []; 
let DISPLAYED_RECORDS = []; 
let ACTIVE_ROW = null; 
let ACTIVE_HOUSEHOLD_ID = null;

// --- Utility Functions ---

function displayStatus(message, isSuccess = true) {
    const statusDiv = document.getElementById('status-message');
    statusDiv.textContent = message;
    statusDiv.className = isSuccess ? 'alert alert-success' : 'alert alert-error';
    statusDiv.style.display = 'block';
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 5000);
}

function formatPair(key, value) {
    // Converts snake_case keys to Title Case for display
    const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    
    // Format date values nicely
    if (formattedKey.includes('Date') && value && value.length > 0) {
        try {
            const date = new Date(value);
            // Check if date is valid before formatting
            if (!isNaN(date)) {
                value = date.toLocaleDateString();
            }
        } catch (e) {
            // Keep original value if date parsing fails
        }
    }

    return `<div class="detail-pair"><strong>${formattedKey}:</strong> ${value || 'N/A'}</div>`;
}

// --- Setup & Fetching ---

document.addEventListener('DOMContentLoaded', async () => {
    await fetchSummary();
    await fetchRecords();
    setupEventListeners();
});

function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    const columnFilter = document.getElementById('column-filter');
    const filterInput = document.getElementById('filter-input');
    const editBtn = document.getElementById('edit-record-btn');
    const deleteBtn = document.getElementById('delete-record-btn');
    
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

    // Event listeners for new buttons
    editBtn.addEventListener('click', () => openEditForm(ACTIVE_HOUSEHOLD_ID));
    deleteBtn.addEventListener('click', () => confirmDeleteRecord(ACTIVE_HOUSEHOLD_ID));

    populateFilterColumns();
}

async function fetchRecords() {
    displayStatus('Fetching all household records...', false);
    try {
        const response = await fetch(API_BASE_URL);
        const data = await response.json();
        
        ALL_RECORDS = data.records || [];
        DISPLAYED_RECORDS = ALL_RECORDS;
        
        renderRecords(DISPLAYED_RECORDS);
        
        displayStatus('Records loaded successfully.', true);
    } catch (error) {
        console.error('Error fetching records:', error);
        displayStatus('Error fetching records. Check console for details.', false);
    }
}

async function fetchSummary() {
    try {
        const response = await fetch(API_BASE_URL);
        const data = await response.json();
        const summary = data.summary;
        
        document.getElementById('total-households').textContent = summary.households;
        document.getElementById('total-members').textContent = summary.members;
        document.getElementById('total-children').textContent = summary.children;
    } catch (error) {
        console.error('Error fetching summary:', error);
    }
}

// --- Record Display & Filtering ---

function renderRecords(records) {
    const tbody = document.getElementById('records-tbody');
    tbody.innerHTML = '';
    
    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No records found.</td></tr>';
    }

    records.forEach(record => {
        const row = tbody.insertRow();
        row.dataset.householdId = record.Household.Household_ID;
        // Store the original index in ALL_RECORDS for easy lookup
        const originalIndex = ALL_RECORDS.findIndex(r => r.Household.Household_ID === record.Household.Household_ID);
        row.dataset.index = originalIndex; 
        
        row.innerHTML = `
            <td>${record.Household.Household_ID}</td>
            <td>${record.Household.Block_Name || 'N/A'}</td>
            <td>${record.Household.Residential_Address || 'N/A'}</td>
            <td>${record.Household.Contact_No || 'N/A'}</td>
            <td>${record.Members.length}</td>
            <td>${record.Children.length}</td>
        `;
    });
    
    // Feature 1: Update result count
    document.getElementById('result-count').textContent = `Showing ${records.length} of ${ALL_RECORDS.length} records`;
}

function applySearchFilter() {
    const globalSearchTerm = document.getElementById('search-input').value.toLowerCase();
    const columnFilterKey = document.getElementById('column-filter').value;
    const columnFilterTerm = document.getElementById('filter-input').value.toLowerCase();
    
    DISPLAYED_RECORDS = ALL_RECORDS.filter(record => {
        // Global Search (in Household, Member names, Child names)
        const globalMatch = 
            JSON.stringify(record.Household).toLowerCase().includes(globalSearchTerm) ||
            record.Members.some(m => `${m.First_Name} ${m.Last_Name}`.toLowerCase().includes(globalSearchTerm)) ||
            record.Children.some(c => `${c.First_Name} ${c.Last_Name}`.toLowerCase().includes(globalSearchTerm));

        // Column Filter
        let columnMatch = true;
        if (columnFilterKey && columnFilterTerm) {
            // Check only the Household object for the specific key
            const value = (record.Household[columnFilterKey] || '').toString().toLowerCase();
            columnMatch = value.includes(columnFilterTerm);
        }

        return (globalSearchTerm === '' || globalMatch) && columnMatch;
    });
    
    renderRecords(DISPLAYED_RECORDS);
}

function resetFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('column-filter').value = '';
    document.getElementById('filter-input').value = '';
    document.getElementById('filter-input').disabled = true;
    DISPLAYED_RECORDS = ALL_RECORDS;
    renderRecords(DISPLAYED_RECORDS);
}

function populateFilterColumns() {
    // Columns from the table header data-column attributes
    const columns = [
        { key: 'Household_ID', name: 'Household ID' },
        { key: 'Block_Name', name: 'Block Name' },
        { key: 'Residential_Address', name: 'Address' },
        { key: 'Contact_No', name: 'Contact No' }
    ];
    
    const select = document.getElementById('column-filter');
    columns.forEach(col => {
        const option = document.createElement('option');
        option.value = col.key;
        option.textContent = col.name;
        select.appendChild(option);
    });
}

/**
 * Handles clicks on the table body using delegation and shows the detail panel.
 */
function handleRecordClick(event) {
    const clickedRow = event.target.closest('tr');
    if (!clickedRow || !clickedRow.dataset.householdId) return;

    // Remove active class from previous active row
    if (ACTIVE_ROW) {
        ACTIVE_ROW.classList.remove('active-row');
    }

    // Set new active row and its ID
    ACTIVE_ROW = clickedRow;
    ACTIVE_ROW.classList.add('active-row');
    ACTIVE_HOUSEHOLD_ID = clickedRow.dataset.householdId;
    
    const recordIndex = parseInt(clickedRow.dataset.index);
    const selectedRecord = ALL_RECORDS[recordIndex];

    if (selectedRecord) {
        showDetailPanel(selectedRecord);
    } else {
        document.getElementById('detail-panel').style.display = 'none';
    }
}

/**
 * Renders the full details of the selected record in the detail panel.
 */
function showDetailPanel(record) {
    const detailPanel = document.getElementById('detail-panel');
    const detailContent = document.getElementById('detail-content');
    const detailActionsContainer = document.getElementById('detail-actions-container');

    // 1. Start building the HTML content
    let html = '<h2>Household Record: ' + record.Household.Household_ID + '</h2>';
    html += '<h3>General Information</h3>';
    
    // Household Info
    for (const key in record.Household) {
        if (key !== 'Household_ID') {
            html += formatPair(key, record.Household[key]);
        }
    }

    // 2. Members Section
    html += '<h2>Adult Members (' + record.Members.length + ')</h2>';
    if (record.Members.length === 0) {
        html += '<p>No adult members recorded.</p>';
    } else {
        record.Members.forEach((member, index) => {
            html += `<div class="member-block"><h3 style="margin-top:0;">Member ${index + 1}: ${member.First_Name || ''} ${member.Last_Name || ''}</h3>`;
            for (const key in member) {
                if (key !== 'Household_ID' && key !== 'Member_ID' && key !== 'Timestamp') {
                    html += formatPair(key, member[key]);
                }
            }
            html += '</div>';
        });
    }

    // 3. Children Section
    html += '<h2>Children Particulars (' + record.Children.length + ')</h2>';
    if (record.Children.length === 0) {
        html += '<p>No children recorded.</p>';
    } else {
        record.Children.forEach((child, index) => {
            html += `<div class="child-block"><h3 style="margin-top:0;">Child ${index + 1}: ${child.First_Name || ''} ${child.Last_Name || ''} (Age: ${child.Age || 'N/A'})</h3>`;
            for (const key in child) {
                if (key !== 'Household_ID' && key !== 'Child_ID' && key !== 'Timestamp') {
                    html += formatPair(key, child[key]);
                }
            }
            html += '</div>';
        });
    }

    // 4. Update the panel
    detailContent.innerHTML = html;
    detailPanel.style.display = 'block'; // Show the panel
    detailActionsContainer.style.display = 'flex'; // Show the action buttons
    document.querySelector('.print-btn').style.display = 'block'; // Show print button
}

// --- Feature 2: Edit Record ---

function openEditForm(householdId) {
    if (householdId) {
        // Opens the index.html (unified form) with the household ID as a query parameter
        window.open(`index.html?id=${householdId}`, '_blank');
    } else {
        displayStatus('Error: No Household ID selected for editing.', false);
    }
}

// --- Feature 3: Delete Record ---

function confirmDeleteRecord(householdId) {
    // Custom prompt replacement since window.confirm() is disallowed
    const confirmation = prompt(`Are you sure you want to permanently delete the record for Household ID: ${householdId}? Type YES to confirm.`);
    
    if (confirmation && confirmation.toUpperCase() === 'YES') {
        deleteRecord(householdId);
    } else if (confirmation !== null) {
        displayStatus('Deletion cancelled.', true);
    }
}

async function deleteRecord(householdId) {
    displayStatus(`Deleting record ${householdId}...`, false);
    
    try {
        const payload = {
            action: 'DELETE', // Signal to Apps Script to execute the delete logic
            Household_ID: householdId
        };
        
        await fetch(API_BASE_URL, {
            method: 'POST', // Use POST for Apps Script web app
            mode: 'no-cors', 
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        
        // Wait a moment for Apps Script to process the deletion before re-fetching
        await new Promise(resolve => setTimeout(resolve, 1500)); 

        // Update the dashboard immediately by re-fetching
        await fetchSummary();
        await fetchRecords();

        // Clear detail panel and active state
        document.getElementById('detail-content').innerHTML = '<h2>Select a Record to View Details</h2><p>Click on any row in the table to display the full household, member, and child data here. This view is printable.</p>';
        document.getElementById('detail-panel').style.display = 'none';
        ACTIVE_ROW = null;
        ACTIVE_HOUSEHOLD_ID = null;

        displayStatus(`✅ Record ${householdId} deleted and dashboard updated.`, true);

    } catch (error) {
        console.error('Deletion Error:', error);
        displayStatus('❌ Error deleting record. Check console for details.', false);
    }
}
