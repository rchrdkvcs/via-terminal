# Remote document saves require safe replacement

- Status: accepted and implemented
- Date: 2026-10-07

Write remote document edits to an exclusive temporary file in the target's directory, preserve and verify Unix mode, owner and group, then replace the original through a supported atomic replacement mechanism. If replacement or these metadata guarantees are unavailable, refuse saving and retain the draft. This deliberately sacrifices editing on some servers and writable files to avoid truncating the original during a failed save; deleting the original before standard SFTP rename is not an acceptable fallback.

Editing through a symbolic link addresses its resolved target and verifies that target before saving, preserving the link. ACLs, extended attributes and hard-link relationships are outside the first version's preservation guarantees. A pre-save comparison detects prior remote edits but cannot lock out a writer between comparison and replacement. A lost replacement response requires verifying the remote contents after reconnecting rather than blindly retrying.

See [the design specification](../REMOTE-FILES.md) and [OpenSSH's replacement extension](https://raw.githubusercontent.com/openssh/openssh-portable/master/PROTOCOL).
