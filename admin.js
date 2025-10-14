// 🚨 REPLACE THIS WITH YOUR GOOGLE APPS SCRIPT WEB APP URL 🚨
// This URL must match the one used in the form (script.js)
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbyVsLsF1YF8ahZ0pj2d8WJ24pSRfLgnRzZSrUzEoU9OufFKiMRmKthaXZVwI1aX6meC/exec';

let ALL_RECORDS = []; 
let DISPLAYED_RECORDS = []; 
let ACTIVE_ROW = null; 

document.addEventListener('DOMContentLoaded', async () => {
    // Only fetching records and setting up listeners now, as summary data structure isn't fully defined yet.
    // await fetchSummary();
    await fetchRecords();
    setupEventListeners();
});

/**
 * Sets up all event listeners for the dashboard.
 * Includes listeners for search/filter inputs and table row clicks.
 */
function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    const columnFilter = document.getElementById('column-filter');
    const filterInput = document.getElementById('filter-input');
    const applyFilterBtn = document.querySelector('#filter-controls button[onclick="applySearchFilter()"]');
    const resetFilterBtn = document.querySelector('#filter-controls button[onclick="resetFilters()"]');

    // Logic for enabling/disabling the filter input and updating placeholder
    columnFilter.addEventListener('change', () => {
        filterInput.disabled = columnFilter.value === "";
        filterInput.placeholder = columnFilter.value === "" ? 
            "Value to search in selected column" : 
            `Search value for ${columnFilter.options[columnFilter.selectedIndex].text}`;
    });
    
    // Global search and column filter input changes should trigger the filter logic
    searchInput.addEventListener('input', applySearchFilter);
    filterInput.addEventListener('input', applySearchFilter);

    // Attach explicit listeners to the buttons (if they don't have inline handlers)
    if (applyFilterBtn) applyFilterBtn.addEventListener('click', applySearchFilter);
    if (resetFilterBtn) resetFilterBtn.addEventListener('click', resetFilters);

    // Event Delegation on the Table Body to handle row clicks
    document.getElementById('records-tbody').addEventListener('click', handleRecordClick);

    // Populate the dropdown with column names from the table headers
    populateFilterColumns();
}

/**
 * Populates the column filter dropdown based on table headers with data-column attributes.
 */
function populateFilterColumns() {
    const columnFilter = document.getElementById('column-filter');
    // Select headers that have a data-column attribute (used as the object key)
    const tableHeaders = document.querySelectorAll('#records-table thead th[data-column]');

    // Clear existing options and add the default
    columnFilter.innerHTML = '<option value="">(Select Column)</option>';

    tableHeaders.forEach(header => {
        const columnKey = header.dataset.column;
        const columnName = header.textContent; // Use text content as display name

        if (columnKey) {
            const option = document.createElement('option');
            option.value = columnKey;
            option.textContent = columnName;
            columnFilter.appendChild(option);
        }
    });
}

/**
 * Searches and filters ALL_RECORDS based on user input from global search and column filter.
 */
function applySearchFilter() {
    const searchInput = document.getElementById('search-input');
    const columnFilter = document.getElementById('column-filter');
    const filterInput = document.getElementById('filter-input');

    const globalSearchTerm = searchInput.value.toLowerCase().trim();
    const columnKey = columnFilter.value; // e.g., 'Household_ID', 'Block_Name'
    const columnValue = filterInput.value.toLowerCase().trim();

    // Start with all records
    let filteredRecords = ALL_RECORDS;

    // 1. Apply Column Filter (if selected and value is provided)
    if (columnKey && columnValue) {
        filteredRecords = filteredRecords.filter(record => {
            const household = record.Household;
            // Get the value for the selected column key
            const recordValue = household[columnKey] ? String(household[columnKey]).toLowerCase() : '';

            // Check if the record value contains the column filter value
            return recordValue.includes(columnValue);
        });
    }

    // 2. Apply Global Search (on the results of column filtering)
    if (globalSearchTerm) {
        filteredRecords = filteredRecords.filter(record => {
            const household = record.Household;
            // Search across key visible fields: ID, Block, Address, Contact
            try {
                const searchableText = [
                    household.Household_ID,
                    household.Block_Name,
                    household.Residential_Address,
                    household.Contact_No
                ].map(val => String(val || '').toLowerCase()).join(' ');

                return searchableText.includes(globalSearchTerm);
            } catch (e) {
                // If a record structure is invalid, exclude it from search results
                console.error("Error processing record for global search:", record, e);
                return false;
            }
        });
    }

    // Update the table display with the filtered results
    displayRecordsToTable(filteredRecords);
}

/**
 * Clears all search and filter inputs and refreshes the table to show all records.
 */
function resetFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('column-filter').value = '';
    const filterInput = document.getElementById('filter-input');
    filterInput.value = '';
    filterInput.disabled = true;
    filterInput.placeholder = 'Value to search in selected column';

    // Re-apply filter logic (which will now display all records)
    applySearchFilter();
}


/**
 * Fetches summary data from the server (currently disabled as it's not fully used).
 */
/*
async function fetchSummary() {
    try {
        const response = await fetch(`${API_BASE_URL}?action=getSummary`);
        if (!response.ok) throw new Error('Network response was not ok');
        const summary = await response.json();
        // Placeholder for displaying summary
        // document.getElementById('total-households').textContent = summary.TotalHouseholds;
    } catch (error) {
        console.error('Error fetching summary:', error);
    }
}
*/

/**
 * Fetches all household records from the server and stores them in ALL_RECORDS.
 */
async function fetchRecords() {
    try {
        const response = await fetch(`${API_BASE_URL}?mode=all`);
        if (!response.ok) throw new Error('Network response was not ok');
        const records = await response.json();
        
        if (records.status !== 'error') { // Assuming success returns data directly or a status: success object
            // If the structure is an array of records (typical success for getAllStructuredRecords)
            ALL_RECORDS = records; 
            displayRecordsToTable(ALL_RECORDS); // Initially display all records
        } else {
            console.error('Error in API response:', records.message);
            const tbody = document.getElementById('records-tbody');
            tbody.innerHTML = `<tr><td colspan="6" class="text-center">Error loading records: ${records.message}</td></tr>`;
        }

    } catch (error) {
        console.error('Error fetching records:', error);
        const tbody = document.getElementById('records-tbody');
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Network error or failed to load data. Check console for details.</td></tr>';
    }
}

/**
 * Handles clicks on the table body using delegation to select a record.
 */
function handleRecordClick(event) {
    const clickedRow = event.target.closest('tr');

    if (clickedRow && clickedRow.dataset.householdId) {
        // Remove 'active-row' from the previously active row
        if (ACTIVE_ROW) {
            ACTIVE_ROW.classList.remove('active-row');
        }

        // Set the new active row
        ACTIVE_ROW = clickedRow;
        ACTIVE_ROW.classList.add('active-row');

        const householdId = clickedRow.dataset.householdId;
        // Find the record in the main ALL_RECORDS array for full details
        const record = ALL_RECORDS.find(r => r.Household.Household_ID === householdId);
        
        if (record) {
            showRecordDetails(record);
        } else {
            console.error('Record not found for ID:', householdId);
            // Optionally fetch single record if it's possible it wasn't in the main batch
            // fetchSingleRecord(householdId).then(showRecordDetails); 
        }
    }
}

/**
 * Function to populate the main data table and update the DISPLAYED_RECORDS global.
 * @param {Array} records - The array of record objects to display.
 */
function displayRecordsToTable(records) {
    DISPLAYED_RECORDS = records; // Update the globally displayed records
    const tbody = document.getElementById('records-tbody');
    tbody.innerHTML = '';
    const detailPanel = document.getElementById('detail-panel');
    const printBtn = document.querySelector('#detail-panel .print-btn');

    // Hide detail panel and clear active row when the table content changes due to filtering
    detailPanel.style.display = 'none';
    printBtn.style.display = 'none';
    ACTIVE_ROW = null; 

    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No records found matching the current filters.</td></tr>';
        return;
    }

    records.forEach(record => {
        const household = record.Household;
        const row = tbody.insertRow();
        row.dataset.householdId = household.Household_ID;

        row.innerHTML = `
            <td>${household.Household_ID}</td>
            <td>${household.Block_Name || 'N/A'}</td>
            <td>${household.Residential_Address || 'N/A'}</td>
            <td>${household.Contact_No || 'N/A'}</td>
            <td>${record.Members.length}</td>
            <td>${record.Children.length}</td>
        `;
    });
}

/**
 * Displays the full details of a selected record in the detail panel.
 */
function showRecordDetails(record) {
    const detailContent = document.getElementById('detail-content');
    const detailPanel = document.getElementById('detail-panel');
    const printBtn = document.querySelector('#detail-panel .print-btn');
    let html = '';

    // 1. Household Section
    html += '<h2>Household Record: ' + record.Household.Household_ID + '</h2>';
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
    
    // Display the content
    detailContent.innerHTML = html;
    detailPanel.style.display = 'block';
    printBtn.style.display = 'block';
}

/**
 * Helper function to format a key-value pair for display.
 */
function formatPair(key, value) {
    // Simple key formatting (e.g., 'First_Name' -> 'First Name')
    const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return `<p><strong>${formattedKey}:</strong> ${value || 'N/A'}</p>`;
}
