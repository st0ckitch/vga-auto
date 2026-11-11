# Website forms -> email (free, Google Apps Script)

The site's three forms (request a call, contact-page feedback, footer newsletter) post to the
Cloudflare Worker. The Worker forwards each one to this script, which sends it as an email from the
salesvgae@gmail.com account to itself. Free (about 100 emails a day), no DNS or MX changes.

## Setup (once, logged in as salesvgae@gmail.com)

1. Open https://script.google.com and create a **New project**. Name it "VG Auto Export forms".
2. Replace the editor's contents with `Code.gs` from this folder.
3. Change `TOKEN` to a long random string. Save.
4. Select the function `testSend` and press **Run**. Allow the permissions Google asks for
   ("Advanced" -> "Go to ... (unsafe)" is expected for your own script). A test email arrives.
5. **Deploy -> New deployment**, type **Web app**: Execute as **Me**, Who has access **Anyone**.
   Press Deploy and copy the **Web app URL** (ends with `/exec`).
6. Cloudflare -> Workers & Pages -> vga-auto -> Settings -> Variables and Secrets, add two **Secrets**:
   - `FORMS_SCRIPT_URL` = the Web app URL
   - `FORMS_SCRIPT_TOKEN` = the same string as `TOKEN` in the script
   Then Deploy.

After a change to the script, use Deploy -> **Manage deployments** -> edit -> Version: New version,
so the URL stays the same.

## Notes

- `ALLOWED_TO` limits who the script will email, so the URL cannot be abused to send mail elsewhere.
- Recipient on the site side: salesvgae@gmail.com by default, or the `FORMS_TO` variable.
- If the form shows an error, the browser's Network tab (request `callback`, `feedback` or `subscribe`
  -> Response) contains `detail` with the script's answer.
