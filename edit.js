// 🚨 REPLACE THIS WITH YOUR GOOGLE APPS SCRIPT WEB APP URL 🚨
const API_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyGUp-al-UUrFIPf6Btk0Mb7Cv8x-7DPHn67JR8SAuEbYaM0jriPix62GeahktSs67b/exec';

let CURRENT_HOUSEHOLD_ID = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Get Household ID from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const householdId = urlParams.get('id');

    if (!householdId) {
        document.getElementById('status-message').className = 'alert alert-error';
        document.getElementById('status-message').innerHTML = '❌ Error: No Household ID provided for editing.';
        document.getElementById('status-message').style.display = 'block';
        return;
    }

    CURRENT_HOUSEHOLD_ID = householdId;
    document.getElementById('household-id-display').textContent = `Editing Record: ${householdId}`;

    // 2. Fetch the specific record's data
    await fetchRecordData(householdId);
    
    // 3. Setup event listeners
    document.getElementById('add-member-btn').addEventListener('click', () => addMember(null));
    document.getElementById('add-child-btn').addEventListener('click', () => addChild(null));
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('remove-btn')) {
            removeSection(e.target);
        }
    });
    document.addEventListener('change', function(e) {
        if (e.target.tagName === 'SELECT' && e.target.hasAttribute('onchange')) {
            const classNameMatch = e.target.getAttribute('onchange').match(/toggleFields\(this, '(.*?)'\)/);
            if (classNameMatch) {
                toggleFields(e.target, classNameMatch[1]);
            }
        }
        if (e.target.getAttribute('data-name') === 'Date_of_Birth' && e.target.closest('.child-section')) {
            calculateAge(e.target);
        }
    });

    document.getElementById('census-form').addEventListener('submit', handleFormUpdate);
});


// === DATA FETCHING & POPULATION ===

async function fetchRecordData(householdId) {
    const statusMessage = document.getElementById('status-message');
    statusMessage.className = 'alert';
    statusMessage.innerHTML = `Loading data for ${householdId}...`;
    statusMessage.style.display = 'block';

    try {
        // Fetch a single record using the existing Apps Script API (getRecords) 
        // We'll filter on the client side for simplicity, as getRecords already returns structured data.
        const url = `${API_ENDPOINT}?action=getRecords`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();

        if (data.result === 'success') {
            const record = data.data.find(r => r.Household.Household_ID === householdId);
            if (record) {
                populateForm(record);
                statusMessage.style.display = 'none';
            } else {
                throw new Error(`Record with ID ${householdId} not found.`);
            }
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        statusMessage.className = 'alert alert-error';
        statusMessage.innerHTML = `❌ Failed to load record: ${error.message}`;
    }
}

function populateForm(record) {
    // 1. Populate Household Data
    document.getElementById('block-name').value = record.Household.Block_Name || '';
    document.getElementById('address').value = record.Household.Residential_Address || '';
    document.getElementById('contact-no').value = record.Household.Contact_No || '';

    // 2. Populate Members Data
    document.getElementById('members-container').innerHTML = ''; // Clear initial default member
    record.Members.forEach(member => addMember(member));

    // 3. Populate Children Data
    document.getElementById('children-container').innerHTML = '';
    record.Children.forEach(child => addChild(child));
}

// === UTILITY FUNCTIONS (Modified to handle pre-fill) ===

/** Toggles visibility of conditional fields (e.g., date of baptism). */
function toggleFields(selectElement, className) {
    const parent = selectElement.closest('.section-box');
    const fields = parent.querySelector(`.${className}-fields`);
    if (selectElement.value === 'Yes') {
        fields.style.display = 'block';
    } else {
        fields.style.display = 'none';
    }
}

/** Calculates age based on Date of Birth for children. */
function calculateAge(dobInput) {
    const dob = new Date(dobInput.value);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    const parent = dobInput.closest('.child-section');
    parent.querySelector('[data-name="Age"]').value = age >= 0 ? age : '';
}

/** Clones and populates the member template. */
function addMember(memberData) {
    const membersContainer = document.getElementById('members-container');
    const memberCount = membersContainer.querySelectorAll('.member-section').length + 1;
    
    const template = document.getElementById('member-template');
    const newSection = template.content.cloneNode(true).querySelector('.member-section');
    newSection.querySelector('.member-number').textContent = memberCount;

    if (memberData) {
        // Populate fields with existing data
        for (const key in memberData) {
            const input = newSection.querySelector(`[data-name="${key}"]`);
            if (input) {
                 // Check if it's a date and format correctly (YYYY-MM-DD)
                if (input.type === 'date' && memberData[key]) {
                    const dateObj = new Date(memberData[key]);
                    if (!isNaN(dateObj)) {
                        input.value = dateObj.toISOString().split('T')[0];
                    }
                } else {
                    input.value = memberData[key] || '';
                }
            }
        }
    }

    // Re-initialize conditional fields based on their current (or populated) select value
    newSection.querySelectorAll('select[onchange]').forEach(select => {
        const classNameMatch = select.getAttribute('onchange').match(/toggleFields\(this, '(.*?)'\)/);
        if (classNameMatch) {
            toggleFields(select, classNameMatch[1]);
        }
    });

    membersContainer.appendChild(newSection);
}

/** Clones and populates the child template. */
function addChild(childData) {
    const childrenContainer = document.getElementById('children-container');
    const childCount = childrenContainer.querySelectorAll('.child-section').length + 1;

    const template = document.getElementById('child-template');
    const newSection = template.content.cloneNode(true).querySelector('.child-section');
    newSection.querySelector('.child-number').textContent = childCount;
    
    if (childData) {
        // Populate fields with existing data
        for (const key in childData) {
            const input = newSection.querySelector(`[data-name="${key}"]`);
            if (input) {
                if (input.type === 'date' && childData[key]) {
                    const dateObj = new Date(childData[key]);
                    if (!isNaN(dateObj)) {
                        input.value = dateObj.toISOString().split('T')[0];
                    }
                } else {
                    input.value = childData[key] || '';
                }
            }
        }
        // Ensure age is calculated/displayed correctly after setting DOB
        const dobInput = newSection.querySelector('[data-name="Date_of_Birth"]');
        if (dobInput.value) {
             calculateAge(dobInput);
        }
    }


    // Re-initialize conditional fields based on their current (or populated) select value
    newSection.querySelectorAll('select[onchange]').forEach(select => {
        const classNameMatch = select.getAttribute('onchange').match(/toggleFields\(this, '(.*?)'\)/);
        if (classNameMatch) {
            toggleFields(select, classNameMatch[1]);
        }
    });
    
    childrenContainer.appendChild(newSection);
}

/** Removes a dynamic section. */
function removeSection(button) {
    if (!confirm('Are you sure you want to remove this entry? It will be removed from the database upon update.')) return;
    const section = button.closest('.section-box');
    section.remove();
}


// === DATA COLLECTION AND SUBMISSION (Update) ===

function getSectionData(selector) {
    const dataArray = [];
    document.querySelectorAll(selector).forEach(section => {
        const sectionData = {};
        section.querySelectorAll('[data-name]').forEach(input => {
            const key = input.getAttribute('data-name');
            sectionData[key] = input.value || ''; 
        });
        dataArray.push(sectionData);
    });
    return dataArray;
}

async function handleFormUpdate(event) {
    event.preventDefault();
    const updateButton = document.getElementById('update-btn');
    const statusMessage = document.getElementById('status-message');
    
    updateButton.disabled = true;
    updateButton.textContent = 'Updating...';
    statusMessage.style.display = 'none';

    // 1. Collect Household Data
    const householdData = {
        Household_ID: CURRENT_HOUSEHOLD_ID, // Include ID for update
        Block_Name: document.getElementById('block-name').value,
        Residential_Address: document.getElementById('address').value,
        Contact_No: document.getElementById('contact-no').value,
    };

    // 2. Collect Members and Children Data
    const membersArray = getSectionData('.member-section');
    const childrenArray = getSectionData('.child-section');
    
    if (membersArray.length === 0) {
        alert('Please ensure there is at least one adult member.');
        updateButton.disabled = false;
        updateButton.textContent = 'Update Record';
        return;
    }

    // 3. Create Final Payload
    const finalPayload = {
        household: householdData,
        members: membersArray, 
        children: childrenArray
    };

    // 4. Send to Google Apps Script Web App using PUT method
    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'PUT',
            // Note: Unlike POST, PUT/GET/DELETE from external sites often require 
            // the Apps Script to be deployed correctly for CORS and usually includes
            // the Content-Type header directly. Using 'no-cors' here might prevent 
            // reading the response status properly, but for simplicity, we keep it similar to the POST submission flow.
            // For a successful update flow, we MUST get the success response.
            headers: {
                'Content-Type': 'text/plain;charset=utf-8', // Required for raw PUT body
            },
            body: JSON.stringify(finalPayload),
        });
        
        // As a PUT/POST from an external static site often gets an opaque response, 
        // we check for a non-error status and assume success if the script returns 
        // a standard OK response. For robustness, we check the JSON response if available.
        
        if (response.status === 200 || response.status === 302) { 
             // Attempt to read the JSON response
             const result = await response.json();
             if (result.result === 'success') {
                statusMessage.className = 'alert alert-success';
                statusMessage.innerHTML = `✅ Record **${CURRENT_HOUSEHOLD_ID}** updated successfully! Redirecting...`;
                
                // Automatically redirect back to the admin dashboard after a delay
                setTimeout(() => {
                    window.location.href = 'admin.html';
                }, 2000);
             } else {
                 throw new Error(result.message || 'API reported an error on update.');
             }
        } else {
             throw new Error(`Server returned status code ${response.status}.`);
        }
        
    } catch (error) {
        console.error('Update Error:', error);
        statusMessage.className = 'alert alert-error';
        statusMessage.innerHTML = `❌ Error: Could not update data. ${error.message}`;
        statusMessage.style.display = 'block';
    } finally {
        updateButton.disabled = false;
        updateButton.textContent = 'Update Record';
    }
}
