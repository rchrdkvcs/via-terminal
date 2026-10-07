use crate::error::{AppError, AppResult};
use serde::Serialize;
use std::path::{Path, PathBuf};
use ts_rs::TS;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Shell {
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

/// The only shells the interface may launch, plus the user's login shell.
pub struct DetectedShells {
    shells: Vec<Shell>,
    login: Option<String>,
}

impl DetectedShells {
    pub fn detect() -> Self {
        let login = if cfg!(windows) {
            None
        } else {
            std::env::var("SHELL").ok()
        };
        Self::new(detect(), login)
    }

    pub fn new(shells: Vec<Shell>, login: Option<String>) -> Self {
        Self { shells, login }
    }

    pub fn list(&self) -> &[Shell] {
        &self.shells
    }

    pub fn system_default(&self) -> Option<&Shell> {
        self.login
            .as_deref()
            .and_then(|path| self.find(path))
            .or_else(|| self.shells.first())
    }

    /// Picks the requested shell, else the configured default, else the system
    /// default, and refuses any path that was not detected.
    pub fn resolve(
        &self,
        requested: Option<String>,
        configured: Option<String>,
    ) -> AppResult<Shell> {
        let wanted = match requested.or(configured) {
            Some(path) => path,
            None => self
                .system_default()
                .ok_or_else(|| {
                    AppError::new("no_shell", "aucun shell n’a été trouvé sur cette machine")
                })?
                .path
                .clone(),
        };
        self.find(&wanted)
            .cloned()
            .ok_or_else(|| AppError::new("no_shell", "ce shell n’est pas installé"))
    }

    fn find(&self, path: &str) -> Option<&Shell> {
        self.shells.iter().find(|shell| shell.path == path)
    }
}

fn detect() -> Vec<Shell> {
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

    fn shell(path: &str) -> Shell {
        Shell {
            path: path.into(),
            name: label(path),
            args: vec![],
        }
    }

    fn detected(login: Option<&str>) -> DetectedShells {
        DetectedShells::new(
            vec![shell("/bin/zsh"), shell("/bin/bash"), shell("/bin/fish")],
            login.map(String::from),
        )
    }

    fn resolved(
        shells: &DetectedShells,
        requested: Option<&str>,
        configured: Option<&str>,
    ) -> String {
        shells
            .resolve(requested.map(String::from), configured.map(String::from))
            .unwrap()
            .path
    }

    #[test]
    fn refuses_a_path_that_was_not_detected() {
        let shells = detected(Some("/bin/bash"));
        for (requested, configured) in [
            (Some("/usr/bin/evil"), None),
            (Some("/usr/bin/evil"), Some("/bin/bash")),
            (None, Some("/usr/bin/evil")),
        ] {
            let error = shells
                .resolve(requested.map(String::from), configured.map(String::from))
                .unwrap_err();
            assert_eq!(error.code, "no_shell");
        }
    }

    #[test]
    fn prefers_requested_then_configured_then_login_then_first() {
        let shells = detected(Some("/bin/bash"));
        assert_eq!(
            resolved(&shells, Some("/bin/fish"), Some("/bin/zsh")),
            "/bin/fish"
        );
        assert_eq!(resolved(&shells, None, Some("/bin/fish")), "/bin/fish");
        assert_eq!(resolved(&shells, None, None), "/bin/bash");
        assert_eq!(
            resolved(&detected(Some("/opt/undetected")), None, None),
            "/bin/zsh"
        );
        assert_eq!(resolved(&detected(None), None, None), "/bin/zsh");
    }

    #[test]
    fn no_detected_shell_is_an_error() {
        let shells = DetectedShells::new(vec![], Some("/bin/zsh".into()));
        assert!(shells.system_default().is_none());
        assert_eq!(shells.resolve(None, None).unwrap_err().code, "no_shell");
        assert_eq!(
            shells
                .resolve(Some("/bin/zsh".into()), None)
                .unwrap_err()
                .code,
            "no_shell"
        );
    }
}
