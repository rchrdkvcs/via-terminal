//! Local shells installed on this machine. Only a detected executable may be
//! launched: the interface names a shell, it never supplies a path.

use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Shell {
    /// The executable, as launched.
    pub path: String,
    pub name: String,
    pub args: Vec<String>,
}

#[cfg(windows)]
const CANDIDATES: &[&str] = &[
    "pwsh.exe",
    "powershell.exe",
    "cmd.exe",
    r"C:\Program Files\Git\bin\bash.exe",
    "wsl.exe",
];
#[cfg(not(windows))]
const CANDIDATES: &[&str] = &["zsh", "bash", "fish", "sh", "nu", "pwsh"];

pub fn detect() -> Vec<Shell> {
    let mut shells: Vec<Shell> = Vec::new();
    for candidate in CANDIDATES {
        let Some(path) = locate(candidate) else {
            continue;
        };
        let path = path.to_string_lossy().into_owned();
        if shells.iter().any(|shell| shell.path == path) {
            continue;
        }
        shells.push(Shell {
            name: label(&path),
            args: args(&path),
            path,
        });
    }
    shells
}

/// The user's login shell on Unix, PowerShell on Windows, else the first found.
pub fn default_path(shells: &[Shell]) -> Option<String> {
    let preferred = if cfg!(windows) {
        None
    } else {
        std::env::var("SHELL").ok()
    };
    preferred
        .filter(|path| shells.iter().any(|shell| &shell.path == path))
        .or_else(|| shells.first().map(|shell| shell.path.clone()))
}

fn locate(command: &str) -> Option<PathBuf> {
    let path = Path::new(command);
    if path.is_absolute() {
        return path.exists().then(|| path.to_path_buf());
    }
    std::env::split_paths(&std::env::var_os("PATH")?)
        .map(|dir| dir.join(command))
        .find(|candidate| candidate.is_file())
}

fn file_name(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(path)
        .to_ascii_lowercase()
}

fn label(path: &str) -> String {
    match file_name(path).trim_end_matches(".exe") {
        "pwsh" => "PowerShell 7",
        "powershell" => "Windows PowerShell",
        "cmd" => "Invite de commandes",
        "wsl" => "WSL",
        "bash" if cfg!(windows) => "Git Bash",
        "bash" => "Bash",
        "zsh" => "Zsh",
        "fish" => "Fish",
        "nu" => "Nushell",
        "sh" => "sh",
        other => return other.to_string(),
    }
    .to_string()
}

fn args(path: &str) -> Vec<String> {
    match file_name(path).as_str() {
        "pwsh.exe" | "powershell.exe" => vec!["-NoLogo".into()],
        "bash.exe" => vec!["--login".into(), "-i".into()],
        "zsh" | "bash" if cfg!(target_os = "macos") => vec!["-l".into()],
        _ => vec![],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn labels_and_args_follow_the_executable() {
        assert_eq!(label("C:/x/pwsh.exe"), "PowerShell 7");
        assert_eq!(args("C:/x/pwsh.exe"), vec!["-NoLogo".to_string()]);
        assert_eq!(label("/usr/bin/zsh"), "Zsh");
    }

    #[test]
    fn default_falls_back_to_first_detected() {
        let shells = vec![Shell {
            path: "/bin/a".into(),
            name: "a".into(),
            args: vec![],
        }];
        assert_eq!(default_path(&shells).as_deref(), Some("/bin/a"));
        assert_eq!(default_path(&[]), None);
    }
}
