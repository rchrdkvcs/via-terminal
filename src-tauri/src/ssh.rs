use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    process::Command,
};
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SshTarget {
    pub alias: String,
    pub host: Option<String>,
    pub user: Option<String>,
    pub port: Option<u16>,
    pub identity_file: Option<String>,
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum SshStatus {
    Connecting,
    Connected,
    Reconnecting,
    Disconnected,
    Failed,
    Closed,
}

/// The effective destination shown to the user before a connection is opened.
/// Values come from OpenSSH itself (`ssh -G`), so Include, Match and platform
/// specific configuration semantics remain owned by OpenSSH.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedSshTarget {
    pub destination: String,
    pub host: String,
    pub user: String,
    pub port: u16,
    pub identity_files: Vec<String>,
}

pub fn validate_destination(value: &str) -> Result<(), String> {
    if value.trim().is_empty() || value.starts_with('-') || value.contains('\0') {
        return Err("invalid SSH destination".into());
    }
    Ok(())
}

/// Resolve a destination with the installed OpenSSH client. Optional overrides
/// are passed as individual argv entries; no shell is involved.
pub fn resolve_with_openssh(
    executable: &str,
    destination: &str,
    user: Option<&str>,
    port: Option<u16>,
    identity_file: Option<&str>,
) -> Result<ResolvedSshTarget, String> {
    validate_destination(destination)?;
    let args = connection_args(destination, user, port, identity_file)?;
    let output = Command::new(executable)
        .arg("-G")
        .args(&args)
        .output()
        .map_err(|error| format!("OpenSSH is unavailable: {error}"))?;
    if !output.status.success() {
        return Err("OpenSSH could not resolve this destination".into());
    }
    parse_resolved_config(destination, &String::from_utf8_lossy(&output.stdout))
}

pub fn connection_args(
    destination: &str,
    user: Option<&str>,
    port: Option<u16>,
    identity_file: Option<&str>,
) -> Result<Vec<String>, String> {
    validate_destination(destination)?;
    let mut args = Vec::new();
    if let Some(user) = user.filter(|value| !value.trim().is_empty()) {
        if user.starts_with('-') || user.contains('\0') {
            return Err("invalid SSH username".into());
        }
        args.extend(["-l".into(), user.into()]);
    }
    if let Some(port) = port {
        if port == 0 {
            return Err("invalid SSH port".into());
        }
        args.extend(["-p".into(), port.to_string()]);
    }
    if let Some(file) = identity_file.filter(|value| !value.trim().is_empty()) {
        if file.contains('\0') {
            return Err("invalid identity file".into());
        }
        args.extend(["-i".into(), file.into()]);
    }
    args.push(destination.into());
    Ok(args)
}

fn parse_resolved_config(destination: &str, text: &str) -> Result<ResolvedSshTarget, String> {
    let mut host = None;
    let mut user = None;
    let mut port = None;
    let mut identity_files = Vec::new();
    for line in text.lines() {
        let Some((key, value)) = line.trim().split_once(char::is_whitespace) else {
            continue;
        };
        let value = value.trim();
        match key.to_ascii_lowercase().as_str() {
            "hostname" => host = Some(value.to_string()),
            "user" => user = Some(value.to_string()),
            "port" => port = value.parse().ok(),
            "identityfile" if value != "none" => identity_files.push(expand_home(value)),
            _ => {}
        }
    }
    Ok(ResolvedSshTarget {
        destination: destination.into(),
        host: host.ok_or("OpenSSH did not resolve a hostname")?,
        user: user.ok_or("OpenSSH did not resolve a user")?,
        port: port.ok_or("OpenSSH did not resolve a port")?,
        identity_files,
    })
}
#[derive(Debug, Clone)]
pub struct ReconnectPolicy {
    pub attempts: u8,
    pub delays_ms: Vec<u64>,
}
impl Default for ReconnectPolicy {
    fn default() -> Self {
        Self {
            attempts: 3,
            delays_ms: vec![1000, 2000, 5000],
        }
    }
}
impl ReconnectPolicy {
    pub fn delay(&self, attempt: u8) -> Option<u64> {
        if attempt >= self.attempts {
            None
        } else {
            self.delays_ms.get(attempt as usize).copied()
        }
    }
}

pub fn parse_config(text: &str) -> Vec<SshTarget> {
    let mut result = vec![];
    let mut current: Option<SshTarget> = None;
    for raw in text.lines() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let mut pair = line.splitn(2, char::is_whitespace);
        let key = pair.next().unwrap_or("").to_ascii_lowercase();
        let value = pair.next().unwrap_or("").trim();
        if key == "host" {
            if let Some(v) = current.take() {
                result.push(v)
            };
            if !value.contains('*') && !value.contains('?') {
                current = Some(SshTarget {
                    alias: value.into(),
                    ..Default::default()
                })
            }
        } else if let Some(target) = current.as_mut() {
            match key.as_str() {
                "hostname" => target.host = Some(value.into()),
                "user" => target.user = Some(value.into()),
                "port" => target.port = value.parse().ok(),
                "identityfile" => target.identity_file = Some(expand_home(value)),
                _ => {}
            }
        }
    }
    if let Some(v) = current {
        result.push(v)
    }
    result
}
pub fn load_config(path: &Path) -> Result<Vec<SshTarget>, String> {
    let text = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    let base = path.parent().unwrap_or(Path::new("."));
    let mut targets = parse_config(&text);
    for raw in text.lines() {
        let line = raw.trim();
        if line.to_ascii_lowercase().starts_with("include ") {
            let value = line
                .split_once(char::is_whitespace)
                .map(|p| p.1.trim())
                .unwrap_or("");
            let include = if Path::new(value).is_absolute() {
                PathBuf::from(value)
            } else {
                base.join(value)
            };
            if !value.contains('*') {
                if let Ok(mut more) = load_config(&include) {
                    targets.append(&mut more)
                }
            }
        }
    }
    Ok(targets)
}
pub fn as_map(targets: Vec<SshTarget>) -> HashMap<String, SshTarget> {
    targets.into_iter().map(|t| (t.alias.clone(), t)).collect()
}
fn expand_home(value: &str) -> String {
    if let Some(rest) = value.strip_prefix("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(rest).to_string_lossy().into_owned();
        }
    }
    value.into()
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn parses_common_options() {
        let items=parse_config("Host prod\n HostName 10.0.0.2\n User deploy\n Port 2222\n IdentityFile C:/keys/prod\n\nHost *\n User ignored");
        assert_eq!(
            items,
            vec![SshTarget {
                alias: "prod".into(),
                host: Some("10.0.0.2".into()),
                user: Some("deploy".into()),
                port: Some(2222),
                identity_file: Some("C:/keys/prod".into())
            }]
        )
    }
    #[test]
    fn reconnection_is_bounded() {
        let p = ReconnectPolicy::default();
        assert_eq!(p.delay(0), Some(1000));
        assert_eq!(p.delay(2), Some(5000));
        assert_eq!(p.delay(3), None)
    }
    #[test]
    fn connection_arguments_are_separate_and_ordered() {
        assert_eq!(
            connection_args("prod", Some("deploy"), Some(2222), Some("C:/key file")).unwrap(),
            vec!["-l", "deploy", "-p", "2222", "-i", "C:/key file", "prod"]
        );
        assert!(connection_args("-oProxyCommand=evil", None, None, None).is_err());
        assert!(connection_args("prod", Some("-oBad"), None, None).is_err());
    }
    #[test]
    fn parses_openssh_resolved_output() {
        let target = parse_resolved_config(
            "prod",
            "host prod\nhostname 10.0.0.2\nuser deploy\nport 2222\nidentityfile ~/.ssh/id_ed25519\n",
        ).unwrap();
        assert_eq!(target.host, "10.0.0.2");
        assert_eq!(target.user, "deploy");
        assert_eq!(target.port, 2222);
        assert_eq!(target.identity_files.len(), 1);
    }
}
