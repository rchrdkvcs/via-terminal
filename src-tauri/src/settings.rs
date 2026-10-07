use crate::{
    error::{AppError, AppResult},
    storage::Storage,
};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

const DOCUMENT: &str = "settings";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub theme: String,
    pub font_family: String,
    pub font_size: u16,
    pub line_height: f32,

    pub cursor_style: String,
    pub cursor_blink: bool,
    pub scrollback: u32,
    pub copy_on_select: bool,

    pub default_shell: Option<String>,

    pub save_quick_connect: bool,

    pub confirm_close_running: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: "system".into(),
            font_family: String::new(),
            font_size: 14,
            line_height: 1.2,
            cursor_style: "bar".into(),
            cursor_blink: true,
            scrollback: 10_000,
            copy_on_select: false,
            default_shell: None,
            save_quick_connect: true,
            confirm_close_running: false,
        }
    }
}

impl Settings {
    fn validate(&self) -> AppResult<()> {
        let valid = ["system", "light", "dark"].contains(&self.theme.as_str())
            && ["block", "bar", "underline"].contains(&self.cursor_style.as_str())
            && (8..=32).contains(&self.font_size)
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
