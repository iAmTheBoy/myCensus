// 🚨 REPLACE THIS WITH YOUR GOOGLE APPS SCRIPT WEB APP URL 🚨
const API_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyzpmV3d2etqNpujAQUWcrRfs-hPcBjB20mru-64Pdf10kWv-3W3lwWf1Ya0S_Mj91-/exec';

/**
 * NEW FEATURE: Handles the click event for the "Copy HHD No" button to autofill the member's contact.
 */
function handleAutofillContact(e) {
    if (e.target.classList.contains('autofill-contact-btn')) {
        // Find the main household contact number from the fixed field
        const householdContactInput = document.querySelector('input[data-name="Contact_No"].household-field');
        const householdContact = householdContactInput ? householdContactInput.value : '';

        if (householdContact) {
            // Find the member's Contact_No input, which is the previous sibling of the button
            const memberContactInput = e.target.previousElementSibling;
            if (memberContactInput) {
                memberContactInput.value = householdContact;
            }
        } else {
            alert('Please enter the Household Contact No first in the Household Information section.');
        }
    }
}

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
        
        // NEW FEATURE: Handle Autofill Contact Button
        handleAutofillContact(e); 
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
        if (e.target.dataset.name === 'Date_of_birth' && e.target.closest('.child-section')) {
            calculateAge(e.target);
        }
    });

    // Add the first member section on load
    addMember(); 
});


function addMember() {
    const template = document.getElementById('member-template');
    const container = document.getElementById('members-container');
    const clone = template.content.cloneNode(true);
    container.appendChild(clone);
    // Ensure initial state of sacrament fields is correct
    const newSection = container.lastElementChild;
    newSection.querySelectorAll('select[onchange]').forEach(select => {
        const classNameMatch = select.getAttribute('onchange').match(/toggleFields\(this, '(.*?)'\)/);
        if (classNameMatch) {
            toggleFields(select, classNameMatch[1]);
        }
    });
}

function addChild() {
    const template = document.getElementById('child-template');
    const container = document.getElementById('children-container');
    const clone = template.content.cloneNode(true);
    container.appendChild(clone);
    // Ensure initial state of sacrament fields is correct
    const newSection = container.lastElementChild;
    newSection.querySelectorAll('select[onchange]').forEach(select => {
        const classNameMatch = select.getAttribute('onchange').match(/toggleFields\(this, '(.*?)'\)/);
        if (classNameMatch) {
            toggleFields(select, classNameMatch[1]);
        }
    });
}

function removeSection(button) {
    const section = button.closest('.member-section') || button.closest('.child-section');
    if (section) {
        section.remove();
    }
}

function toggleFields(selectElement, className) {
    const parent = selectElement.closest('.member-section') || selectElement.closest('.child-section') || selectElement.closest('.sacraments-fields');
    const subFields = parent.querySelector(`.${className}-fields`);
    if (subFields) {
        subFields.style.display = selectElement.value === 'Yes' ? 'block' : 'none';
    }
}

function calculateAge(dateInput) {
    const dob = new Date(dateInput.value);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    const ageInput = dateInput.closest('.child-section').querySelector('input[data-name="Age"]');
    if (ageInput) {
        ageInput.value = age >= 0 ? age : 'Invalid Date';
    }
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const form = document.getElementById('census-form');
    const submitButton = document.getElementById('submit-btn');
    const statusMessage = document.getElementById('status-message');

    statusMessage.style.display = 'block';
    statusMessage.className = 'alert';
    statusMessage.textContent = 'Submitting data... Please wait.';
    submitButton.disabled = true;
    submitButton.textContent = 'Processing...';

    // 1. Collect Household Data (Fixed Section)
    const householdData = Array.from(form.querySelectorAll('.form-group input, .form-group select'))
        .filter(el => el.dataset.name)
        .reduce((acc, el) => {
            acc[el.dataset.name] = el.value;
            return acc;
        }, {});

    // 2. Collect Dynamic Data (Members and Children)
    const membersContainer = document.getElementById('members-container');
    const childrenContainer = document.getElementById('children-container');

    const membersArray = Array.from(membersContainer.querySelectorAll('.member-section')).map(section => {
        return Array.from(section.querySelectorAll('input, select'))
            .filter(el => el.dataset.name)
            .reduce((acc, el) => {
                acc[el.dataset.name] = el.value;
                return acc;
            }, {});
    });

    const childrenArray = Array.from(childrenContainer.querySelectorAll('.child-section')).map(section => {
        return Array.from(section.querySelectorAll('input, select'))
            .filter(el => el.dataset.name)
            .reduce((acc, el) => {
                acc[el.dataset.name] = el.value;
                return acc;
            }, {});
    });

    // Check if at least one adult member exists (Validation Check)
    if (membersArray.length === 0) {
        statusMessage.className = 'alert alert-error';
        statusMessage.textContent = '❌ Submission Failed: You must add at least one adult member.';
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
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            // mode: 'no-cors' is required for simple form submissions to GAS, but we must handle the response
            // We use no-cors and check the error/success locally, relying on the GAS to handle the redirect/success.
            mode: 'no-cors', 
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(finalPayload),
        });
        
        // Due to mode: 'no-cors', response.ok, response.status, and response.json() are inaccessible.
        // We assume success if the network request completes without a network error.
        
        statusMessage.className = 'alert alert-success';
        statusMessage.innerHTML = '✅ Data submitted successfully! Thank you.';
        
        // Reset form and dynamic sections
        form.reset();
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

document.getElementById('census-form').addEventListener('submit', handleFormSubmit);
