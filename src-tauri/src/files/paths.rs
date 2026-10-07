//! Remote names follow POSIX: any byte but `/` and NUL. Local names must also be safe on the
//! platform that writes them, so a remote name can be listed yet refused for download.
use crate::error::{AppError, AppResult};

pub fn join(directory: &str, name: &str) -> String {
    format!("{}/{}", directory.trim_end_matches('/'), name)
}
pub fn remote_name(name: &str) -> AppResult<()> {
    if name.is_empty() || name == "." || name == ".." || name.contains(['/', '\0']) {
        Err(AppError::invalid(
            "Nom invalide : il ne peut pas être vide, « . », « .. » ni contenir « / »",
        ))
    } else {
        Ok(())
    }
}
pub fn local_name(name: &str) -> AppResult<()> {
    remote_name(name)?;
    if cfg!(windows) && !windows_name(name) {
        return Err(AppError::invalid(
            "Ce nom n’est pas un nom de fichier Windows valide",
        ));
    }
    Ok(())
}
fn windows_name(name: &str) -> bool {
    let stem = name.split('.').next().unwrap_or("").to_ascii_uppercase();
    let device = ["CON", "PRN", "AUX", "NUL"].contains(&stem.as_str())
        || (stem.len() == 4
            && (stem.starts_with("COM") || stem.starts_with("LPT"))
            && matches!(stem.as_bytes()[3], b'1'..=b'9'));
    !(device
        || name.contains(['\\', ':', '*', '?', '"', '<', '>', '|'])
        || name.ends_with(['.', ' ']))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn remote_names_accept_backslashes_but_never_separators() {
        assert!(remote_name("a\\b").is_ok());
        for name in ["", ".", "..", "a/b", "a\0b"] {
            assert!(remote_name(name).is_err(), "{name:?}");
        }
    }
    #[test]
    fn windows_names_refuse_separators_streams_and_devices() {
        for name in ["a\\b", "a:b", "CON", "com1.txt", "trailing."] {
            assert!(!windows_name(name), "{name:?}");
        }
        assert!(windows_name("notes.txt"));
    }
}
