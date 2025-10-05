#!/usr/bin/env node

// Script to test webhook integration
const https = require('https');
const http = require('http');

const args = process.argv.slice(2);
const isLocal = args.includes('--local');
const baseUrl = isLocal ? 'http://localhost:3000' : 'https://nana-kick.vercel.app';

// Test events
const testEvents = {
  'membership.went_valid': {
    event: 'membership.went_valid',
    data: {
      membership_id: 'mem_test123',
      user_id: 'user_test123',
      company_id: 'biz_test123',
      valid: true,
      email: 'testuser@example.com',
      username: 'testuser',
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    }
  },
  'membership.went_invalid': {
    event: 'membership.went_invalid',
    data: {
      membership_id: 'mem_test123',
      user_id: 'user_test123',
      company_id: 'biz_test123',
      valid: false,
    }
  },
  'payment.completed': {
    event: 'payment.completed',
    data: {
      payment_id: 'pay_test123',
      subscription_id: 'sub_test123',
      amount: 9.99,
      currency: 'USD',
      payment_method: 'card',
    }
  },
  'app.installed': {
    event: 'app.installed',
    data: {
      company_id: 'biz_test123',
      company_name: 'Test Company',
      installed_at: new Date().toISOString(),
    }
  }
};

function sendWebhook(eventType) {
  const payload = testEvents[eventType] || {
    event: eventType,
    data: { test: true, timestamp: new Date().toISOString() }
  };

  const url = new URL(`${baseUrl}/api/webhooks`);
  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify(payload)),
    }
  };

  console.log(`\\nSending ${eventType} webhook to ${url.href}...`);
  console.log('Payload:', JSON.stringify(payload, null, 2));

  const protocol = url.protocol === 'https:' ? https : http;
  const req = protocol.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log(`\\nResponse Status: ${res.statusCode}`);
      console.log('Response:', data);
      if (res.statusCode !== 200) {
        console.error('❌ Webhook failed');
      } else {
        console.log('✅ Webhook sent successfully');
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Error sending webhook:', error.message);
  });

  req.write(JSON.stringify(payload));
  req.end();
}

// Main execution
const eventType = args.find(arg => !arg.startsWith('--')) || 'membership.went_valid';

console.log('Whop Webhook Tester');
console.log('==================');
console.log(`Target: ${baseUrl}`);
console.log(`Event: ${eventType}`);

if (!testEvents[eventType]) {
  console.log('\\nAvailable test events:');
  Object.keys(testEvents).forEach(event => {
    console.log(`  - ${event}`);
  });
  console.log('\\nUsage: node test-webhook.js [event-type] [--local]');
  console.log('Example: node test-webhook.js membership.went_valid --local');
} else {
  sendWebhook(eventType);
}