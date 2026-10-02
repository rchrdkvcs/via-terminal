//! Shell integration: each shell reports its working directory at every
//! prompt with OSC 7 (`ESC ] 7 ; file://host/path BEL`), so a tab can reopen
//! where it was. The user's own configuration always loads first and keeps
//! working; Via only adds a hook after it.

use super::shells::Shell;
use portable_pty::CommandBuilder;
use std::path::{Path, PathBuf};

const BASH_HOOK: &str = r#"printf '\033]7;file://localhost%s\007' "$PWD""#;

/// One line: a multi-line argument is fragile on a Windows command line.
const POWERSHELL_HOOK: &str = r#"$global:__viaPrompt = $function:prompt; function global:prompt { $l = $executionContext.SessionState.Path.CurrentLocation; $r = ''; if ($l.Provider.Name -eq 'FileSystem') { $r = "$([char]27)]7;file://localhost/$($l.ProviderPath -replace '\\', '/')$([char]7)" }; $r + (& $global:__viaPrompt) }"#;

/// `$E]7;...$E\` in cmd's PROMPT syntax, then the usual `C:\path>`.
const CMD_PROMPT: &str = r"$E]7;file://localhost/$P$E\$P$G";

const ZSH_SOURCE: &str = r#"if [[ -f "$VIA_USER_ZDOTDIR/FILE" ]]; then
  __via_zdotdir=$ZDOTDIR; ZDOTDIR=$VIA_USER_ZDOTDIR
  . "$ZDOTDIR/FILE"
  VIA_USER_ZDOTDIR=$ZDOTDIR; ZDOTDIR=$__via_zdotdir
fi
"#;

const ZSH_RC: &str = r#"ZDOTDIR=$VIA_USER_ZDOTDIR
[[ -f "$ZDOTDIR/.zshrc" ]] && . "$ZDOTDIR/.zshrc"
__via_cwd() { printf '\e]7;file://localhost%s\a' "$PWD" }
precmd_functions+=(__via_cwd)
"#;

fn name(shell: &Shell) -> String {
    Path::new(&shell.path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default()
        .trim_end_matches(".exe")
        .to_ascii_lowercase()
}

/// Add the hook for `shell` to `command`. Unknown shells run untouched.
pub fn apply(shell: &Shell, command: &mut CommandBuilder) {
    match name(shell).as_str() {
        "bash" => {
            let existing = std::env::var("PROMPT_COMMAND").unwrap_or_default();
            let hook = if existing.is_empty() {
                BASH_HOOK.to_string()
            } else {
                format!("{BASH_HOOK}; {existing}")
            };
            command.env("PROMPT_COMMAND", hook);
            // Git Bash's profile jumps to $HOME unless told it was opened in place.
            command.env("CHERE_INVOKING", "1");
        }
        "pwsh" | "powershell" => {
            command.args(["-NoExit", "-Command", POWERSHELL_HOOK]);
        }
        "cmd" => {
            command.env("PROMPT", CMD_PROMPT);
        }
        "zsh" => {
            if let Some(dir) = zsh_dir() {
                let user = std::env::var("ZDOTDIR")
                    .ok()
                    .or_else(|| dirs::home_dir().map(|home| home.to_string_lossy().into_owned()))
                    .unwrap_or_default();
                command.env("VIA_USER_ZDOTDIR", user);
                command.env("ZDOTDIR", dir);
            }
        }
        _ => {}
    }
}

/// A private ZDOTDIR whose files load the user's own, then add the hook.
fn zsh_dir() -> Option<PathBuf> {
    let dir = std::env::temp_dir()
        .join("via-shell-integration")
        .join("zsh");
    std::fs::create_dir_all(&dir).ok()?;
    for file in [".zshenv", ".zprofile", ".zlogin"] {
        std::fs::write(dir.join(file), ZSH_SOURCE.replace("FILE", file)).ok()?;
    }
    std::fs::write(dir.join(".zshrc"), ZSH_RC).ok()?;
    Some(dir)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn shell(path: &str) -> Shell {
        Shell {
            path: path.into(),
            name: String::new(),
            args: vec![],
        }
    }

    #[test]
    fn recognizes_shells_by_executable() {
        assert_eq!(name(&shell(r"C:\Program Files\Git\bin\bash.exe")), "bash");
        assert_eq!(name(&shell("/usr/bin/zsh")), "zsh");
        assert_eq!(name(&shell("pwsh.exe")), "pwsh");
    }

    #[test]
    fn zsh_files_load_the_user_configuration_first() {
        let dir = zsh_dir().unwrap();
        let rc = std::fs::read_to_string(dir.join(".zshrc")).unwrap();
        assert!(rc.find(".zshrc\" ]] && .").unwrap() < rc.find("precmd_functions").unwrap());
        let env = std::fs::read_to_string(dir.join(".zshenv")).unwrap();
        assert!(env.contains("$VIA_USER_ZDOTDIR/.zshenv"));
    }
}
