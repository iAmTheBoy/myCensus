// 🚨 REPLACE THIS WITH YOUR GOOGLE APPS SCRIPT WEB APP URL 🚨
const API_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxCETjVqQEAl_BAoW3wuUM9nCJWTfcJdPG_IQtk_Awqtgy2NyMMQa88PVLehuqQNnaQ/exec';

// Global variable to hold the mode and Household ID
let IS_EDIT_MODE = false;
let EDIT_HOUSEHOLD_ID = null;

document.addEventListener('DOMContentLoaded', () => {
    // Check for Edit Mode
    const urlParams = new URLSearchParams(window.location.search);
    const householdId = urlParams.get('id');
    
    if (householdId) {
        IS_EDIT_MODE = true;
        EDIT_HOUSEHOLD_ID = householdId;
        setupEditMode(householdId);
    } else {
        // Normal New Record Mode setup
        document.getElementById('form-title').textContent = 'Our Lady of Fatima Shrine Census - New Household Registration';
        document.getElementById('submit-btn').textContent = 'Submit New Census Data';
        // Add the initial member for a new form
        addMember(); 
    }

    // Attach listeners to the static Add buttons using their IDs
    document.getElementById('add-member-btn').addEventListener('click', addMember);
    document.getElementById('add-child-btn').addEventListener('click', addChild);
    document.getElementById('census-form').addEventListener('submit', submitForm);

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
            const classNameMatch = e.target.getAttribute('onchange').match(/toggleFields\(this, '(.*?)'\)/);
            if (classNameMatch) {
                toggleFields(e.target, classNameMatch[1]);
            }
        }
        // Handle Age calculation for children's Date of Birth
        if (e.target.classList.contains('child-dob-input')) {
            calculateAge(e.target);
        }
    });
});

/**
 * Sets up the form for editing an existing record.
 */
async function setupEditMode(householdId) {
    document.getElementById('form-title').textContent = `Our Lady of Fatima Shrine Census - Editing Record: ${householdId}`;
    document.getElementById('submit-btn').textContent = 'Update Record';
    document.getElementById('household-id').value = householdId;
    displayStatus('Fetching existing record data...', 'info');

    try {
        // Fetch a single record using the new doGet action
        const response = await fetch(`${API_ENDPOINT}?action=getRecord&id=${householdId}`);
        const data = await response.json();
        const record = data.singleRecord;

        if (record) {
            prefillForm(record);
            displayStatus(`Record ${householdId} loaded for editing.`, 'success');
        } else {
            displayStatus('Error: Record not found.', 'error');
        }

    } catch (error) {
        console.error('Error fetching record for editing:', error);
        displayStatus('Network Error: Could not load data for editing.', 'error');
    }
}

/**
 * Pre-fills the form fields with the fetched record data.
 */
function prefillForm(record) {
    // 1. Household Info
    const householdSection = document.getElementById('census-form');
    for (const key in record.Household) {
        const input = householdSection.querySelector(`[data-name="${key}"]`);
        if (input) input.value = record.Household[key] || '';
    }

    // 2. Members Info
    document.getElementById('members-container').innerHTML = ''; // Clear initial member
    record.Members.forEach(member => {
        addMember(); // Add a new member section
        const newMemberSection = document.getElementById('members-container').lastElementChild;
        for (const key in member) {
            const input = newMemberSection.querySelector(`[data-name="${key}"]`);
            if (input) {
                input.value = member[key] || '';
            }
        }
        // Manually trigger change events for selects to show/hide sub-fields
        newMemberSection.querySelectorAll('select[onchange]').forEach(select => {
            select.dispatchEvent(new Event('change'));
        });
    });

    // If there are no members, add one empty section
    if (record.Members.length === 0) addMember();

    // 3. Children Info
    document.getElementById('children-container').innerHTML = '';
    record.Children.forEach(child => {
        addChild(); // Add a new child section
        const newChildSection = document.getElementById('children-container').lastElementChild;
        for (const key in child) {
            const input = newChildSection.querySelector(`[data-name="${key}"]`);
            if (input) input.value = child[key] || '';
        }
        // Manually calculate age after setting DOB
        const dobInput = newChildSection.querySelector('.child-dob-input');
        if (dobInput) calculateAge(dobInput);
        
        // Manually trigger change events for selects
        newChildSection.querySelectorAll('select[onchange]').forEach(select => {
            select.dispatchEvent(new Event('change'));
        });
    });
}

function displayStatus(message, type = 'info') {
    const statusMessage = document.getElementById('status-message');
    statusMessage.textContent = message;
    statusMessage.className = `alert alert-${type}`;
    statusMessage.style.display = 'block';
}

function calculateAge(dobInput) {
    const dob = new Date(dobInput.value);
    const ageOutput = dobInput.closest('.child-section').querySelector('.child-age-output');

    if (isNaN(dob)) {
        ageOutput.value = '';
        return;
    }

    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    
    ageOutput.value = age >= 0 ? age : 'N/A';
}

function toggleFields(selectElement, className) {
    // Find the nearest parent container for member/child
    const parentSection = selectElement.closest('.member-section, .child-section');
    if (!parentSection) return;
    
    // Find the specific sub-fields container within that parent
    const subFields = parentSection.querySelector(`.${className}-fields`);
    
    if (subFields) {
        subFields.style.display = selectElement.value === 'Yes' ? 'block' : 'none';
        // Clear fields when hidden to prevent submission of irrelevant data
        if (selectElement.value !== 'Yes') {
            subFields.querySelectorAll('input, select').forEach(input => input.value = '');
        }
    }
}

function addSection(containerId, templateId, counterSelector, sectionClass) {
    const container = document.getElementById(containerId);
    const template = document.getElementById(templateId);
    const clone = template.content.cloneNode(true);
    const newSection = clone.querySelector(`.${sectionClass}`);

    // Update count
    const newCount = container.children.length + 1;
    const countElement = newSection.querySelector(counterSelector);
    if (countElement) countElement.textContent = newCount;

    container.appendChild(newSection);

    // Initial check for required fields visibility
    newSection.querySelectorAll('select[onchange]').forEach(select => {
        // Ensure the change logic is run for initial state (e.g., to hide fields if default is 'No')
        select.dispatchEvent(new Event('change'));
    });
}

function addMember() {
    addSection('members-container', 'member-template', '.member-count', 'member-section');
}

function addChild() {
    addSection('children-container', 'child-template', '.child-count', 'child-section');
}

function removeSection(button) {
    const section = button.closest('.member-section, .child-section');
    if (section) {
        const container = section.parentElement;
        section.remove();
        // Re-count sections after removal
        recountSections(container);
    }
}

function recountSections(container) {
    const isMember = container.id === 'members-container';
    const counterSelector = isMember ? '.member-count' : '.child-count';
    let count = 1;
    container.querySelectorAll(isMember ? '.member-section' : '.child-section').forEach(section => {
        const countElement = section.querySelector(counterSelector);
        if (countElement) countElement.textContent = count++;
    });
}

/**
 * Main form submission handler. Now handles both NEW and UPDATE.
 */
async function submitForm(e) {
    e.preventDefault();
    const submitButton = document.getElementById('submit-btn');
    const statusMessage = document.getElementById('status-message');

    // 1. Disable button and update status
    submitButton.disabled = true;
    submitButton.textContent = IS_EDIT_MODE ? 'Updating...' : 'Submitting...';
    displayStatus('Processing data...', 'info');

    // 2. Collect Household Data
    const householdData = {};
    document.querySelectorAll('#census-form > .form-group input, #census-form > .form-group select').forEach(input => {
        if (input.dataset.name) {
            householdData[input.dataset.name] = input.value;
        }
    });

    // Get the Household_ID from the hidden field (needed for updates)
    const hiddenIdInput = document.getElementById('household-id');
    if (hiddenIdInput && hiddenIdInput.dataset.name) {
        householdData[hiddenIdInput.dataset.name] = hiddenIdInput.value;
    }


    // 3. Collect Members Data
    const membersArray = [];
    document.querySelectorAll('#members-container > .member-section').forEach(section => {
        const memberData = {};
        section.querySelectorAll('input, select').forEach(input => {
            if (input.dataset.name) {
                // Collect only visible fields
                const subFieldContainer = input.closest('.sub-fields');
                if (!subFieldContainer || subFieldContainer.style.display !== 'none') {
                    memberData[input.dataset.name] = input.value;
                }
            }
        });
        membersArray.push(memberData);
    });

    if (membersArray.length === 0) {
        displayStatus('❌ Error: You must add at least one adult member.', 'error');
        submitButton.disabled = false;
        submitButton.textContent = IS_EDIT_MODE ? 'Update Record' : 'Submit Census Data';
        return;
    }

    // 4. Collect Children Data
    const childrenArray = [];
    document.querySelectorAll('#children-container > .child-section').forEach(section => {
        const childData = {};
        section.querySelectorAll('input, select').forEach(input => {
            if (input.dataset.name) {
                 // Collect only visible fields
                const subFieldContainer = input.closest('.sub-fields');
                if (!subFieldContainer || subFieldContainer.style.display !== 'none') {
                    childData[input.dataset.name] = input.value;
                }
            }
        });
        childrenArray.push(childData);
    });

    // 5. Create Final Payload (with action and ID for update mode)
    const finalPayload = {
        household: householdData,
        members: membersArray, 
        children: childrenArray,
        // Add specific keys for Apps Script routing
        action: IS_EDIT_MODE ? 'UPDATE' : 'NEW',
        Household_ID: EDIT_HOUSEHOLD_ID // Null for new, ID for update
    };

    // 6. Send to Google Apps Script Web App
    try {
        await fetch(API_ENDPOINT, {
            method: 'POST', // Always POST for Apps Script web app
            mode: 'no-cors', 
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(finalPayload),
        });
        
        // Show success message
        statusMessage.className = 'alert alert-success';
        if (IS_EDIT_MODE) {
            statusMessage.innerHTML = '✅ Data updated successfully! You can close this window now.';
        } else {
            statusMessage.innerHTML = '✅ Data submitted successfully! Thank you.';
            // Reset dynamic sections only for new submissions
            document.getElementById('census-form').reset();
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
        submitButton.textContent = IS_EDIT_MODE ? 'Update Record' : 'Submit Census Data';
    }
}
