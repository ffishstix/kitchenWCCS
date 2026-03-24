async function getLastLogin() {
    try {
        const response = await fetch('/api/getLastLogin');
        const data = await response.json();
        if (data.lastLogin) {
            document.querySelector('#last-login').textContent = `Last login: ${data.lastLogin}`;
        }
    } catch (error) {
        console.error('Error fetching last login:', error);
    }
}

async function setLastLogin() {
    const now = new Date();
    const currentDate = formatDate(now);

    try {
        await fetch('/api/setLastLogin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({currentDate}),
        });
    } catch (error) {
        console.error('Error saving last login:', error);
    }
}

function formatDate(date) {
    const options = {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
    };
    return date.toLocaleDateString('en-US', options).replace(',', '') + ' from 10.69.42.09';
}

async function updateLoginTime() {
    await getLastLogin();
    await setLastLogin();
}

updateLoginTime();
  