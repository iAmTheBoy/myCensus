// 🚨 REPLACE THIS WITH YOUR GOOGLE APPS SCRIPT WEB APP URL 🚨
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycby7cY1176Uv4l80uLIn4NGj4bjTmWf-1Buai7shFqkzRctFEJlQ-8wEuR3Kk0uuNoLl/exec'; 

let ALL_RECORDS = []; 
let DISPLAYED_RECORDS = []; 
let ACTIVE_ROW = null; 

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('loading-status').style.display = 'block';
    try {
        await fetchSummary();
        await fetchRecords();
        setupEventListeners();
    } catch (error) {
        console.error("Initialization Error:", error);
        document.getElementById('loading-status').textContent = 'Error loading data. Check console.';
        document.getElementById('loading-status').style.color = '#dc3545';
    } finally {
        document.getElementById('loading-status').style.display = 'none';
    }
});

/**
 * NEW FEATURE: Extracts unique block names and populates the Block filter dropdown.
 */
function populateBlockFilter() {
    const blockFilter = document.getElementById('block-filter');
    const uniqueBlocks = new Set();
    
    // Collect all unique Block_Name values
    ALL_RECORDS.forEach(record => {
        if (record.Household && record.Household.Block_Name) {
            uniqueBlocks.add(record.Household.Block_Name);
        }
    });

    // Clear existing options (except the default "All Blocks")
    while (blockFilter.options.length > 1) {
        blockFilter.remove(1);
    }
    
    // Add unique blocks as new options
    Array.from(uniqueBlocks).sort().forEach(block => {
        const option = document.createElement('option');
        option.value = block;
        option.textContent = block;
        blockFilter.appendChild(option);
    });
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
    populateBlockFilter(); // <-- NEW CALL
}

/**
 * Handles clicks on the table body using delegation.
 */
function handleRecordClick(event) {
    const clickedRow = event.target.closest('tr');

    if (clickedRow && clickedRow.dataset.householdId) {
        // Remove active class from previous active row
        if (ACTIVE_ROW) {
            ACTIVE_ROW.classList.remove('active-row');
        }
        
        // Set new active row
        ACTIVE_ROW = clickedRow;
        ACTIVE_ROW.classList.add('active-row');
        
        const householdId = clickedRow.dataset.householdId;
        const record = DISPLAYED_RECORDS.find(r => r.Household.Household_ID === householdId);
        
        if (record) {
            showDetailPanel(record);
        }
    }
}

/**
 * Fetches and displays summary data (counts).
 */
async function fetchSummary() {
    const url = `${API_BASE_URL}?action=getSummary`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
        throw new Error(data.error);
    }

    document.getElementById('total-households').textContent = data.totalHouseholds || 0;
    document.getElementById('total-members').textContent = data.totalMembers || 0;
    document.getElementById('total-children').textContent = data.totalChildren || 0;
}

/**
 * Fetches all structured records.
 */
async function fetchRecords() {
    const url = `${API_BASE_URL}?action=getRecords`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
        throw new Error(data.error);
    }
    
    ALL_RECORDS = data;
    DISPLAYED_RECORDS = [...ALL_RECORDS]; // Initialize displayed records
    renderRecords(DISPLAYED_RECORDS);
}

/**
 * Renders the table rows based on the current DISPLAYED_RECORDS.
 */
function renderRecords(records) {
    const tbody = document.getElementById('records-tbody');
    tbody.innerHTML = '';
    
    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No records found matching the current filters.</td></tr>';
        return;
    }

    records.forEach(record => {
        const row = tbody.insertRow();
        row.dataset.householdId = record.Household.Household_ID;
        
        row.insertCell().textContent = record.Household.Household_ID;
        row.insertCell().textContent = record.Household.Block_Name || 'N/A';
        row.insertCell().textContent = record.Household.Residential_Address || 'N/A';
        row.insertCell().textContent = record.Household.Contact_No || 'N/A';
        row.insertCell().textContent = record.Members.length;
        row.insertCell().textContent = record.Children.length;
    });
}

/**
 * Overridden: Applies all current filters (Block filter, General search, Column filter).
 */
function applySearchFilter() {
    const generalSearchQuery = document.getElementById('search-input').value.toLowerCase();
    const columnKey = document.getElementById('column-filter').value;
    const columnSearchQuery = document.getElementById('filter-input').value.toLowerCase();
    const blockFilterValue = document.getElementById('block-filter').value; // <-- NEW: Get block filter value

    DISPLAYED_RECORDS = ALL_RECORDS.filter(record => {
        // 1. Block Filter (NEW LOGIC)
        if (blockFilterValue && record.Household.Block_Name !== blockFilterValue) {
            return false;
        }

        // 2. General Search (EXISTING LOGIC)
        if (generalSearchQuery) {
            const searchTargets = [
                record.Household.Block_Name,
                record.Household.Residential_Address,
                record.Household.Contact_No
            ].join(' ').toLowerCase();

            // Include searching through all member names
            const memberNames = record.Members.map(m => 
                `${m.First_Name || ''} ${m.Last_Name || ''}`
            ).join(' ').toLowerCase();

            if (!searchTargets.includes(generalSearchQuery) && !memberNames.includes(generalSearchQuery)) {
                return false;
            }
        }

        // 3. Column Filter (EXISTING LOGIC)
        if (columnKey && columnSearchQuery) {
            let foundMatch = false;

            // Check Household data
            if (record.Household[columnKey] && String(record.Household[columnKey]).toLowerCase().includes(columnSearchQuery)) {
                foundMatch = true;
            }

            // Check Member data
            if (!foundMatch) {
                for (const member of record.Members) {
                    if (member[columnKey] && String(member[columnKey]).toLowerCase().includes(columnSearchQuery)) {
                        foundMatch = true;
                        break;
                    }
                }
            }
            
            // Check Children data
            if (!foundMatch) {
                for (const child of record.Children) {
                    if (child[columnKey] && String(child[columnKey]).toLowerCase().includes(columnSearchQuery)) {
                        foundMatch = true;
                        break;
                    }
                }
            }

            if (!foundMatch) {
                return false;
            }
        }
        
        return true;
    });

    renderRecords(DISPLAYED_RECORDS);
    // Clear detail panel when filters change
    const detailPanel = document.getElementById('detail-panel');
    document.getElementById('detail-content').innerHTML = '<h2>Select a Record to View Details</h2><p>Click on any row in the table to display the full household, member, and child data here. This view is printable.</p>';
    detailPanel.style.display = 'none';
}


function resetFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('column-filter').value = '';
    document.getElementById('filter-input').value = '';
    document.getElementById('filter-input').disabled = true;
    document.getElementById('filter-input').placeholder = 'Value to search in selected column';
    document.getElementById('block-filter').value = ''; // Reset Block Filter
    applySearchFilter();
}


function populateFilterColumns() {
    const columnFilter = document.getElementById('column-filter');
    const columns = [
        'Block_Name', 'Residential_Address', 'Contact_No', 
        'First_Name', 'Last_Name', 'Date_of_birth', 'Catholic_YN', 
        'Marital_Status', 'Occupation', 'Unemployed_YN', 'Pensioner_YN', 
        'Church_Activities', 'Leadership_Role', 'Age'
    ];
    
    columns.forEach(col => {
        const option = document.createElement('option');
        option.value = col;
        option.textContent = col.replace(/_/g, ' ');
        columnFilter.appendChild(option);
    });
}

function formatKey(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatValue(value) {
    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }
    if (value instanceof Date && !isNaN(value)) {
        return value.toLocaleDateString();
    }
    return value || 'N/A';
}

function formatPair(key, value) {
    return `<div class="detail-pair"><span class="detail-key">${formatKey(key)}:</span><span class="detail-value">${formatValue(value)}</span></div>`;
}

function showDetailPanel(record) {
    const detailPanel = document.getElementById('detail-panel');
    const detailContent = document.getElementById('detail-content');
    
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
    
    detailContent.innerHTML = html;
    detailPanel.style.display = 'block';
    
    // Show print button
    document.querySelector('.print-btn').style.display = 'block';
}
