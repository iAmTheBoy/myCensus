// 🚨 REPLACE THIS WITH YOUR GOOGLE APPS SCRIPT WEB APP URL 🚨
// This URL must point to the *deployed* Apps Script Web App (Execute as: Me, Who has access: Anyone, even anonymous)
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbxYwqmB09yEatsCYjtiHLbCIcqlfaQs4_v0r_zgeUUyxu0qAHT3J-8dX57hHvYt9qlr/exec'; 

let ALL_RECORDS = []; 
let DISPLAYED_RECORDS = []; 
let ACTIVE_ROW = null; 
let SELECTED_HOUSEHOLD_ID = null; // Store the ID of the currently selected record

document.addEventListener('DOMContentLoaded', async () => {
    // Initial call to hide the detail panel and action buttons on load
    document.getElementById('detail-panel').style.display = 'none';
    document.getElementById('action-buttons').style.display = 'none'; // Ensure buttons are hidden initially

    await fetchSummary();
    await fetchRecords();
    setupEventListeners();
});

// Utility function to display success/error/info messages
function displayStatusMessage(message, type = 'success') {
    const statusMessage = document.getElementById('status-message');
    statusMessage.textContent = message;
    statusMessage.className = `alert alert-${type}`;
    statusMessage.style.display = 'block';
    setTimeout(() => {
        statusMessage.style.display = 'none';
    }, 5000); // Hide after 5 seconds
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

    populateFilterColumns();
}

/**
 * Handles clicks on the table body using delegation.
 */
function handleRecordClick(event) {
    const clickedRow = event.target.closest('tr');

    if (clickedRow && clickedRow.dataset.id) {
        // 1. Highlight the selected row
        if (ACTIVE_ROW) {
            ACTIVE_ROW.classList.remove('active');
        }
        clickedRow.classList.add('active');
        ACTIVE_ROW = clickedRow;
        
        // 2. Find the record data and display details
        SELECTED_HOUSEHOLD_ID = clickedRow.dataset.id;
        const record = ALL_RECORDS.find(r => r.Household.Household_ID === SELECTED_HOUSEHOLD_ID);

        if (record) {
            displayRecordDetails(record);
            
            // 3. Show the detail panel and action buttons
            document.getElementById('detail-panel').style.display = 'flex';
            document.getElementById('action-buttons').style.display = 'flex';
            
            // 4. Hide delete confirmation if it was visible and re-enable buttons
            cancelDelete(); 
        }
    }
}

// --- Action Button Functions ---

/**
 * Placeholder function for editing. This is a large feature that requires a separate form.
 */
function editRecord() {
    displayStatusMessage(
        `Editing functionality for Household ID: ${SELECTED_HOUSEHOLD_ID} is not yet implemented. 
        To proceed, you would need to build a form interface similar to your submission form, but pre-filled with this data, and create a new Apps Script function (e.g., doPut) to handle data updates instead of just appending new rows.`, 
        'info'
    );
}

/**
 * Shows the inline confirmation prompt for deletion.
 */
function prepareDelete() {
    if (!SELECTED_HOUSEHOLD_ID) return;
    document.getElementById('delete-id-span').textContent = SELECTED_HOUSEHOLD_ID;
    document.getElementById('delete-confirmation').style.display = 'block'; // Use block for vertical layout
    // Disable other action buttons while confirmation is visible
    document.getElementById('print-btn').disabled = true;
    document.getElementById('edit-btn').disabled = true;
    document.getElementById('delete-btn').disabled = true;
}

/**
 * Hides the inline confirmation prompt for deletion and re-enables main buttons.
 */
function cancelDelete() {
    document.getElementById('delete-confirmation').style.display = 'none';
    document.getElementById('print-btn').disabled = false;
    document.getElementById('edit-btn').disabled = false;
    document.getElementById('delete-btn').disabled = false;
}

/**
 * Executes the record deletion via the Apps Script API.
 */
async function deleteRecord() {
    if (!SELECTED_HOUSEHOLD_ID) {
        displayStatusMessage('No record selected for deletion.', 'error');
        return;
    }

    cancelDelete(); // Hide confirmation buttons
    const householdIdToDelete = SELECTED_HOUSEHOLD_ID;
    displayStatusMessage(`Deleting record ${householdIdToDelete}...`, 'info');

    try {
        // Use exponential backoff for robustness
        let response;
        const maxRetries = 3;
        for (let i = 0; i < maxRetries; i++) {
            response = await fetch(`${API_BASE_URL}?action=delete&householdId=${householdIdToDelete}`, {
                method: 'GET', // Apps Script uses doGet for URL params
                mode: 'cors'
            });
            if (response.ok) break;
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000)); // 1s, 2s, 4s delay
            }
        }

        if (!response.ok) throw new Error('API request failed with status: ' + response.status);

        const result = await response.json();
        
        if (result && result.result === 'success') {
            displayStatusMessage(`✅ Record ${householdIdToDelete} and associated members/children deleted successfully.`);
            
            // 1. Clear details panel and reset state
            document.getElementById('detail-content').innerHTML = '<h2>Select a Record to View Details</h2><p>Click on any row in the table to display the full household, member, and child data here. This view is printable.</p>';
            document.getElementById('detail-panel').style.display = 'none';
            document.getElementById('action-buttons').style.display = 'none';
            SELECTED_HOUSEHOLD_ID = null;
            if (ACTIVE_ROW) {
                ACTIVE_ROW.classList.remove('active');
                ACTIVE_ROW = null;
            }

            // 2. Re-fetch and display data
            await fetchRecords(); 

        } else {
            displayStatusMessage(`❌ Deletion failed for ${householdIdToDelete}. Error: ${result ? result.error : 'Unknown API response.'}`, 'error');
        }

    } catch (error) {
        console.error('Deletion Error:', error);
        displayStatusMessage(`❌ Network or API Error: Could not delete record. Check the Apps Script implementation. Error: ${error.message}`, 'error');
    }
}


// --- API Call Functions ---

/**
 * Fetches all detailed census records from the Apps Script.
 */
async function fetchRecords() {
    try {
        displayStatusMessage('Fetching all records...', 'info');
        
        let response;
        const maxRetries = 3;
        for (let i = 0; i < maxRetries; i++) {
            response = await fetch(`${API_BASE_URL}?action=getRecords`, {
                method: 'GET',
                mode: 'cors'
            });
            if (response.ok) break;
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
            }
        }

        if (!response.ok) throw new Error('Failed to fetch records from Apps Script.');

        const data = await response.json();
        
        if (data && data.records) {
            ALL_RECORDS = data.records;
            DISPLAYED_RECORDS = ALL_RECORDS;
            renderTable(DISPLAYED_RECORDS);
            displayStatusMessage(`✅ Successfully loaded ${ALL_RECORDS.length} household records.`);
        } else {
             displayStatusMessage('⚠️ Apps Script returned an empty or malformed record list.', 'error');
        }

    } catch (error) {
        console.error('Fetch Records Error:', error);
        displayStatusMessage(`❌ Error fetching records: ${error.message}. Check your API URL.`, 'error');
    }
}

/**
 * Fetches summary statistics (not used in current UI but kept for future).
 */
async function fetchSummary() {
    // Placeholder for future summary data fetching
}


// --- UI Rendering Functions ---

/**
 * Populates the main table body with household records.
 */
function renderTable(records) {
    const tbody = document.getElementById('records-tbody');
    tbody.innerHTML = ''; // Clear existing rows

    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No records found matching the filter criteria.</td></tr>';
        return;
    }

    records.forEach(record => {
        const household = record.Household;
        const membersCount = record.Members ? record.Members.length : 0;
        const childrenCount = record.Children ? record.Children.length : 0;

        const row = tbody.insertRow();
        row.dataset.id = household.Household_ID; // Store ID for click handling

        row.insertCell().textContent = household.Household_ID;
        row.insertCell().textContent = household.Block_Name || '';
        row.insertCell().textContent = household.Residential_Address || '';
        row.insertCell().textContent = household.Contact_No || '';
        row.insertCell().textContent = membersCount;
        row.insertCell().textContent = childrenCount;
    });
}

/**
 * Displays the full details of a selected record in the detail panel.
 */
function displayRecordDetails(record) {
    const detailContent = document.getElementById('detail-content');
    let html = '';

    // Helper to format key-value pairs
    const formatPair = (key, value) => {
        if (value === null || value === undefined || value === '') return '';
        
        let formattedValue = value;
        
        // Robust date formatting for date objects or date strings
        if ((key.includes('Date') || key.includes('Timestamp') || key.includes('Birth')) && value) {
             let date;
             if (typeof value === 'string' || typeof value === 'number') {
                 // Try parsing from string or number (timestamp)
                 date = new Date(value);
             } else if (value instanceof Date) {
                 date = value;
             }
             
             if (date && !isNaN(date.getTime())) {
                 formattedValue = date.toLocaleDateString('en-US', { timeZone: 'UTC' });
                 if (key.includes('Timestamp')) {
                    // Include time for submission timestamp
                    formattedValue += ' ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
                 }
             } else {
                 formattedValue = value; // Fallback to original value
             }
        }
        
        return `<div class="detail-pair"><span class="detail-label">${key.replace(/_/g, ' ')}:</span><span class="detail-value">${formattedValue}</span></div>`;
    };

    // 1. Household Section
    html += '<h2>Household Record: ' + record.Household.Household_ID + '</h2>';
    html += '<h3>General Information</h3>';
    for (const key in record.Household) {
        if (key !== 'Household_ID' && key !== 'Timestamp') { 
            html += formatPair(key, record.Household[key]);
        } else if (key === 'Timestamp') {
             html += formatPair('Submission Date', record.Household[key]);
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
 * Populates the column filter dropdown based on table headers.
 */
function populateFilterColumns() {
    const columnFilter = document.getElementById('column-filter');
    const headers = document.querySelectorAll('#records-table th[data-column]');
    
    headers.forEach(th => {
        const option = document.createElement('option');
        option.value = th.dataset.column;
        option.textContent = th.textContent;
        columnFilter.appendChild(option);
    });
}

/**
 * Applies general search and column-specific filter to the displayed records.
 */
function applySearchFilter() {
    const searchInput = document.getElementById('search-input').value.toLowerCase().trim();
    const columnFilter = document.getElementById('column-filter').value;
    const filterInput = document.getElementById('filter-input').value.toLowerCase().trim();

    // Reset list to all records
    DISPLAYED_RECORDS = ALL_RECORDS.filter(record => {
        const household = record.Household;
        const allText = JSON.stringify(record).toLowerCase(); // Search all fields

        // 1. Global Search Filter
        const globalMatch = searchInput === '' || allText.includes(searchInput);

        // 2. Column-Specific Filter
        let columnMatch = true;
        if (columnFilter !== '' && filterInput !== '') {
            // Find the value in the Household object (since filter columns are from Household sheet)
            const columnValue = (household[columnFilter] || '').toString().toLowerCase();
            columnMatch = columnValue.includes(filterInput);
        }

        return globalMatch && columnMatch;
    });

    renderTable(DISPLAYED_RECORDS);
}

/**
 * Resets all filters and displays all records.
 */
function resetFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('column-filter').value = '';
    const filterInput = document.getElementById('filter-input');
    filterInput.value = '';
    filterInput.disabled = true;
    filterInput.placeholder = "Value to search in selected column";
    
    applySearchFilter(); // Re-render with no filters
}
