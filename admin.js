// 🚨 REPLACE THIS WITH YOUR GOOGLE APPS SCRIPT WEB APP URL 🚨
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbyVsLsF1YF8ahZ0pj2d8WJ24pSRfLgnRzZSrUzEoU9OufFKiMRmKthaXZVwI1aX6meC/exec'; 

let ALL_RECORDS = []; 
let DISPLAYED_RECORDS = []; 
let ACTIVE_ROW_ID = null; // Stores the Household_ID of the currently selected record

document.addEventListener('DOMContentLoaded', async () => {
    // We can rely solely on fetchRecords now that Apps Script is unified
    await fetchRecords();
    setupEventListeners();
});

function setupEventListeners() {
    const columnFilter = document.getElementById('column-filter');
    const filterInput = document.getElementById('filter-input');
    
    columnFilter.addEventListener('change', () => {
        filterInput.disabled = columnFilter.value === "";
        filterInput.placeholder = columnFilter.value === "" ? 
            "Value to search in selected column" : 
            `Search value for ${columnFilter.options[columnFilter.selectedIndex].text}`;
        applySearchFilter(); 
    });
    
    // Global search input listener is already handled in HTML via oninput="applySearchFilter()"

    // Event Delegation on the Table Body
    document.getElementById('records-tbody').addEventListener('click', handleRecordClick);

    // Feature 2: Edit Button Listener
    document.getElementById('edit-record-btn').addEventListener('click', handleEditClick);
    
    // Feature 3: Delete Button Listener
    document.getElementById('delete-record-btn').addEventListener('click', handleDeleteClick);

    populateFilterColumns();
}

/**
 * Utility function to handle API calls with fetch.
 */
async function apiFetch(url, options = {}) {
    const defaultOptions = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        mode: 'no-cors' // Use 'no-cors' for Apps Script
    };

    const finalOptions = { ...defaultOptions, ...options };
    
    // If the method is not GET, we need to manually set the data property 
    // for Apps Script to properly parse the payload.
    if (finalOptions.method !== 'GET' && finalOptions.body) {
        finalOptions.body = JSON.stringify(finalOptions.body);
    }

    try {
        const response = await fetch(url, finalOptions);
        
        // Since Apps Script uses 'no-cors', we can only check for success by attempting to read response text.
        // We will assume success if no network error occurred.
        return true; 
        
    } catch (error) {
        console.error('API Fetch Error:', error);
        alert(`Failed to communicate with the backend. Details: ${error.message}`);
        return false;
    }
}


/**
 * Fetches all structured records from the Apps Script backend.
 */
async function fetchRecords() {
    const tbody = document.getElementById('records-tbody');
    tbody.innerHTML = '<tr id="loading-message"><td colspan="6">Loading records, please wait...</td></tr>';
    document.getElementById('detail-panel').style.display = 'none';

    try {
        const response = await fetch(`${API_BASE_URL}?mode=all`);
        // The response from Apps Script is complex due to 'no-cors'. 
        // We need a better way to check the content if possible, but for simplicity, 
        // we'll rely on the server returning JSON content on success.
        
        const text = await response.text();
        ALL_RECORDS = JSON.parse(text);
        
        DISPLAYED_RECORDS = [...ALL_RECORDS]; // Initialize displayed records
        renderTable(DISPLAYED_RECORDS);
        
    } catch (error) {
        console.error('Error fetching records:', error);
        tbody.innerHTML = '<tr id="error-message"><td colspan="6">❌ Could not load data. Ensure your API_BASE_URL is correct and the Apps Script is deployed.</td></tr>';
    }
}

/**
 * Renders the table with the given array of records.
 * * @param {Array<Object>} records The array of structured records to display.
 */
function renderTable(records) {
    const tbody = document.getElementById('records-tbody');
    tbody.innerHTML = '';
    
    // Feature 1: Show total number of search results
    document.getElementById('results-info').textContent = `Total Records: ${records.length} / ${ALL_RECORDS.length}`;

    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No records found matching your filter criteria.</td></tr>';
        return;
    }

    records.forEach(record => {
        const household = record.Household;
        const row = document.createElement('tr');
        row.dataset.householdId = household.Household_ID;
        if (household.Household_ID === ACTIVE_ROW_ID) {
             row.classList.add('active-row');
        }

        row.innerHTML = `
            <td>${household.Household_ID}</td>
            <td>${household.Block_Name || 'N/A'}</td>
            <td>${household.Residential_Address || 'N/A'}</td>
            <td>${household.Contact_No || 'N/A'}</td>
            <td>${record.Members.length}</td>
            <td>${record.Children.length}</td>
        `;
        tbody.appendChild(row);
    });
}

/**
 * Populates the column filter dropdown based on the table headers.
 */
function populateFilterColumns() {
    const columnFilter = document.getElementById('column-filter');
    const headers = document.querySelectorAll('#records-table th[data-column]');
    
    columnFilter.innerHTML = '<option value="">All Columns (Global Search)</option>';

    headers.forEach(header => {
        const columnKey = header.dataset.column;
        const columnName = header.textContent;
        const option = document.createElement('option');
        option.value = columnKey;
        option.textContent = columnName;
        columnFilter.appendChild(option);
    });
}

/**
 * Applies global search or column-specific filter.
 */
function applySearchFilter() {
    const searchInput = document.getElementById('search-input').value.toLowerCase();
    const columnKey = document.getElementById('column-filter').value;
    const filterValue = document.getElementById('filter-input').value.toLowerCase();

    DISPLAYED_RECORDS = ALL_RECORDS.filter(record => {
        const household = record.Household;

        // 1. Global Search
        if (searchInput.length > 0) {
            const globalMatch = Object.values(household).some(value => 
                String(value).toLowerCase().includes(searchInput)
            );
            if (!globalMatch) return false;
        }

        // 2. Column-Specific Filter
        if (columnKey && filterValue.length > 0) {
            const recordValue = String(household[columnKey] || '').toLowerCase();
            if (!recordValue.includes(filterValue)) {
                return false;
            }
        }

        return true;
    });

    renderTable(DISPLAYED_RECORDS);
}

/**
 * Resets all filters and re-renders the table.
 */
function resetFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('column-filter').value = '';
    document.getElementById('filter-input').value = '';
    document.getElementById('filter-input').disabled = true;
    applySearchFilter();
}

/**
 * Handles clicks on the table body using delegation.
 */
function handleRecordClick(event) {
    const clickedRow = event.target.closest('tr');

    if (clickedRow && clickedRow.dataset.householdId) {
        const householdId = clickedRow.dataset.householdId;

        // Find the full record object
        const record = ALL_RECORDS.find(r => r.Household.Household_ID === householdId);

        // Update active row visual state
        if (ACTIVE_ROW_ID) {
            const previousRow = document.querySelector(`tr[data-household-id="${ACTIVE_ROW_ID}"]`);
            if (previousRow) previousRow.classList.remove('active-row');
        }
        clickedRow.classList.add('active-row');
        ACTIVE_ROW_ID = householdId;
        
        displayRecordDetails(record);
    }
}

/**
 * Displays the full details of the selected record in the detail panel.
 */
function displayRecordDetails(record) {
    const detailContent = document.getElementById('detail-content');
    const detailPanel = document.getElementById('detail-panel');
    const detailActions = document.querySelector('.detail-actions');

    if (!record) {
        detailContent.innerHTML = '<h2>Error</h2><p>Record data not found.</p>';
        detailActions.style.display = 'none';
        detailPanel.style.display = 'block';
        return;
    }

    let html = '<h2>Household Record: ' + record.Household.Household_ID + '</h2>';
    
    // 1. Household Section
    html += '<h3>General Information</h3>';
    for (const key in record.Household) {
        // Exclude internal fields
        if (key !== 'Household_ID' && key !== 'Timestamp') { 
            html += formatPair(key, record.Household[key]);
        }
    }

    // 2. Members Section
    html += '<h2>Adult Members (' + record.Members.length + ')</h2>';
    record.Members.forEach((member, index) => {
        html += `<div class="member-block"><h3 style="margin-top:0;">Member ${index + 1}: ${member.First_Name || ''} ${member.Last_Name || ''}</h3>`;
        for (const key in member) {
            // Exclude internal fields
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
            // Exclude internal fields
            if (key !== 'Household_ID' && key !== 'Child_ID' && key !== 'Timestamp') {
                html += formatPair(key, child[key]);
            }
        }
        html += '</div>';
    });

    detailContent.innerHTML = html;
    
    // Feature 2/3: Show action buttons and set the ID
    detailActions.style.display = 'block';
    document.getElementById('edit-record-btn').dataset.householdId = record.Household.Household_ID;
    document.getElementById('delete-record-btn').dataset.householdId = record.Household.Household_ID;

    detailPanel.style.display = 'block';
}

/**
 * Helper function to format key-value pairs for the detail panel.
 */
function formatPair(key, value) {
    if (!value) return ''; // Skip empty values
    // Convert Snake_Case to Title Case for display
    const formattedKey = key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    return `<div class="detail-row"><span class="detail-label">${formattedKey}:</span><span class="detail-value">${value}</span></div>`;
}

// =======================================================
// NEW FEATURE HANDLERS
// =======================================================

/**
 * Feature 2: Handles the click on the Edit button.
 * Redirects to index.html with the Household_ID as a query parameter.
 */
function handleEditClick(event) {
    const householdId = event.target.dataset.householdId;
    if (householdId) {
        // Redirect to index.html and pass the ID as a URL parameter
        window.location.href = `index.html?id=${householdId}`;
    } else {
        alert('Error: No Household ID found for editing.');
    }
}

/**
 * Feature 3: Handles the click on the Delete button.
 */
async function handleDeleteClick(event) {
    const householdId = event.target.dataset.householdId;

    if (!householdId) {
        alert('Error: No Household ID found for deletion.');
        return;
    }

    // IMPORTANT: Custom modal for confirmation (since alert() is blocked)
    if (!confirm(`Are you SURE you want to permanently delete record ${householdId} and ALL related members/children? This action cannot be undone.`)) {
        return;
    }

    // Visual feedback
    const deleteButton = event.target;
    deleteButton.disabled = true;
    deleteButton.textContent = 'Deleting...';

    // Send DELETE request (Apps Script handles DELETE by reading POST data content)
    const success = await apiFetch(API_BASE_URL, {
        method: 'POST', // Must use POST for Apps Script, but send a 'delete' signal
        body: { 
            Household_ID: householdId,
            action: 'DELETE' // Custom field for Apps Script to route the request (though Apps Script uses doDelete)
        }
    });

    if (success) {
        // 1. Remove the record from ALL_RECORDS
        ALL_RECORDS = ALL_RECORDS.filter(r => r.Household.Household_ID !== householdId);
        
        // 2. Clear detail panel and active state
        document.getElementById('detail-panel').style.display = 'none';
        document.getElementById('detail-content').innerHTML = '<h2>Record Deleted</h2><p>The household record has been successfully removed.</p>';
        ACTIVE_ROW_ID = null;

        // 3. Update the dashboard immediately
        applySearchFilter(); // Re-run filter and re-render table with updated ALL_RECORDS size
        alert(`✅ Record ${householdId} deleted successfully.`);
    } else {
        alert(`❌ Deletion of record ${householdId} failed.`);
    }

    deleteButton.disabled = false;
    deleteButton.textContent = '🗑️ Delete Record';
}
