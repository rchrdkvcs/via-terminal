use crate::{
    error::{AppError, AppResult},
    storage::Storage,
};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

const DOCUMENT: &str = "settings";

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Light,
    Dark,
    #[default]
    #[serde(other)]
    System,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CursorStyle {
    Block,
    Underline,
    #[default]
    #[serde(other)]
    Bar,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub theme: Theme,
    pub font_family: String,
    pub font_size: u16,
    pub line_height: f32,

    pub cursor_style: CursorStyle,
    pub cursor_blink: bool,
    pub scrollback: u32,
    pub copy_on_select: bool,

    pub default_shell: Option<String>,

    pub save_quick_connect: bool,

    pub confirm_close_running: bool,
    /// Check the public release endpoint once after startup.
    pub check_for_updates: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: Theme::System,
            font_family: String::new(),
            font_size: 14,
            line_height: 1.2,
            cursor_style: CursorStyle::Bar,
            cursor_blink: true,
            scrollback: 10_000,
            copy_on_select: false,
            default_shell: None,
            save_quick_connect: true,
            confirm_close_running: false,
            check_for_updates: true,
        }
    }
}

impl Settings {
    fn validate(&self) -> AppResult<()> {
        let valid = (8..=32).contains(&self.font_size)
            && (1.0..=2.0).contains(&self.line_height)
            && (100..=200_000).contains(&self.scrollback)
            && self.font_family.len() <= 200;
        if valid {
            Ok(())
        } else {
            Err(AppError::invalid("un réglage est hors des limites"))
        }
    }
}

pub struct SettingsStore {
    storage: Arc<Storage>,
    current: Mutex<Settings>,
}

impl SettingsStore {
    pub fn load(storage: Arc<Storage>) -> AppResult<Self> {
        let current = storage
            .load::<Settings>(DOCUMENT)
            .ok()
            .flatten()
            .filter(|settings| settings.validate().is_ok())
            .unwrap_or_default();
        Ok(Self {
            storage,
            current: Mutex::new(current),
        })
    }

    pub fn get(&self) -> Settings {
        self.current.lock().unwrap().clone()
    }

    pub fn save(&self, settings: Settings) -> AppResult<Settings> {
        settings.validate()?;
        self.storage.save(DOCUMENT, &settings)?;
        *self.current.lock().unwrap() = settings.clone();
        Ok(settings)
    }
}

#[cfg(test)]
mod tests {
    use super::{CursorStyle, Settings, Theme};

    #[test]
    fn unknown_appearance_values_fall_back_to_defaults() {
        let settings: Settings =
            serde_json::from_str(r#"{"theme":"sepia","cursorStyle":"beam","fontSize":16}"#)
                .unwrap();
        assert_eq!(
            (settings.theme, settings.cursor_style, settings.font_size),
            (Theme::System, CursorStyle::Bar, 16)
        );
        let dark: Settings = serde_json::from_str(r#"{"theme":"dark"}"#).unwrap();
        assert_eq!(
            serde_json::to_value(dark).unwrap()["theme"],
            serde_json::json!("dark")
        );
    }
}
