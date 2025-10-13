// 🚨 REPLACE THIS WITH YOUR GOOGLE APPS SCRIPT WEB APP URL 🚨
const API_ENDPOINT = 'https://script.google.com/macros/s/AKfycbw05JwN3QBtcv7QOy08v2xg_sZPLO3wu8jKQG-eEzSf0kxn5ZclTElWbf0ugll8pjsk/exec';

document.addEventListener('DOMContentLoaded', () => {
    // Attach listeners to the static Add buttons using their IDs
    document.getElementById('add-member-btn').addEventListener('click', addMember);
    document.getElementById('add-child-btn').addEventListener('click', addChild);

    // Use event delegation for the dynamically added elements (Remove buttons, Select fields, Date fields)
    document.addEventListener('click', function(e) {
        // Handle Remove buttons (using event delegation on a generic class)
        if (e.target.classList.contains('remove-btn')) {
            removeSection(e.target);
        }
    });

    document.addEventListener('change', function(e) {
        // Handle Sacraments/Dikabelo fields toggle
        if (e.target.tagName === 'SELECT' && e.target.hasAttribute('onchange')) {
            // Note: We read the function call directly from the attribute to avoid re-writing toggleFields logic
            const classNameMatch = e.target.getAttribute('onchange').match(/toggleFields\(this, '(.*?)'
\/);
            if (classNameMatch) {
                toggleFields(e.target, classNameMatch[1]);
            }
        }
        // Handle Age calculation for children's Date of Birth
        if (e.target.dataset.name === 'Date_of_Birth' && e.target.closest('.child-block')) {
            calculateAge(e.target);
        }
    });

    // Handle form submission
    document.getElementById('census-form').addEventListener('submit', handleSubmit);
    
    // --- NEW LOGIC FOR EDIT MODE ---
    const urlParams = new URLSearchParams(window.location.search);
    const householdId = urlParams.get('id');

    if (householdId) {
        // It's in EDIT MODE: Fetch data and pre-fill form
        setupEditMode(householdId);
    } else {
        // It's in NEW SUBMISSION MODE: Add the first member
        addMember();
    }
});

/**
 * Sets up the form for editing an existing record.
 * @param {string} householdId - The Household_ID to fetch and edit.
 */
async function setupEditMode(householdId) {
    const statusMessage = document.getElementById('status-message');
    const submitButton = document.getElementById('submit-btn');

    document.getElementById('display-household-id').textContent = householdId;
    document.getElementById('household-id-field').value = householdId;
    submitButton.textContent = 'Updating Record...';
    submitButton.disabled = true;
    statusMessage.style.display = 'block';
    statusMessage.className = 'alert';
    statusMessage.innerHTML = 'Loading record details...';

    try {
        const response = await fetch(`${API_ENDPOINT}?householdId=${householdId}`);
        const result = await response.json();
        
        if (result.status === 'SUCCESS' && result.record) {
            preFillForm(result.record);
            submitButton.textContent = 'UPDATE RECORD';
            submitButton.disabled = false;
            statusMessage.className = 'alert alert-success';
            statusMessage.innerHTML = `✅ Record ${householdId} loaded for editing.`;
            document.getElementById('form-header').textContent = `Edit Household Record: ${householdId}`;
        } else {
            throw new Error(result.message || 'Failed to fetch record details.');
        }
    } catch (error) {
        console.error('Fetch Record Error:', error);
        statusMessage.className = 'alert alert-error';
        statusMessage.innerHTML = `❌ Error loading record: ${error.message}. Check the Console for details.`;
    }
}

/**
 * Pre-fills the form with the fetched record data.
 * @param {object} record - The household record object.
 */
function preFillForm(record) {
    const householdContainer = document.getElementById('census-form');
    const memberContainer = document.getElementById('members-container');
    const childContainer = document.getElementById('children-container');

    // Clear initial dynamic sections
    memberContainer.innerHTML = '';
    childContainer.innerHTML = '';

    // 1. Household Data
    const householdFields = householdContainer.querySelectorAll('[data-name]');
    householdFields.forEach(field => {
        const name = field.dataset.name;
        if (record.Household[name] !== undefined) {
            // Convert timestamp back to YYYY-MM-DD if it's a date field
            let value = record.Household[name];
            if (field.type === 'date' && value instanceof Date) {
                value = value.toISOString().substring(0, 10);
            }
            field.value = value;
        }
    });

    // 2. Members Data
    record.Members.forEach((memberData) => {
        addMember(memberData);
    });

    // 3. Children Data
    record.Children.forEach((childData) => {
        addChild(childData);
    });
}

/**
 * Toggles the visibility of sub-fields based on select input value.
 * @param {HTMLSelectElement} selectElement - The select element that triggered the change.
 * @param {string} className - The base class name of the sub-fields container (e.g., 'baptism').
 */
function toggleFields(selectElement, className) {
    const parentFormGroup = selectElement.closest('.form-group') || selectElement.closest('.member-block');
    if (!parentFormGroup) return;

    const subFieldsContainer = parentFormGroup.querySelector(`.${className}-fields`);
    if (!subFieldsContainer) return;

    if (selectElement.value === 'Yes') {
        subFieldsContainer.style.display = 'block';
        // Make sure date fields are required if visible
        subFieldsContainer.querySelectorAll('input[type="date"]').forEach(input => input.required = true);
    } else {
        subFieldsContainer.style.display = 'none';
        // Clear and remove required status if hidden
        subFieldsContainer.querySelectorAll('input, select').forEach(input => {
            input.value = '';
            input.required = false;
        });
    }
}


/**
 * Calculates a child's age from their Date of Birth input.
 * @param {HTMLInputElement} dobInput - The Date of Birth input element.
 */
function calculateAge(dobInput) {
    const dob = new Date(dobInput.value);
    const today = new Date();
    const ageInput = dobInput.closest('.child-block').querySelector('[data-name="Age"]');

    if (isNaN(dob.getTime())) {
        ageInput.value = 'Invalid Date';
        return;
    }

    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    
    // Adjust age if current date is before birthday this year
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    
    ageInput.value = age >= 0 ? age : 'Invalid DOB';
}

/**
 * Adds a new member block to the form.
 * @param {Object} [data] - Optional initial data to pre-fill the member block.
 */
function addMember(data = null) {
    const template = document.getElementById('member-template');
    const memberContainer = document.getElementById('members-container');
    const clone = document.importNode(template.content, true);
    const newMemberBlock = clone.querySelector('.member-block');
    
    memberContainer.appendChild(newMemberBlock);
    updateTitles(memberContainer, 'Member');

    // Pre-fill and initialize
    if (data) {
        fillSection(newMemberBlock, data);
    }

    // Manually trigger the toggle for sacrament fields in the new block if 'Yes' is selected
    newMemberBlock.querySelectorAll('select[data-name$="_YN"]').forEach(select => {
        const classNameMatch = select.getAttribute('onchange').match(/toggleFields\\(this, '(.*?)'\\)/);
        if (classNameMatch && select.value === 'Yes') {
            toggleFields(select, classNameMatch[1]);
        }
    });
}

/**
 * Adds a new child block to the form.
 * @param {Object} [data] - Optional initial data to pre-fill the child block.
 */
function addChild(data = null) {
    const template = document.getElementById('child-template');
    const childContainer = document.getElementById('children-container');
    const clone = document.importNode(template.content, true);
    const newChildBlock = clone.querySelector('.child-block');

    childContainer.appendChild(newChildBlock);
    updateTitles(childContainer, 'Child');

    // Pre-fill and initialize
    if (data) {
        fillSection(newChildBlock, data);
        // Recalculate age after filling DOB
        const dobInput = newChildBlock.querySelector('[data-name="Date_of_Birth"]');
        if (dobInput.value) {
            calculateAge(dobInput);
        }
    }
}

/**
 * Fills a section (member or child) with provided data.
 * @param {HTMLElement} sectionElement - The member or child block element.
 * @param {Object} data - The data object to fill.
 */
function fillSection(sectionElement, data) {
    sectionElement.querySelectorAll('[data-name]').forEach(field => {
        const name = field.dataset.name;
        if (data[name] !== undefined) {
            let value = data[name];
            // Format dates (assuming Apps Script returns date objects or ISO strings)
            if (field.type === 'date' && value) {
                if (value instanceof Date) {
                    value = value.toISOString().substring(0, 10);
                } else if (typeof value === 'string' && value.match(/\\d{4}-\\d{2}-\\d{2}/)) {
                    // Check if it's already in YYYY-MM-DD format
                } else {
                    // Try to convert timestamp/other string to YYYY-MM-DD
                    const date = new Date(value);
                    if (!isNaN(date.getTime())) {
                        value = date.toISOString().substring(0, 10);
                    }
                }
            }
            field.value = value;
            // Handle select fields to ensure value is set correctly
            if (field.tagName === 'SELECT') {
                field.value = value;
            }
        }
    });
}


/**
 * Removes a member or child block.
 * @param {HTMLButtonElement} removeButton - The remove button that was clicked.
 */
function removeSection(removeButton) {
    const block = removeButton.closest('.member-block') || removeButton.closest('.child-block');
    if (!block) return;
    
    const container = block.parentNode;
    container.removeChild(block);
    updateTitles(container, block.classList.contains('member-block') ? 'Member' : 'Child');

    // If it was the last member, add an empty one back to ensure there is at least one
    if (container.id === 'members-container' && container.children.length === 0) {
        addMember();
    }
}

/**
 * Updates the sequential titles of dynamic sections.
 * @param {HTMLElement} container - The container (members-container or children-container).
 * @param {string} prefix - 'Member' or 'Child'.
 */
function updateTitles(container, prefix) {
    Array.from(container.children).forEach((block, index) => {
        const titleElement = block.querySelector(`.${prefix.toLowerCase()}-title`);
        if (titleElement) {
            titleElement.textContent = `${prefix} ${index + 1}`;
        }
    });
}

/**
 * Main form submission handler.
 */
async function handleSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitButton = document.getElementById('submit-btn');
    const statusMessage = document.getElementById('status-message');

    statusMessage.style.display = 'none';
    submitButton.disabled = true;
    submitButton.textContent = 'Processing...';

    // 1. Extract Household Data (including the hidden Household_ID)
    const householdData = {};
    Array.from(form.querySelectorAll('.form-group input, .form-group select, input[type="hidden"]')).forEach(input => {
        if (input.dataset.name) {
            householdData[input.dataset.name] = input.value;
        }
    });

    // 2. Extract Members and Children Data
    const membersArray = extractSectionData(document.getElementById('members-container'));
    const childrenArray = extractSectionData(document.getElementById('children-container'));

    // Basic Validation Check (ensure at least one member for a valid household)
    if (membersArray.length === 0) {
        statusMessage.className = 'alert alert-error';
        statusMessage.innerHTML = '❌ A household must contain at least one member.';
        statusMessage.style.display = 'block';
        submitButton.disabled = false;
        submitButton.textContent = householdData.Household_ID ? 'UPDATE RECORD' : 'Submit Census Data';
        return;
    }

    // 3. Create Final Payload (Determine command based on Household_ID)
    const householdId = householdData.Household_ID;
    const command = householdId ? 'UPDATE' : 'SUBMIT_NEW';

    const finalPayload = {
        command: command, // New: tells Apps Script whether to create or update
        household: householdData,
        members: membersArray, 
        children: childrenArray
    };

    // 4. Send to Google Apps Script Web App
    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            // mode: 'no-cors' is NOT used for responses that need to be read (like JSON status)
            // Assuming your Apps Script is deployed for access by 'Anyone' and CORS is handled by GAS.
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(finalPayload),
        });

        // The response will be the JSON we set in Apps Script
        const result = await response.json();
        
        if (result.status === 'SUCCESS') {
            statusMessage.className = 'alert alert-success';
            statusMessage.innerHTML = `✅ ${result.message} (ID: ${result.householdId})`;
            
            // Only clear the form on NEW submission
            if (command !== 'UPDATE') {
                form.reset();
                document.getElementById('members-container').innerHTML = '';
                document.getElementById('children-container').innerHTML = '';
                addMember(); // Add back the initial member
            }
        } else {
            throw new Error(result.message || 'Unknown error during submission.');
        }

    } catch (error) {
        console.error('Submission Error:', error);
        statusMessage.className = 'alert alert-error';
        statusMessage.innerHTML = `❌ Error: ${error.message}. Check the Console for details.`;
    } finally {
        statusMessage.style.display = 'block';
        submitButton.disabled = false;
        submitButton.textContent = householdId ? 'UPDATE RECORD' : 'Submit Census Data';
    }
}

/**
 * Helper function to extract data from a container of member/child blocks.
 * @param {HTMLElement} container - The members-container or children-container.
 * @returns {Array<Object>} Array of extracted data objects.
 */
function extractSectionData(container) {
    const dataArray = [];
    Array.from(container.children).forEach(block => {
        const blockData = {};
        Array.from(block.querySelectorAll('[data-name]')).forEach(input => {
            if (input.dataset.name) {
                blockData[input.dataset.name] = input.value;
            }
        });
        dataArray.push(blockData);
    });
    return dataArray;
}
