document.getElementById('analytics-form').addEventListener('submit', async function (e) {
  e.preventDefault();

  const shortCode = document.getElementById('shortCode').value;
  if (!shortCode) {
    alert('Please enter a short URL code');
    return;
  }

  try {
    // Show loading state
    document.getElementById('analyticsResult').innerHTML = '<div class="loading-spinner"><div></div><div></div><div></div></div>';
    document.getElementById('analyticsResult').classList.remove('hidden');

    const response = await fetch(`/api/analytics/${shortCode}`);
    if (!response.ok) {
      if (response.status === 404) {
        document.getElementById('analyticsResult').innerHTML = 
          '<div class="no-data-message">No data found for this URL.<br>The URL may not exist or has not been clicked yet.</div>';
        return;
      }
      throw new Error('Failed to fetch analytics data');
    }
    
    const data = await response.json();

    // Format creation date
    const creationDate = new Date(data.createdAt);
    const formattedCreationDate = creationDate.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Calculate link age
    const now = new Date();
    const ageInDays = Math.floor((now - creationDate) / (1000 * 60 * 60 * 24));
    const ageText = ageInDays === 0 ? 'Today' : 
                   ageInDays === 1 ? '1 day ago' : 
                   `${ageInDays} days ago`;

    // Reset and rebuild the analytics result section
    document.getElementById('analyticsResult').innerHTML = `
      <div class="analytics-header">
        <h2>Analytics Overview</h2>
        <p>Total Clicks: <span id="totalClicks" class="highlight-number">${data.totalClicks || 0}</span></p>
        <p class="link-creation-info">
          <span class="creation-label">Created:</span> 
          <span class="creation-date">${formattedCreationDate}</span>
          <span class="creation-age">(${ageText})</span>
        </p>
        ${data.totalClicks === 0 ? '<div class="no-data-message">This URL has not been clicked yet. Check back later for analytics data.</div>' : ''}
      </div>
      
      <div class="analytics-grid" ${data.totalClicks === 0 ? 'style="display:none"' : ''}>
        <div class="chart-container">
          <h3>Clicks Over Time</h3>
          <canvas id="clicksByDateChart"></canvas>
        </div>
        
        <div class="chart-container">
          <h3>Clicks by Hour</h3>
          <canvas id="clicksByHourChart"></canvas>
        </div>
        
        <div class="chart-container">
          <h3>Top Locations</h3>
          <canvas id="locationStatsChart"></canvas>
        </div>
        
        <div class="chart-container">
          <h3>Device Breakdown</h3>
          <canvas id="deviceStatsChart"></canvas>
        </div>
        
        <div class="chart-container">
          <h3>Referrer Sources</h3>
          <canvas id="referrerStatsChart"></canvas>
        </div>
      </div>
      
      <div class="export-section" ${data.totalClicks === 0 ? 'style="display:none"' : ''}>
        <a id="exportCSV" class="btn-secondary">Export as CSV</a>
      </div>
    `;

    // If no clicks, don't try to render charts
    if (data.totalClicks === 0) {
      return;
    }

    // Update clicks by date chart - ensure we have some dates displayed even with sparse data
    let dateLabels = Object.keys(data.clicksByDate || {}).sort();
    let dateValues = dateLabels.map(date => data.clicksByDate[date]);
    
    // If we have fewer than 3 dates, add empty dates to make the chart look better
    if (dateLabels.length < 3) {
      // Add some dates before and after if we only have one date point
      if (dateLabels.length === 1) {
        const currentDate = new Date(dateLabels[0]);
        
        // Add a date before
        const prevDate = new Date(currentDate);
        prevDate.setDate(prevDate.getDate() - 1);
        dateLabels.unshift(prevDate.toISOString().split('T')[0]);
        dateValues.unshift(0);
        
        // Add a date after
        const nextDate = new Date(currentDate);
        nextDate.setDate(nextDate.getDate() + 1);
        dateLabels.push(nextDate.toISOString().split('T')[0]);
        dateValues.push(0);
      }
      // If we have two dates, add one more to make it look better
      else if (dateLabels.length === 2) {
        const lastDate = new Date(dateLabels[1]);
        const nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + 1);
        dateLabels.push(nextDate.toISOString().split('T')[0]);
        dateValues.push(0);
      }
    }
    
    updateChart('clicksByDateChart', 'line', dateLabels, dateValues, 'Clicks Over Time', 
      { borderColor: '#2575fc', backgroundColor: 'rgba(37, 117, 252, 0.1)' });

    // Update clicks by hour chart
    const hourLabels = Array.from({length: 24}, (_, i) => `${i}:00`);
    const hourValues = hourLabels.map((_, i) => data.clicksByHour?.[i] || 0);
    updateChart('clicksByHourChart', 'bar', hourLabels, hourValues, 'Clicks by Hour of Day',
      { backgroundColor: 'rgba(37, 117, 252, 0.7)' });

    // Update location stats chart with better handling of small data sets
    const locationLabels = Object.keys(data.locationStats || {});
    const locationValues = Object.values(data.locationStats || {});
    updateChart('locationStatsChart', 'pie', 
               locationLabels.length ? locationLabels : ['No location data'], 
               locationLabels.length ? locationValues : [1], 
               'Location Analytics',
               { backgroundColors: getColorPalette(Math.max(locationLabels.length, 1)) });

    // Update device stats chart
    const deviceLabels = Object.keys(data.deviceStats || {});
    const deviceValues = Object.values(data.deviceStats || {});
    updateChart('deviceStatsChart', 'doughnut', 
               deviceLabels.length ? deviceLabels : ['No device data'], 
               deviceLabels.length ? deviceValues : [1], 
               'Device Breakdown',
               { backgroundColors: getColorPalette(Math.max(deviceLabels.length, 1), 'devices') });

    // Update referrer stats chart
    const referrerLabels = Object.keys(data.referrerStats || {});
    const referrerValues = Object.values(data.referrerStats || {});
    updateChart('referrerStatsChart', 'pie', 
               referrerLabels.length ? referrerLabels : ['No referrer data'], 
               referrerLabels.length ? referrerValues : [1], 
               'Referrer Stats',
               { backgroundColors: getColorPalette(Math.max(referrerLabels.length, 1), 'referrers') });
    
    // Configure export button
    document.getElementById('exportCSV').href = `/api/analytics/${shortCode}/export`;
    document.getElementById('exportCSV').download = `${shortCode}_analytics.csv`;
    
  } catch (error) {
    console.error('Error fetching analytics:', error);
    document.getElementById('analyticsResult').innerHTML = 
      '<div class="error-message">An error occurred while fetching analytics data. Please try again.</div>';
  }
});

function updateChart(chartId, type, labels, data, title, options = {}) {
  const ctx = document.getElementById(chartId).getContext('2d');
  
  // Destroy existing chart if it exists
  if (window[chartId] && typeof window[chartId].destroy === 'function') {
    window[chartId].destroy();
  }
  
  // Set default options
  let chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: 'bottom',
        labels: { 
          usePointStyle: true,
          padding: 20,
          font: { size: 11 }
        }
      },
      tooltip: { mode: 'index' },
      title: {
        display: false
      }
    }
  };
  
  // Add type-specific options
  if (type === 'line') {
    chartOptions = {
      ...chartOptions,
      scales: {
        y: { beginAtZero: true, grid: { display: true, color: '#f0f0f0' } },
        x: { grid: { display: false } }
      },
      elements: {
        line: { tension: 0.4 }
      }
    };
  } else if (type === 'bar') {
    chartOptions = {
      ...chartOptions,
      scales: {
        y: { beginAtZero: true, grid: { display: true, color: '#f0f0f0' } },
        x: { grid: { display: false } }
      }
    };
  }
  
  // Create the dataset configuration
  let datasetConfig = {
    label: title,
    data: data
  };
  
  // Apply colors based on chart type
  if (type === 'line') {
    datasetConfig.borderColor = options.borderColor || '#2575fc';
    datasetConfig.backgroundColor = options.backgroundColor || 'rgba(37, 117, 252, 0.1)';
    datasetConfig.fill = true;
  } else if (type === 'bar') {
    datasetConfig.backgroundColor = options.backgroundColor || 'rgba(37, 117, 252, 0.7)';
  } else if (['pie', 'doughnut'].includes(type)) {
    datasetConfig.backgroundColor = options.backgroundColors || getColorPalette(data.length);
    datasetConfig.borderColor = '#fff';
    datasetConfig.borderWidth = 1;
  }
  
  // Create and save the chart instance
  window[chartId] = new Chart(ctx, {
    type: type,
    data: {
      labels: labels,
      datasets: [datasetConfig]
    },
    options: chartOptions
  });
}

// Function to generate a color palette
function getColorPalette(count, type = 'default') {
  const palettes = {
    default: [
      '#2575fc', '#4CAF50', '#FFC107', '#9C27B0', '#F44336',
      '#3F51B5', '#FF9800', '#00BCD4', '#795548', '#E91E63'
    ],
    devices: [
      '#2575fc', '#00C49F', '#FFBB28', '#FF8042', '#9C27B0',
      '#F44336', '#3F51B5', '#FF9800', '#00BCD4', '#795548'
    ],
    referrers: [
      '#4285F4', '#EA4335', '#FBBC05', '#34A853', '#673AB7',
      '#FF9800', '#00BCD4', '#795548', '#E91E63', '#607D8B'
    ]
  };
  
  const colors = palettes[type] || palettes.default;
  
  // If we need more colors than in our palette, we'll generate them
  if (count > colors.length) {
    for (let i = colors.length; i < count; i++) {
      const hue = (i * 137.5) % 360; // Use golden angle approximation for nice spread
      colors.push(`hsl(${hue}, 70%, 60%)`);
    }
  }
  
  return colors.slice(0, count);
}
