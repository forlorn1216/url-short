document.getElementById('shorten-form').addEventListener('submit', async function (e) {
  e.preventDefault();

  const originalUrl = document.getElementById('originalUrl').value;
  const customAlias = document.getElementById('customAlias').value;
  const password = document.getElementById('password').value;
  const expiresAt = document.getElementById('expiresAt').value;

  try {
    const response = await fetch('/api/shorten', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ originalUrl, customAlias, password, expiresAt })
    });
    

    if (!response.ok) {
      const errorData = await response.json();
      alert(`Error: ${errorData.error}`);
      return;
    }

    const data = await response.json();
    console.log(`Generated Short URL: ${data.shortUrl}`);
    
    // Show the result section with shortened URL and QR code
    document.getElementById('result').classList.remove('hidden');
    document.getElementById('shortUrl').textContent = data.shortUrl;
    document.getElementById('shortUrl').href = data.shortUrl;
    document.getElementById('qrCode').src = data.qrCode;
    
    // Hide the password prompt (in case it was shown before)
    document.getElementById('passwordPrompt').classList.add('hidden');
  } catch (error) {
    console.error('Error shortening URL:', error);
    alert('An error occurred while shortening the URL.');
  }
});

// Event listener for clicking on the shortened URL
document.getElementById('shortUrl').addEventListener('click', async function (e) {
  e.preventDefault();
  const shortUrl = e.target.href;

  try {
    // Hide any previously shown password prompt
    document.getElementById('passwordPrompt').classList.add('hidden');
    
    const metadataResponse = await fetch(`${shortUrl}/metadata`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!metadataResponse.ok) {
      if (metadataResponse.status === 404) {
        alert('The requested URL was not found. Please check the link and try again.');
      } else {
        alert(`Error fetching metadata: ${metadataResponse.statusText}`);
      }
      return;
    }

    const metadata = await metadataResponse.json();

    if (metadata.requiresPassword) {
      // Show password prompt only for password-protected links
      document.getElementById('passwordPrompt').classList.remove('hidden');
      
      // Focus on password input for better UX
      document.getElementById('redirectPassword').focus();
      
      // Configure the submit button
      document.getElementById('submitPassword').onclick = function() {
        const password = document.getElementById('redirectPassword').value;
        
        if (!password) {
          alert('Password is required to access this URL.');
          return;
        }

        // Directly redirect to the URL with password as query parameter
        window.location.href = `${shortUrl}?password=${encodeURIComponent(password)}`;
      };
      
      // Add enter key support for password input
      document.getElementById('redirectPassword').onkeyup = function(event) {
        if (event.key === "Enter") {
          document.getElementById('submitPassword').click();
        }
      };
    } else {
      // No password required, redirect directly
      window.location.href = shortUrl;
    }
  } catch (error) {
    console.error('Redirection error:', error);
    alert('An error occurred while trying to redirect. Please try again later.');
  }
});
