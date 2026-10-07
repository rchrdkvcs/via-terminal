# The remote explorer belongs to its SSH tab

- Status: accepted and implemented
- Date: 2026-10-07

Each SSH tab owns its remote explorer, documents and transfers. Open SFTP lazily as an additional channel on that tab's authenticated SSH connection, using the existing vault and host-key verification. This keeps the displayed files bound to the terminal's target and avoids a separate authentication and connection lifecycle.

Opening SFTP never pauses reading the shell: a saturated shell channel would otherwise block the whole SSH connection, including the SFTP channel confirmation.

The explorer can expand within the content area; expansion and hiding never end the terminal session. Ending the shell or closing its tab ends SFTP and cancels transfers. Unsaved documents survive connection loss in memory, independently of the replaced session identifier, and must be checked against the remote file after reconnecting. An independent file-tab model or shared connection pool would require different ownership and shutdown rules and is outside this design.

See [the design specification](../REMOTE-FILES.md).
