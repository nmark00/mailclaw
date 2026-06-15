"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmailBodyByLookup = getEmailBodyByLookup;
exports.openEmailByLookup = openEmailByLookup;
exports.getEmailBody = getEmailBody;
exports.openEmail = openEmail;
exports.openEmailByRowId = openEmailByRowId;
exports.createDraft = createDraft;
exports.deleteEmailByLookup = deleteEmailByLookup;
exports.replyToEmail = replyToEmail;
exports.listAccounts = listAccounts;
exports.scheduleDraft = scheduleDraft;
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const execAsync = (0, node_util_1.promisify)(node_child_process_1.exec);
const NOT_FOUND_SENTINEL = '__MAILCLAW_NOT_FOUND__';
const SCRIPT_ERROR_SENTINEL = '__MAILCLAW_SCRIPT_ERROR__';
function escapeAppleScriptString(value) {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
function toAppleScriptStringList(values) {
    return `{${values.map((value) => `"${escapeAppleScriptString(value)}"`).join(', ')}}`;
}
function toAppleScriptNumberList(values) {
    return `{${values.map((value) => `${value}`).join(', ')}}`;
}
function normalizeLookupContext(context) {
    const messageIdCandidates = Array.from(new Set((context.messageIdCandidates ?? [])
        .map((value) => value.trim())
        .filter((value) => value.length > 0)));
    const mailboxHints = Array.from(new Set((context.mailboxHints ?? [])
        .map((value) => value.trim())
        .filter((value) => value.length > 0)));
    const numericIdCandidates = Array.from(new Set((context.numericIdCandidates ?? [])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)));
    return {
        messageIdCandidates,
        mailboxHints,
        numericIdCandidates,
        subject: (context.subject ?? '').trim(),
        sender: (context.sender ?? '').trim()
    };
}
function buildLookupScript(context, mode) {
    const normalized = normalizeLookupContext(context);
    const escapedSubject = escapeAppleScriptString(normalized.subject);
    const escapedSender = escapeAppleScriptString(normalized.sender);
    const mailboxHintsList = toAppleScriptStringList(normalized.mailboxHints);
    const messageIdCandidatesList = toAppleScriptStringList(normalized.messageIdCandidates);
    const numericIdCandidatesList = toAppleScriptNumberList(normalized.numericIdCandidates);
    return `
    tell application "Mail"
      try
        set foundMsg to missing value
        set targetSubject to "${escapedSubject}"
        set targetSender to "${escapedSender}"
        set mailboxHints to ${mailboxHintsList}
        set messageIdCandidates to ${messageIdCandidatesList}
        set numericIdCandidates to ${numericIdCandidatesList}
        set mailboxRefs to {}
        set hintedMailboxRefs to {}

        repeat with accountRef in every account
          try
            repeat with accountMailbox in every mailbox of accountRef
              set end of mailboxRefs to accountMailbox
            end repeat
          end try
        end repeat

        try
          repeat with rootMailbox in every mailbox
            set end of mailboxRefs to rootMailbox
          end repeat
        end try

        if (count of mailboxHints) > 0 then
          repeat with mailboxRef in mailboxRefs
            set mailboxLabel to ""
            try
              set mailboxLabel to (name of mailboxRef as text)
            end try
            if mailboxLabel is not "" then
              repeat with hintRef in mailboxHints
                set hintText to hintRef as text
                if hintText is not "" then
                  if mailboxLabel contains hintText or hintText contains mailboxLabel then
                    set end of hintedMailboxRefs to mailboxRef
                    exit repeat
                  end if
                end if
              end repeat
            end if
          end repeat
        end if

        if (count of hintedMailboxRefs) > 0 then
          set mailboxRefs to hintedMailboxRefs
        end if

        repeat with candidateText in messageIdCandidates
          set candidateId to candidateText as text
          if candidateId is not "" then
            repeat with mailboxRef in mailboxRefs
              try
                set foundMsg to first message of mailboxRef whose message id is candidateId
                exit repeat
              end try
              try
                set foundMsg to first message of mailboxRef whose message id is "<" & candidateId & ">"
                exit repeat
              end try
            end repeat
            if foundMsg is not missing value then exit repeat
          end if
        end repeat

        if foundMsg is missing value then
          repeat with candidateNumeric in numericIdCandidates
            if candidateNumeric is greater than 0 then
              repeat with mailboxRef in mailboxRefs
                try
                  set foundMsg to first message of mailboxRef whose id is candidateNumeric
                  exit repeat
                end try
              end repeat
              if foundMsg is not missing value then exit repeat
            end if
          end repeat
        end if

        if foundMsg is missing value and targetSubject is not "" then
          repeat with mailboxRef in mailboxRefs
            try
              if targetSender is not "" then
                set foundMsg to first message of mailboxRef whose subject is targetSubject and sender contains targetSender
              else
                set foundMsg to first message of mailboxRef whose subject is targetSubject
              end if
              exit repeat
            end try
            try
              set foundMsg to first message of mailboxRef whose subject is targetSubject
              exit repeat
            end try
            try
              if targetSender is not "" then
                set foundMsg to first message of mailboxRef whose subject contains targetSubject and sender contains targetSender
              else
                set foundMsg to first message of mailboxRef whose subject contains targetSubject
              end if
              exit repeat
            end try
            try
              set foundMsg to first message of mailboxRef whose subject contains targetSubject
              exit repeat
            end try
          end repeat
        end if

        if foundMsg is missing value then
          return "${NOT_FOUND_SENTINEL}"
        end if

        ${mode === 'body' ? 'return content of foundMsg' : 'open foundMsg\n        activate\n        return "OK"'}
      on error errMsg number errNum
        return "${SCRIPT_ERROR_SENTINEL}" & errNum & ":" & errMsg
      end try
    end tell
  `;
}
async function runLookupScript(context, mode) {
    const script = buildLookupScript(context, mode);
    try {
        const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
        const output = stdout.trim();
        if (output === NOT_FOUND_SENTINEL) {
            throw new Error('Message not found');
        }
        if (output.startsWith(SCRIPT_ERROR_SENTINEL)) {
            throw new Error(`Mail AppleScript error: ${output.replace(SCRIPT_ERROR_SENTINEL, '')}`);
        }
        return output;
    }
    catch (error) {
        if (error.message === 'Message not found' || error.message.includes(NOT_FOUND_SENTINEL)) {
            throw new Error('Message not found');
        }
        throw error;
    }
}
async function getEmailBodyByLookup(context) {
    try {
        return await runLookupScript(context, 'body');
    }
    catch (error) {
        if (error.message === 'Message not found') {
            throw error;
        }
        throw new Error('Failed to fetch message body via AppleScript');
    }
}
async function openEmailByLookup(context) {
    try {
        await runLookupScript(context, 'open');
    }
    catch (error) {
        if (error.message === 'Message not found') {
            throw error;
        }
        throw new Error('Failed to open message via AppleScript');
    }
}
// Backwards-compatible wrappers
async function getEmailBody(messageId) {
    if (!/^\d+$/.test(messageId)) {
        throw new Error('Invalid message ID');
    }
    return getEmailBodyByLookup({
        numericIdCandidates: [parseInt(messageId, 10)]
    });
}
async function openEmail(documentId) {
    if (!documentId) {
        throw new Error('Invalid document ID');
    }
    try {
        await openEmailByLookup({
            messageIdCandidates: [documentId.replace(/^<|>$/g, '')]
        });
    }
    catch (error) {
        if (error.message === 'Message not found') {
            throw error;
        }
        throw new Error('Failed to open message via document ID');
    }
}
async function openEmailByRowId(messageId) {
    if (!/^\d+$/.test(messageId)) {
        throw new Error('Invalid message ID');
    }
    try {
        await openEmailByLookup({
            numericIdCandidates: [parseInt(messageId, 10)]
        });
    }
    catch (error) {
        if (error.message === 'Message not found') {
            throw error;
        }
        throw new Error('Failed to open message via AppleScript');
    }
}
async function runAppleScript(script) {
    // Embed script via temp file to avoid shell quoting issues with complex bodies
    const tmpFile = (0, node_path_1.join)((0, node_os_1.tmpdir)(), `mailclaw-${Date.now()}.applescript`);
    try {
        (0, node_fs_1.writeFileSync)(tmpFile, script, 'utf8');
        const { stdout } = await execAsync(`osascript "${tmpFile}"`);
        return stdout.trim();
    }
    finally {
        try {
            (0, node_fs_1.unlinkSync)(tmpFile);
        }
        catch { }
    }
}
async function createDraft(options) {
    const toList = options.to.map(a => `make new to recipient of newMsg with properties {address:"${escapeAppleScriptString(a)}"}`).join('\n        ');
    const ccList = (options.cc ?? []).map(a => `make new cc recipient of newMsg with properties {address:"${escapeAppleScriptString(a)}"}`).join('\n        ');
    const bccList = (options.bcc ?? []).map(a => `make new bcc recipient of newMsg with properties {address:"${escapeAppleScriptString(a)}"}`).join('\n        ');
    const fromLine = options.from ? `set sender of newMsg to "${escapeAppleScriptString(options.from)}"` : '';
    const script = `
tell application "Mail"
  try
    set newMsg to make new outgoing message with properties {subject:"${escapeAppleScriptString(options.subject)}", content:"${escapeAppleScriptString(options.body)}", visible:false}
    ${fromLine}
    ${toList}
    ${ccList}
    ${bccList}
    return subject of newMsg
  on error errMsg number errNum
    return "${SCRIPT_ERROR_SENTINEL}" & errNum & ":" & errMsg
  end try
end tell`;
    const output = await runAppleScript(script);
    if (output.startsWith(SCRIPT_ERROR_SENTINEL)) {
        throw new Error(`AppleScript error: ${output.replace(SCRIPT_ERROR_SENTINEL, '')}`);
    }
    return { subject: output };
}
async function deleteEmailByLookup(context) {
    const normalized = normalizeLookupContext(context);
    const mailboxHintsList = toAppleScriptStringList(normalized.mailboxHints);
    const messageIdCandidatesList = toAppleScriptStringList(normalized.messageIdCandidates);
    const numericIdCandidatesList = toAppleScriptNumberList(normalized.numericIdCandidates);
    const script = `
tell application "Mail"
  try
    set foundMsg to missing value
    set mailboxRefs to {}
    set hintedMailboxRefs to {}
    set mailboxHints to ${mailboxHintsList}
    set messageIdCandidates to ${messageIdCandidatesList}
    set numericIdCandidates to ${numericIdCandidatesList}

    repeat with accountRef in every account
      try
        repeat with accountMailbox in every mailbox of accountRef
          set end of mailboxRefs to accountMailbox
        end repeat
      end try
    end repeat

    if (count of mailboxHints) > 0 then
      repeat with mailboxRef in mailboxRefs
        set mailboxLabel to ""
        try
          set mailboxLabel to (name of mailboxRef as text)
        end try
        repeat with hintRef in mailboxHints
          if mailboxLabel contains (hintRef as text) then
            set end of hintedMailboxRefs to mailboxRef
            exit repeat
          end if
        end repeat
      end repeat
    end if

    if (count of hintedMailboxRefs) > 0 then
      set mailboxRefs to hintedMailboxRefs
    end if

    repeat with candidateId in messageIdCandidates
      repeat with mailboxRef in mailboxRefs
        try
          set foundMsg to first message of mailboxRef whose message id is (candidateId as text)
          exit repeat
        end try
        try
          set foundMsg to first message of mailboxRef whose message id is "<" & (candidateId as text) & ">"
          exit repeat
        end try
      end repeat
      if foundMsg is not missing value then exit repeat
    end repeat

    if foundMsg is missing value then
      repeat with candidateNumeric in numericIdCandidates
        repeat with mailboxRef in mailboxRefs
          try
            set foundMsg to first message of mailboxRef whose id is candidateNumeric
            exit repeat
          end try
        end repeat
        if foundMsg is not missing value then exit repeat
      end repeat
    end if

    if foundMsg is missing value then
      return "${NOT_FOUND_SENTINEL}"
    end if

    delete foundMsg
    return "OK"
  on error errMsg number errNum
    return "${SCRIPT_ERROR_SENTINEL}" & errNum & ":" & errMsg
  end try
end tell`;
    const output = await runAppleScript(script);
    if (output === NOT_FOUND_SENTINEL)
        throw new Error('Message not found');
    if (output.startsWith(SCRIPT_ERROR_SENTINEL)) {
        throw new Error(`AppleScript error: ${output.replace(SCRIPT_ERROR_SENTINEL, '')}`);
    }
}
async function replyToEmail(context, body, replyAll) {
    const normalized = normalizeLookupContext(context);
    const mailboxHintsList = toAppleScriptStringList(normalized.mailboxHints);
    const messageIdCandidatesList = toAppleScriptStringList(normalized.messageIdCandidates);
    const numericIdCandidatesList = toAppleScriptNumberList(normalized.numericIdCandidates);
    const replyAllFlag = replyAll ? 'true' : 'false';
    const script = `
tell application "Mail"
  try
    set foundMsg to missing value
    set mailboxRefs to {}
    set mailboxHints to ${mailboxHintsList}
    set messageIdCandidates to ${messageIdCandidatesList}
    set numericIdCandidates to ${numericIdCandidatesList}

    repeat with accountRef in every account
      try
        repeat with accountMailbox in every mailbox of accountRef
          set end of mailboxRefs to accountMailbox
        end repeat
      end try
    end repeat

    repeat with candidateId in messageIdCandidates
      repeat with mailboxRef in mailboxRefs
        try
          set foundMsg to first message of mailboxRef whose message id is (candidateId as text)
          exit repeat
        end try
      end repeat
      if foundMsg is not missing value then exit repeat
    end repeat

    if foundMsg is missing value then
      repeat with candidateNumeric in numericIdCandidates
        repeat with mailboxRef in mailboxRefs
          try
            set foundMsg to first message of mailboxRef whose id is candidateNumeric
            exit repeat
          end try
        end repeat
        if foundMsg is not missing value then exit repeat
      end repeat
    end if

    if foundMsg is missing value then
      return "${NOT_FOUND_SENTINEL}"
    end if

    set replyMsg to reply foundMsg reply to all ${replyAllFlag}
    set content of replyMsg to "${escapeAppleScriptString(body)}" & return & return & (content of replyMsg)
    return subject of replyMsg
  on error errMsg number errNum
    return "${SCRIPT_ERROR_SENTINEL}" & errNum & ":" & errMsg
  end try
end tell`;
    const output = await runAppleScript(script);
    if (output === NOT_FOUND_SENTINEL)
        throw new Error('Message not found');
    if (output.startsWith(SCRIPT_ERROR_SENTINEL)) {
        throw new Error(`AppleScript error: ${output.replace(SCRIPT_ERROR_SENTINEL, '')}`);
    }
    return { subject: output };
}
async function listAccounts() {
    const script = `
tell application "Mail"
  set acctList to {}
  repeat with acct in every account
    try
      set acctName to name of acct
      set acctEmails to email addresses of acct
      set acctEmail to item 1 of acctEmails
      set end of acctList to acctName & "|" & acctEmail
    end try
  end repeat
  set output to ""
  repeat with entry in acctList
    set output to output & (entry as text) & linefeed
  end repeat
  return output
end tell`;
    const output = await runAppleScript(script);
    if (output.startsWith(SCRIPT_ERROR_SENTINEL)) {
        throw new Error(`AppleScript error: ${output.replace(SCRIPT_ERROR_SENTINEL, '')}`);
    }
    return output
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
        const [name, ...rest] = line.split('|');
        return { name: name?.trim() ?? '', email: rest.join('|').trim() };
    });
}
async function scheduleDraft(options) {
    // Create the draft first
    await createDraft(options);
    const label = `com.mailclaw.scheduled.${Date.now()}`;
    const plistPath = (0, node_path_1.join)((0, node_os_1.homedir)(), 'Library', 'LaunchAgents', `${label}.plist`);
    const scriptPath = (0, node_path_1.join)((0, node_os_1.homedir)(), 'Library', 'LaunchAgents', `${label}.sh`);
    const escapedSubject = options.subject.replace(/'/g, "'\\''");
    // Shell script: send draft by subject match, then self-clean
    const sendScript = `#!/bin/bash
set -e

osascript << 'APPLESCRIPT'
tell application "Mail"
  set draftMailboxes to {}
  repeat with acct in every account
    try
      set end of draftMailboxes to mailbox "Drafts" of acct
    end try
  end repeat
  try
    set end of draftMailboxes to mailbox "Drafts"
  end try
  set targetSubject to "${escapedSubject}"
  set sent to false
  repeat with draftBox in draftMailboxes
    repeat with msg in (get every message of draftBox)
      if subject of msg is targetSubject then
        send msg
        set sent to true
        exit repeat
      end if
    end repeat
    if sent then exit repeat
  end repeat
end tell
APPLESCRIPT

# Self-cleanup
launchctl unload "${plistPath}" 2>/dev/null || true
rm -f "${plistPath}"
rm -f "${scriptPath}"
`;
    const d = options.sendAt;
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${scriptPath}</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Month</key>
    <integer>${d.getMonth() + 1}</integer>
    <key>Day</key>
    <integer>${d.getDate()}</integer>
    <key>Hour</key>
    <integer>${d.getHours()}</integer>
    <key>Minute</key>
    <integer>${d.getMinutes()}</integer>
  </dict>
  <key>RunAtLoad</key>
  <false/>
  <key>StandardOutPath</key>
  <string>/tmp/${label}.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/${label}.err</string>
</dict>
</plist>`;
    (0, node_fs_1.writeFileSync)(scriptPath, sendScript, 'utf8');
    (0, node_fs_1.chmodSync)(scriptPath, 0o755);
    (0, node_fs_1.writeFileSync)(plistPath, plist, 'utf8');
    await execAsync(`launchctl load "${plistPath}"`);
    return { label, sendAt: options.sendAt };
}
