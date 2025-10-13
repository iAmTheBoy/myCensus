// 🚨 REPLACE THIS WITH YOUR GOOGLE APPS SCRIPT WEB APP URL 🚨
const API_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzaoyCQC8O1ueXgUCQfAGaG2P_l6uxDt1AHiAXk2EK7DkXh9SEfwdYnH82juYUtCtRf/exec';

let EDIT_HOUSEHOLD_ID = null;

document.addEventListener('DOMContentLoaded', () => {
    // Attach listeners to the static Add buttons using their IDs
    document.getElementById('add-member-btn').addEventListener('click', addMember);
    document.getElementById('add-child-btn').addEventListener('click', addChild);

    // Form submission handler
    document.getElementById('census-form').addEventListener('submit', handleSubmit);

    // Cancel/Go Back button (new for edit page)
    document.getElementById('cancel-button').addEventListener('click', () => {
        window.location.href = 'admin.html';
    });
    
    // Use event delegation for the dynamically added elements
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('remove-btn')) {
            removeSection(e.target);
        }
    });

    document.addEventListener('change', function(e) {
        // Handle Sacraments/Dikabelo fields toggle
        if (e.target.tagName === 'SELECT' && e.target.hasAttribute('onchange')) {
            const classNameMatch = e.target.getAttribute('onchange').match(/toggleFields\(this, '(.*?)'\)/);
            if (classNameMatch) {
                toggleFields(e.target, classNameMatch[1]);
            }
        }
        // Handle Age calculation for children's Date of Birth
        if (e.target.dataset.name === 'Date_of_Birth') {
            const ageField = e.target.closest('[data-type]').querySelector('[data-name="Age"]');
            calculateAge(e.target.value, ageField);
        }
    });

    // Initial load checks
    initializeForm();
});

// === NEW: Form Initialization for Edit/Submit Mode ===
async function initializeForm() {
    // Check if we are in Edit mode (admin.html redirects to edit_record.html?householdId=HHD-X)
    const urlParams = new URLSearchParams(window.location.search);
    const householdId = urlParams.get('householdId');
    
    if (householdId) {
        EDIT_HOUSEHOLD_ID = householdId;
        document.getElementById('census-form').dataset.mode = 'update';
        document.getElementById('form-title').textContent = 'Admin: Edit Existing Household Record';
        document.getElementById('submit-button').textContent = 'Update Census Data';
        document.getElementById('household-id-display').style.display = 'block';
        document.getElementById('current-household-id').textContent = householdId;
        document.getElementById('cancel-button').style.display = 'inline-block';

        // Fetch and pre-fill data
        await fetchRecordForEdit(householdId);

    } else {
        // Default mode: New submission
        document.getElementById('census-form').dataset.mode = 'submit';
        addMember(); // Only add the initial member for new submissions
    }
}

async function fetchRecordForEdit(householdId) {
    const statusMessage = document.getElementById('status-message');
    statusMessage.className = 'alert';
    statusMessage.innerHTML = 'Loading record data...';
    statusMessage.style.display = 'block';

    try {
        const url = `${API_ENDPOINT}?action=getSingleRecord&householdId=${householdId}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        if (data.result === 'success' && data.data) {
            prefillForm(data.data);
            statusMessage.style.display = 'none';
        } else {
            throw new Error(data.message || 'Record not found.');
        }

    } catch (error) {
        console.error('Fetch Error:', error);
        statusMessage.className = 'alert alert-error';
        statusMessage.innerHTML = `❌ Error loading record ${householdId}: ${error.message}.`;
    }
}

function prefillForm(record) {
    const form = document.getElementById('census-form');
    
    // 1. Household Data
    for (const key in record.Household) {
        const input = form.querySelector(`.form-group [data-name="${key}"]`);
        if (input) {
            input.value = record.Household[key];
        }
    }

    // Clear initial dynamic sections before filling
    document.getElementById('members-container').innerHTML = '';
    document.getElementById('children-container').innerHTML = '';

    // 2. Members Data
    record.Members.forEach(member => {
        const memberSection = addMember(false); // Add section, but don't call calculateAge yet
        for (const key in member) {
            const input = memberSection.querySelector(`[data-name="${key}"]`);
            if (input) {
                if (input.tagName === 'SELECT') {
                    input.value = member[key] || input.options[0].value;
                    // Manually trigger the toggleFields logic for select elements
                    const event = new Event('change');
                    input.dispatchEvent(event); 
                } else {
                    input.value = member[key];
                }
            }
        }
    });
    
    // 3. Children Data
    record.Children.forEach(child => {
        const childSection = addChild(false); // Add section, but don't call calculateAge yet
        for (const key in child) {
            const input = childSection.querySelector(`[data-name="${key}"]`);
            if (input) {
                if (input.tagName === 'SELECT') {
                    input.value = child[key] || input.options[0].value;
                    const event = new Event('change');
                    input.dispatchEvent(event); 
                } else {
                    input.value = child[key];
                }
            }
        }
    });

    // Run age calculation after all fields are set (important for readonly age fields)
    form.querySelectorAll('[data-name="Date_of_Birth"]').forEach(input => {
        const ageField = input.closest('[data-type]').querySelector('[data-name="Age"]');
        calculateAge(input.value, ageField);
    });
}

// === Submission Handler ===

async function handleSubmit(event) {
    event.preventDefault();

    const form = document.getElementById('census-form');
    const statusMessage = document.getElementById('status-message');
    const submitButton = document.getElementById('submit-button');

    // 1. Disable button and show loading
    submitButton.disabled = true;
    submitButton.textContent = 'Processing...';
    statusMessage.style.display = 'none';

    // 2. Data Collection (Logic remains the same)
    const householdData = collectSectionData(form.querySelector('.form-group'));
    const membersArray = Array.from(document.querySelectorAll('#members-container > .member-section'))
                            .map(collectSectionData);
    const childrenArray = Array.from(document.querySelectorAll('#children-container > .child-section'))
                            .map(collectSectionData);

    if (membersArray.length === 0) {
        statusMessage.className = 'alert alert-error';
        statusMessage.innerHTML = '❌ Please add at least one adult member.';
        submitButton.disabled = false;
        submitButton.textContent = 'Submit Census Data';
        return;
    }

    // 3. Create Final Payload
    const finalPayload = {
        household: householdData,
        members: membersArray, 
        children: childrenArray
    };

    // Add Household_ID to payload if in update mode
    if (form.dataset.mode === 'update') {
        finalPayload.household.Household_ID = EDIT_HOUSEHOLD_ID;
    }

    // 4. Send to Google Apps Script Web App
    const mode = form.dataset.mode;
    let url = API_ENDPOINT;
    let method = 'POST';
    
    if (mode === 'update') {
        url = `${API_ENDPOINT}?action=updateRecord`;
        method = 'PUT'; // Use PUT method for update, handled by doPost/doPut in Apps Script
    }

    try {
        const response = await fetch(url, {
            method: method, 
            mode: 'no-cors', 
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(finalPayload),
        });
        
        statusMessage.className = 'alert alert-success';
        
        if (mode === 'update') {
             statusMessage.innerHTML = `✅ Record ${EDIT_HOUSEHOLD_ID} updated successfully! Redirecting to dashboard...`;
             // Redirect admin back to dashboard after successful update
             setTimeout(() => {
                 window.location.href = 'admin.html';
             }, 2000);
        } else {
            statusMessage.innerHTML = '✅ Data submitted successfully! Thank you.';
            // Reset dynamic sections only for new submission
            document.getElementById('census-form').reset();
            document.getElementById('members-container').innerHTML = '';
            document.getElementById('children-container').innerHTML = '';
            addMember(); 
        }
        
    } catch (error) {
        console.error('Submission Error:', error);
        statusMessage.className = 'alert alert-error';
        statusMessage.innerHTML = `❌ Network Error: Could not submit data. Check your API URL and internet connection.`;
    } finally {
        statusMessage.style.display = 'block';
        submitButton.disabled = false;
        submitButton.textContent = mode === 'update' ? 'Update Census Data' : 'Submit Census Data';
    }
}

// === Utility Functions (No Change to Logic) ===

function collectSectionData(container) {
    const data = {};
    const inputs = container.querySelectorAll('[data-name]');
    inputs.forEach(input => {
        data[input.dataset.name] = input.value;
    });
    return data;
}

function calculateAge(dobString, ageField) {
    if (!dobString) {
        ageField.value = '';
        return;
    }
    const dob = new Date(dobString);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDifference = today.getMonth() - dob.getMonth();
    
    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    ageField.value = age;
}

function toggleFields(selectElement, className) {
    const isYes = selectElement.value === 'Yes';
    const subFields = selectElement.parentNode.querySelector(`.sub-fields.${className}-fields`);
    if (subFields) {
        subFields.style.display = isYes ? 'block' : 'none';
        
        // Clear inputs if fields are hidden
        if (!isYes) {
            subFields.querySelectorAll('input').forEach(input => input.value = '');
        }
    }
}

function addMember(callCalculateAge = true) {
    const container = document.getElementById('members-container');
    const template = document.getElementById('member-template');
    const clone = template.content.cloneNode(true).querySelector('.member-section');
    container.appendChild(clone);
    
    // Recalculate age for date fields if prefilling data (only if explicitly requested)
    if (callCalculateAge) {
        const dobInput = clone.querySelector('[data-name="Date_of_Birth"]');
        const ageField = clone.querySelector('[data-name="Age"]');
        if (dobInput.value) {
            calculateAge(dobInput.value, ageField);
        }
    }
    return clone;
}

function addChild(callCalculateAge = true) {
    const container = document.getElementById('children-container');
    const template = document.getElementById('child-template');
    const clone = template.content.cloneNode(true).querySelector('.child-section');
    container.appendChild(clone);
    
    // Recalculate age for date fields if prefilling data
    if (callCalculateAge) {
        const dobInput = clone.querySelector('[data-name="Date_of_Birth"]');
        const ageField = clone.querySelector('[data-name="Age"]');
        if (dobInput.value) {
            calculateAge(dobInput.value, ageField);
        }
    }
    return clone;
}

function removeSection(button) {
    button.closest('[data-type]').remove();
}
