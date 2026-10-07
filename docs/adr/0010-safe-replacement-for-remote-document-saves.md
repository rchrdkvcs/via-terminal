# Remote document saves require safe replacement

- Status: accepted and implemented
- Date: 2026-10-07

Write remote document edits to an exclusive temporary file in the target's directory, preserve and verify Unix mode, owner and group, then replace the original through a supported atomic replacement mechanism. If replacement or these metadata guarantees are unavailable, refuse saving and retain the draft. This deliberately sacrifices editing on some servers and writable files to avoid truncating the original during a failed save; deleting the original before standard SFTP rename is not an acceptable fallback.

Editing through a symbolic link addresses its resolved target and verifies that target before saving, preserving the link. ACLs, extended attributes and hard-link relationships are outside the first version's preservation guarantees. A pre-save comparison detects prior remote edits but cannot lock out a writer between comparison and replacement. A lost replacement response requires verifying the remote contents after reconnecting rather than blindly retrying.

Uploads that replace an existing file use the same temporary file and replacement, and refuse replacement without it. They keep the destination's permission bits but not setuid, setgid or sticky, since the content and possibly the owner change; new files selected with the native picker keep local bits without group or other write, so scripts stay executable without widening access. Web drag-and-drop exposes no original Unix mode: new staged files use ordinary staging permissions and lose executable bits. Executable scripts should use the native picker or explicit remote chmod after dropping.

See [the design specification](../REMOTE-FILES.md) and [OpenSSH's replacement extension](https://raw.githubusercontent.com/openssh/openssh-portable/master/PROTOCOL).
