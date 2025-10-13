// 🚨 REPLACE THIS WITH YOUR GOOGLE APPS SCRIPT WEB APP URL 🚨
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbw05JwN3QBtcv7QOy08v2xg_sZPLO3wu8jKQG-eEzSf0kxn5ZclTElWbf0ugll8pjsk/exec'; 

let ALL_RECORDS = []; 
let DISPLAYED_RECORDS = []; 
let ACTIVE_ROW = null; 
let ACTIVE_RECORD = null; // Store the currently displayed record object

document.addEventListener('DOMContentLoaded', async () => {
    // Fetch initial data
    await fetchRecords(true); // Fetch and display all records
    setupEventListeners();
});

/**
 * Fetches all records and summary data from the Apps Script.
 * @param {boolean} initialLoad - Flag to indicate if it's the initial load (to show all records).
 */
async function fetchRecords(initialLoad = false) {
    try {
        const response = await fetch(API_BASE_URL);
        const result = await response.json();

        if (result && result.records) {
            ALL_RECORDS = result.records;
            if (initialLoad) {
                DISPLAYED_RECORDS = ALL_RECORDS;
                renderTable(DISPLAYED_RECORDS);
                updateSummary(result.summary);
                updateRecordsCount(DISPLAYED_RECORDS.length, ALL_RECORDS.length);
            }
        } else {
            console.error('Failed to fetch records or invalid response structure:', result);
        }
    } catch (error) {
        console.error('Network Error during fetchRecords:', error);
    }
}

/**
 * Fetches only the summary data. Called separately after CUD operations.
 */
async function fetchSummary() {
    try {
        const response = await fetch(API_BASE_URL);
        const result = await response.json();
        if (result && result.summary) {
            updateSummary(result.summary);
        }
    } catch (error) {
        console.error('Network Error during fetchSummary:', error);
    }
}


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

    // NEW: Detail panel action buttons
    document.getElementById('edit-record-btn').addEventListener('click', handleEditClick);
    document.getElementById('delete-record-btn').addEventListener('click', handleDeleteClick);

    populateFilterColumns();
}

/**
 * Populates the column filter dropdown based on table headers.
 */
function populateFilterColumns() {
    const columnFilter = document.getElementById('column-filter');
    const headers = document.querySelectorAll('#records-table th[data-column]');
    
    headers.forEach(th => {
        const columnName = th.dataset.column;
        const columnTitle = th.textContent;
        const option = document.createElement('option');
        option.value = columnName;
        option.textContent = columnTitle;
        columnFilter.appendChild(option);
    });
}

/**
 * Handles clicks on the table body using delegation to display details.
 */
function handleRecordClick(event) {
    const clickedRow = event.target.closest('tr');
    const tbody = document.getElementById('records-tbody');

    if (clickedRow && clickedRow.dataset.householdId) {
        const householdId = clickedRow.dataset.householdId;
        
        // Remove 'active-row' class from previously active row
        if (ACTIVE_ROW) {
            ACTIVE_ROW.classList.remove('active-row');
        }

        // Set new active row and record
        clickedRow.classList.add('active-row');
        ACTIVE_ROW = clickedRow;
        
        ACTIVE_RECORD = ALL_RECORDS.find(r => r.Household.Household_ID === householdId);
        
        if (ACTIVE_RECORD) {
            displayRecordDetails(ACTIVE_RECORD);
        }
    }
}

/**
 * Implements Feature 4: Redirect to the edit page with the Household ID.
 */
function handleEditClick() {
    if (ACTIVE_RECORD && ACTIVE_RECORD.Household.Household_ID) {
        // Redirect to the new edit_record.html page with the ID as a query parameter
        window.open(`edit_record.html?id=${ACTIVE_RECORD.Household.Household_ID}`, '_blank');
    }
}

/**
 * Implements Feature 3: Deletes the active record.
 */
async function handleDeleteClick() {
    if (!ACTIVE_RECORD || !ACTIVE_RECORD.Household.Household_ID) return;

    const householdId = ACTIVE_RECORD.Household.Household_ID;
    
    if (!confirm(`Are you sure you want to permanently delete Household Record ID: ${householdId}? This action cannot be undone.`)) {
        return;
    }

    const deleteButton = document.getElementById('delete-record-btn');
    const originalText = deleteButton.textContent;
    
    deleteButton.disabled = true;
    deleteButton.textContent = 'Deleting...';

    const payload = {
        command: 'DELETE',
        household: {
            Household_ID: householdId
        }
    };

    try {
        // Send DELETE command to Apps Script via POST
        const response = await fetch(API_BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json();
        
        if (result.status === 'SUCCESS') {
            alert(result.message);
            // Refresh the entire dashboard
            await fetchRecords(true); 
            // Hide and clear the detail panel
            document.getElementById('detail-panel').style.display = 'none';
            document.getElementById('detail-content').innerHTML = '<h2>Select a Record to View Details</h2><p>Record deleted. Click on any row in the table to display the full household, member, and child data here.</p>';
            document.getElementById('detail-actions').style.display = 'none';
            ACTIVE_RECORD = null;
            ACTIVE_ROW = null;
        } else {
            throw new Error(result.message || 'Deletion failed.');
        }

    } catch (error) {
        console.error('Deletion Error:', error);
        alert(`Failed to delete record: ${error.message}`);
    } finally {
        deleteButton.disabled = false;
        deleteButton.textContent = originalText;
    }
}


/**
 * Renders the table body with the provided array of records.
 * @param {Array<Object>} records - The array of records to display.
 */
function renderTable(records) {
    const tbody = document.getElementById('records-tbody');
    tbody.innerHTML = ''; // Clear existing rows

    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No records found matching the criteria.</td></tr>';
        return;
    }

    records.forEach(record => {
        const row = tbody.insertRow();
        row.dataset.householdId = record.Household.Household_ID;
        
        row.innerHTML = `
            <td>${record.Household.Household_ID}</td>
            <td>${record.Household.Block_Name || 'N/A'}</td>
            <td>${record.Household.Residential_Address || 'N/A'}</td>
            <td>${record.Household.Contact_No || 'N/A'}</td>
            <td>${record.Members.length}</td>
            <td>${record.Children.length}</td>
        `;
    });
}

/**
 * Updates the summary boxes with the latest counts. (Original logic)
 * @param {Object} summary - The summary counts object.
 */
function updateSummary(summary) {
    document.getElementById('total-households').textContent = summary.totalHouseholds || 0;
    document.getElementById('total-members').textContent = summary.totalMembers || 0;
    document.getElementById('total-children').textContent = summary.totalChildren || 0;
}

/**
 * Implements Feature 1: Updates the records count display.
 * @param {number} displayedCount - The number of records currently displayed (filtered).
 * @param {number} totalCount - The total number of records fetched.
 */
function updateRecordsCount(displayedCount, totalCount) {
    const countElement = document.getElementById('records-count');
    if (displayedCount === totalCount) {
        countElement.textContent = `Displaying all ${totalCount} records.`;
    } else {
        countElement.textContent = `Showing ${displayedCount} of ${totalCount} total records.`;
    }
}

/**
 * Applies search and column filters to ALL_RECORDS.
 */
function applySearchFilter() {
    const globalSearchTerm = document.getElementById('search-input').value.toLowerCase();
    const columnFilterKey = document.getElementById('column-filter').value;
    const columnFilterTerm = document.getElementById('filter-input').value.toLowerCase();
    
    let filtered = ALL_RECORDS;

    // 1. Apply Column Filter
    if (columnFilterKey && columnFilterTerm) {
        filtered = filtered.filter(record => {
            // Check Household info
            if (record.Household[columnFilterKey] && String(record.Household[columnFilterKey]).toLowerCase().includes(columnFilterTerm)) {
                return true;
            }
            // Check Members (only for non-household specific keys)
            if (columnFilterKey !== 'Household_ID' && record.Members.some(member => 
                member[columnFilterKey] && String(member[columnFilterKey]).toLowerCase().includes(columnFilterTerm)
            )) {
                return true;
            }
            // Check Children (only for non-household specific keys)
            if (columnFilterKey !== 'Household_ID' && record.Children.some(child => 
                child[columnFilterKey] && String(child[columnFilterKey]).toLowerCase().includes(columnFilterTerm)
            )) {
                return true;
            }
            return false;
        });
    }

    // 2. Apply Global Search (across all visible data fields)
    if (globalSearchTerm) {
        filtered = filtered.filter(record => {
            // Convert record to a searchable string (Household, Members, Children)
            const searchableString = JSON.stringify(record).toLowerCase();
            return searchableString.includes(globalSearchTerm);
        });
    }

    DISPLAYED_RECORDS = filtered;
    renderTable(DISPLAYED_RECORDS);
    updateRecordsCount(DISPLAYED_RECORDS.length, ALL_RECORDS.length);
}

/**
 * Resets all filters and displays all records.
 */
function resetFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('column-filter').value = '';
    document.getElementById('filter-input').value = '';
    document.getElementById('filter-input').disabled = true;
    document.getElementById('filter-input').placeholder = "Value to search in selected column";
    
    DISPLAYED_RECORDS = ALL_RECORDS;
    renderTable(DISPLAYED_RECORDS);
    updateRecordsCount(DISPLAYED_RECORDS.length, ALL_RECORDS.length);
}


/**
 * Implements Feature 2: Displays the full details of the selected record.
 * @param {Object} record - The full household record object.
 */
function displayRecordDetails(record) {
    const detailPanel = document.getElementById('detail-panel');
    const detailContent = document.getElementById('detail-content');
    const detailActions = document.getElementById('detail-actions');
    
    detailPanel.style.display = 'block';
    detailActions.style.display = 'flex';

    let html = '<h2>Household Record: ' + record.Household.Household_ID + '</h2>';
    html += '<h3>General Information</h3>';
    
    // 1. Household Section
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
}

/**
 * Helper function to format a key-value pair for the detail panel.
 */
function formatPair(key, value) {
    // Basic date formatting
    let displayValue = value;
    if (value instanceof Date) {
        displayValue = value.toLocaleDateString();
    } else if (typeof value === 'string' && value.match(/\\d{4}-\\d{2}-\\d{2}/)) {
        // Simple check for YYYY-MM-DD string, often what comes from date pickers
        displayValue = new Date(value).toLocaleDateString();
    } else if (typeof value === 'object' && value !== null) {
        // If it's a date object from Apps Script JSON
        if (value.constructor.name === 'Date') {
            displayValue = value.toLocaleDateString();
        } else {
            displayValue = String(value);
        }
    } else if (displayValue === null || displayValue === undefined || displayValue === '') {
        displayValue = 'N/A';
    }

    return `<div class="detail-item"><strong>${key.replace(/_/g, ' ')}:</strong> ${displayValue}</div>`;
}
