// 🚨 REPLACE THIS WITH YOUR GOOGLE APPS SCRIPT WEB APP URL 🚨
const API_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyVsLsF1YF8ahZ0pj2d8WJ24pSRfLgnRzZSrUzEoU9OufFKiMRmKthaXZVwI1aX6meC/exec';

let isEditMode = false;

document.addEventListener('DOMContentLoaded', () => {
    // Attach listeners to the static Add buttons using their IDs
    document.getElementById('add-member-btn').addEventListener('click', addMember);
    document.getElementById('add-child-btn').addEventListener('click', addChild);

    // Use event delegation for the dynamically added elements (Remove buttons, Select fields, Date fields)
    document.addEventListener('click', function(e) {
        // Handle Remove buttons (using event delegation on a generic class)
        if (e.target.classList.contains('remove-btn')) {
            removeSection(e.target);
            updateIndices(); // Re-index members/children after removal
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
    });

    document.addEventListener('input', function(e) {
        // Handle Age calculation for children's Date of Birth
        if (e.target.dataset.name === 'Date_of_Birth' && e.target.closest('.child-block')) {
            calculateAge(e.target.closest('.child-block'));
        }
    });

    // Check URL for ID to determine if it's an EDIT operation
    const urlParams = new URLSearchParams(window.location.search);
    const householdId = urlParams.get('id');

    if (householdId) {
        isEditMode = true;
        document.getElementById('Household_ID').value = householdId;
        document.getElementById('main-title').textContent = 'Edit Census Record';
        document.getElementById('submit-btn').textContent = 'Update Record';
        const idDisplay = document.getElementById('household-id-display');
        idDisplay.textContent = `Editing Household ID: ${householdId}`;
        idDisplay.style.display = 'block';
        
        // Fetch and pre-fill the form
        fetchAndPreFill(householdId);

    } else {
        // Normal New Record Mode: Add initial member
        addMember(); 
    }
});

/**
 * Retrieves the data for a specific Household_ID and populates the form fields.
 * * @param {string} householdId The ID of the record to fetch.
 */
async function fetchAndPreFill(householdId) {
    const statusMessage = document.getElementById('status-message');
    const submitButton = document.getElementById('submit-btn');
    submitButton.disabled = true;
    submitButton.textContent = 'Loading Record...';
    statusMessage.style.display = 'block';
    statusMessage.className = 'alert';
    statusMessage.innerHTML = 'Retrieving existing record data...';
    
    try {
        const response = await fetch(`${API_ENDPOINT}?mode=single&id=${householdId}`);
        const text = await response.text();
        const record = JSON.parse(text);

        if (!record || record.status === 'error') {
            throw new Error(record ? record.message : 'Invalid response from server.');
        }

        // 1. Pre-fill Household Info (Static fields)
        fillStaticFields(record.Household);

        // 2. Pre-fill Members
        document.getElementById('members-container').innerHTML = ''; // Clear initial member
        record.Members.forEach(member => {
            const memberBlock = addMember();
            fillSectionFields(memberBlock, member, 'member');
        });

        // 3. Pre-fill Children
        document.getElementById('children-container').innerHTML = '';
        record.Children.forEach(child => {
            const childBlock = addChild();
            fillSectionFields(childBlock, child, 'child');
        });

        statusMessage.className = 'alert alert-success';
        statusMessage.innerHTML = `✅ Record ${householdId} loaded successfully. You may now edit the information.`;

    } catch (error) {
        console.error('Pre-fill Error:', error);
        statusMessage.className = 'alert alert-error';
        statusMessage.innerHTML = `❌ Failed to load record ${householdId}. ${error.message}`;
        // Disable submission if loading failed
        submitButton.disabled = true;
        return;
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Update Record'; // Set back to update text
    }
}

/**
 * Fills the main household fields.
 */
function fillStaticFields(data) {
    document.getElementById('Block_Name').value = data.Block_Name || '';
    document.getElementById('Residential_Address').value = data.Residential_Address || '';
    document.getElementById('Contact_No').value = data.Contact_No || '';
}

/**
 * Fills a dynamically created member or child block with data.
 */
function fillSectionFields(sectionBlock, data, type) {
    const fields = sectionBlock.querySelectorAll('[data-name]');
    fields.forEach(field => {
        const name = field.dataset.name;
        const value = data[name];
        
        if (value !== undefined && value !== null && value !== '') {
            if (field.tagName === 'SELECT') {
                // Select options
                field.value = value;
                // Trigger change event to show/hide sub-fields (sacraments/marriage)
                if (field.hasAttribute('onchange')) {
                     // Check for a special case for marriage status, where multiple values map to 'marriage' fields
                    if (name === 'Marital_Status' && (value.includes('Married') || value.includes('Widowed'))) {
                        toggleFields(field, 'marriage', true);
                    } else if (value === 'Yes') {
                        // All other Yes/No toggles
                        const classNameMatch = field.getAttribute('onchange').match(/toggleFields\(this, '(.*?)'\)/);
                        if (classNameMatch) {
                            toggleFields(field, classNameMatch[1], true);
                        }
                    }
                }
            } else {
                // Text/Date inputs
                field.value = value;
            }
        }
    });

    // Recalculate age after filling the date of birth for children
    if (type === 'child') {
        calculateAge(sectionBlock);
    }
}


/**
 * Helper function to parse all input fields in a given container and return an object.
 */
function parseSectionData(containerId) {
    const container = document.getElementById(containerId);
    const sections = container.querySelectorAll('.member-block, .child-block');
    const dataArray = [];

    sections.forEach(section => {
        const data = {};
        // Get all visible and hidden inputs with a data-name
        const inputs = section.querySelectorAll('input[data-name], select[data-name]');
        inputs.forEach(input => {
            const name = input.dataset.name;
            let value = input.value;
            
            // Handle date types to ensure format is consistent
            if (input.type === 'date' && value) {
                // Ensure the date is sent as YYYY-MM-DD string
                value = value; 
            }

            // Only capture non-empty values, except for required fields
            if (value || input.required) { 
                data[name] = value.trim();
            } else {
                 data[name] = '';
            }
        });
        dataArray.push(data);
    });
    return dataArray;
}

/**
 * Main submission handler for both New Records and Updates.
 */
async function submitForm(event) {
    event.preventDefault(); // Stop form from submitting normally
    
    const submitButton = document.getElementById('submit-btn');
    const statusMessage = document.getElementById('status-message');
    
    // Disable button to prevent double submission
    submitButton.disabled = true;
    submitButton.textContent = isEditMode ? 'Updating Record...' : 'Submitting...';
    statusMessage.style.display = 'none';

    // 1. Get Household Data (including the hidden Household_ID if present)
    const householdData = {
        Household_ID: document.getElementById('Household_ID').value,
        Block_Name: document.getElementById('Block_Name').value,
        Residential_Address: document.getElementById('Residential_Address').value,
        Contact_No: document.getElementById('Contact_No').value
    };

    // 2. Get Members and Children Data
    const membersArray = parseSectionData('members-container');
    const childrenArray = parseSectionData('children-container');

    // Basic validation
    if (membersArray.length === 0) {
        statusMessage.className = 'alert alert-error';
        statusMessage.innerHTML = '❌ Please add at least one member.';
        submitButton.disabled = false;
        submitButton.textContent = isEditMode ? 'Update Record' : 'Submit Census Data';
        statusMessage.style.display = 'block';
        return;
    }

    // 3. Create Final Payload
    const finalPayload = {
        household: householdData,
        members: membersArray, 
        children: childrenArray
    };

    // 4. Determine API Method
    const method = isEditMode ? 'PUT' : 'POST';
    // NOTE: Apps Script uses doPost for both POST and PUT methods via URL routing, 
    // but the payload handles the update logic. We use POST in fetch with no-cors.

    try {
        await fetch(API_ENDPOINT, {
            method: 'POST', // Use POST for both, let Apps Script determine new/update
            mode: 'no-cors', 
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(finalPayload),
        });
        
        // Success feedback
        statusMessage.className = 'alert alert-success';
        statusMessage.innerHTML = isEditMode 
            ? `✅ Record ${householdData.Household_ID} updated successfully!`
            : '✅ Data submitted successfully! Thank you.';
        
        // Reset only if it was a NEW record submission
        if (!isEditMode) {
             document.getElementById('census-form').reset();
            // Reset dynamic sections
            document.getElementById('members-container').innerHTML = '';
            document.getElementById('children-container').innerHTML = '';
            addMember(); // Add back the initial member
        }
        
    } catch (error) {
        console.error('Submission Error:', error);
        statusMessage.className = 'alert alert-error';
        statusMessage.innerHTML = `❌ Network Error: Could not submit data. Check your API URL and internet connection.`;
    } finally {
        statusMessage.style.display = 'block';
        submitButton.disabled = false;
        submitButton.textContent = isEditMode ? 'Update Record' : 'Submit Census Data';
    }
}


/**
 * Clones the member template, adds it to the container, and sets up its events.
 * @returns {HTMLElement} The newly created member block.
 */
function addMember() {
    const container = document.getElementById('members-container');
    const template = document.getElementById('member-template');
    const clone = template.content.cloneNode(true);
    const newBlock = clone.querySelector('.member-block');

    container.appendChild(newBlock);
    updateIndices();
    return newBlock;
}

/**
 * Clones the child template, adds it to the container, and sets up its events.
 * @returns {HTMLElement} The newly created child block.
 */
function addChild() {
    const container = document.getElementById('children-container');
    const template = document.getElementById('child-template');
    const clone = template.content.cloneNode(true);
    const newBlock = clone.querySelector('.child-block');

    container.appendChild(newBlock);
    updateIndices();
    return newBlock;
}

/**
 * Updates the index numbers displayed on each member and child block.
 */
function updateIndices() {
    document.querySelectorAll('#members-container .member-block').forEach((block, index) => {
        block.querySelector('.member-index').textContent = index + 1;
    });
    document.querySelectorAll('#children-container .child-block').forEach((block, index) => {
        block.querySelector('.child-index').textContent = index + 1;
    });
}

/**
 * Removes the section (member or child) containing the clicked remove button.
 */
function removeSection(buttonElement) {
    const sectionBlock = buttonElement.closest('.member-block, .child-block');
    if (sectionBlock) {
        sectionBlock.remove();
        updateIndices(); // Re-index after removal
    }
}

/**
 * Toggles the visibility of sub-fields (e.g., sacrament details).
 * * @param {HTMLSelectElement} selectElement The select element that triggered the change.
 * @param {string} fieldName The base name of the field group ('baptism', 'communion', etc.).
 * @param {boolean} forceShow Optional boolean to force visibility (used during pre-fill).
 */
function toggleFields(selectElement, fieldName, forceShow = false) {
    const container = selectElement.closest('.member-block, .child-block, .form-group');
    const subFields = container.querySelector(`.${fieldName}-fields`);
    const isYes = forceShow || selectElement.value.toLowerCase() === 'yes' || selectElement.value.toLowerCase().includes('married') || selectElement.value.toLowerCase().includes('widowed');

    if (subFields) {
        subFields.style.display = isYes ? 'block' : 'none';
        
        // Make date/text inputs required if they are visible
        const inputs = subFields.querySelectorAll('input, select');
        inputs.forEach(input => {
            if (isYes) {
                 // Only required fields that are truly necessary
                if (input.dataset.name.includes('Date') || input.dataset.name.includes('Church')) {
                    input.required = true;
                }
            } else {
                input.required = false;
                input.value = ''; // Clear value when hidden
            }
        });
    }
}

/**
 * Calculates the age of a child based on their Date of Birth.
 */
function calculateAge(childBlock) {
    const dobInput = childBlock.querySelector('[data-name="Date_of_Birth"]');
    const ageInput = childBlock.querySelector('[data-name="Age"]');

    if (dobInput && ageInput && dobInput.value) {
        const birthDate = new Date(dobInput.value);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        
        // Adjust age if birthday hasn't passed this year
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        
        ageInput.value = age >= 0 ? age : 'N/A';
    } else {
        ageInput.value = 'N/A';
    }
}

// Add the initial member when the script loads (for New Record mode only)
// This is now handled in the DOMContentLoaded listener.
// if (!isEditMode) { addMember(); }
