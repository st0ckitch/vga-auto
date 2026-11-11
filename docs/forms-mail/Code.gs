/**
 * VG Auto Export - website forms -> email (Google Apps Script, free).
 *
 * The website's Cloudflare Worker posts each submitted form here; this script sends it as an
 * email from the Google account it runs in. Install it in the salesvgae@gmail.com account.
 * Setup steps: README.md next to this file.
 */

/* Must equal the Cloudflare secret FORMS_SCRIPT_TOKEN. Any long random string. */
var TOKEN = 'CHANGE-ME-to-a-long-random-string';

/* Only these recipients are allowed, so the script cannot be used to send mail elsewhere. */
var ALLOWED_TO = ['salesvgae@gmail.com'];

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply({ ok: false, error: 'bad_json' });
  }
  if (TOKEN.indexOf('CHANGE-ME') === 0 || data.token !== TOKEN) {
    return reply({ ok: false, error: 'unauthorized' });
  }
  var to = String(data.to || '').split(',').map(function (a) { return a.trim().toLowerCase(); })
    .filter(function (a) { return ALLOWED_TO.indexOf(a) > -1; });
  if (!to.length) return reply({ ok: false, error: 'recipient_not_allowed' });
  var options = { name: 'VG Auto Export - საიტი' };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.replyTo || ''))) options.replyTo = data.replyTo;
  MailApp.sendEmail(to.join(','), String(data.subject || 'საიტის ფორმა').slice(0, 250), String(data.text || '').slice(0, 20000), options);
  return reply({ ok: true });
}

/* run this once from the editor to grant the "send email" permission and receive a test email */
function testSend() {
  MailApp.sendEmail(ALLOWED_TO[0], 'ტესტი: საიტის ფორმები', 'თუ ეს წერილი მოვიდა, სკრიპტი მუშაობს.', { name: 'VG Auto Export - საიტი' });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
