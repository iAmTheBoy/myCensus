// 🚨 REPLACE THIS WITH YOUR GOOGLE APPS SCRIPT WEB APP URL 🚨
const API_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyGUp-al-UUrFIPf6Btk0Mb7Cv8x-7DPHn67JR8SAuEbYaM0jriPix62GeahktSs67b/exec';

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
            const classNameMatch = e.target.getAttribute('onchange').match(/toggleFields\(this, '(.*?)'\)/);
            if (classNameMatch) {
                toggleFields(e.target, classNameMatch[1]);
            }
        }
        // Handle Age calculation for children's Date of Birth
        if (e.target.getAttribute('data-name') === 'Date_of_Birth' && e.target.closest('.child-section')) {
            calculateAge(e.target);
        }
    });

    // Add the initial member section when the page loads
    addMember(); 

    document.getElementById('census-form').addEventListener('submit', handleFormSubmit);
});


// === CORE UTILITY FUNCTIONS (Kept global for easy access from HTML onchange attributes) ===

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

/** Clones the member template and appends it to the container. */
function addMember() {
    const membersContainer = document.getElementById('members-container');
    const memberCount = membersContainer.querySelectorAll('.member-section').length + 1;
    
    const template = document.getElementById('member-template');
    const newSection = template.content.cloneNode(true).querySelector('.member-section');
    newSection.querySelector('.member-number').textContent = memberCount;

    // Initialize conditional fields based on default select value
    newSection.querySelectorAll('select[onchange]').forEach(select => {
        const classNameMatch = select.getAttribute('onchange').match(/toggleFields\(this, '(.*?)'\)/);
        if (classNameMatch) {
            toggleFields(select, classNameMatch[1]);
        }
    });

    membersContainer.appendChild(newSection);
}

/** Clones the child template and appends it to the container. */
function addChild() {
    const childrenContainer = document.getElementById('children-container');
    const childCount = childrenContainer.querySelectorAll('.child-section').length + 1;

    const template = document.getElementById('child-template');
    const newSection = template.content.cloneNode(true).querySelector('.child-section');
    newSection.querySelector('.child-number').textContent = childCount;

    // Initialize conditional fields based on default select value
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
    if (!confirm('Are you sure you want to remove this entry?')) return;
    const section = button.closest('.section-box');
    section.remove();
}


// === DATA COLLECTION AND SUBMISSION ===

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

async function handleFormSubmit(event) {
    event.preventDefault();
    const submitButton = document.getElementById('submit-btn');
    const statusMessage = document.getElementById('status-message');
    
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';
    statusMessage.style.display = 'none';

    // 1. Collect Household Data
    const householdData = {
        Block_Name: document.getElementById('block-name').value,
        Residential_Address: document.getElementById('address').value,
        Contact_No: document.getElementById('contact-no').value,
    };

    // 2. Collect Members and Children Data
    const membersArray = getSectionData('.member-section');
    const childrenArray = getSectionData('.child-section');
    
    if (membersArray.length === 0) {
        alert('Please add at least one adult member.');
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

    // 4. Send to Google Apps Script Web App
    try {
        await fetch(API_ENDPOINT, {
            method: 'POST',
            mode: 'no-cors', 
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(finalPayload),
        });
        
        statusMessage.className = 'alert alert-success';
        statusMessage.innerHTML = '✅ Data submitted successfully! Thank you.';
        document.getElementById('census-form').reset();
        
        // Reset dynamic sections
        document.getElementById('members-container').innerHTML = '';
        document.getElementById('children-container').innerHTML = '';
        addMember(); // Add back the initial member
        
    } catch (error) {
        console.error('Submission Error:', error);
        statusMessage.className = 'alert alert-error';
        statusMessage.innerHTML = `❌ Network Error: Could not submit data. Check your API URL and internet connection.`;
    } finally {
        statusMessage.style.display = 'block';
        submitButton.disabled = false;
        submitButton.textContent = 'Submit Census Data';
    }
}

