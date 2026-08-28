use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
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
}
