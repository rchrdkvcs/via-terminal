use super::*;
use std::path::Path;

impl DomainService {
    pub fn update_settings(&self, settings: Settings) -> Result<Settings, String> {
        if settings.default_shell.trim().is_empty() || settings.default_shell.contains('\0') {
            return Err("invalid default shell".into());
        }
        self.mutate(|d| {
            d.settings = settings.clone();
            let shell = d.settings.default_shell.clone();
            let label = crate::domain::shell_label(&shell);
            let default_ids: std::collections::HashSet<_> = d
                .workspaces
                .iter()
                .filter_map(|workspace| workspace.default_profile_id)
                .collect();
            for profile in &mut d.profiles {
                if default_ids.contains(&profile.id) {
                    profile.executable = shell.clone();
                    profile.name = label.clone();
                }
            }
            Ok(settings)
        })
    }
    pub fn save_window_state(&self, window: WindowState) -> Result<WindowState, String> {
        self.mutate(|data| {
            match data.windows.iter_mut().find(|item| item.id == window.id) {
                Some(existing) => *existing = window.clone(),
                None => data.windows.push(window.clone()),
            }
            Ok(window)
        })
    }
    pub fn begin_run(&self) -> Result<bool, String> {
        self.mutate(|data| {
            let recovery_available = !data.app_state.clean_shutdown;
            data.app_state.recovery_available = recovery_available;
            data.app_state.clean_shutdown = false;
            Ok(recovery_available)
        })
    }
    pub fn recovery_state(&self) -> Result<AppState, String> {
        Ok(self.snapshot()?.app_state)
    }
    pub fn finish_recovery(&self) -> Result<(), String> {
        self.mutate(|data| {
            data.app_state.recovery_available = false;
            Ok(())
        })
    }
    pub fn mark_clean_shutdown(&self) -> Result<(), String> {
        self.mutate(|data| {
            data.app_state.clean_shutdown = true;
            data.app_state.recovery_available = false;
            Ok(())
        })
    }
    pub fn export_json(&self) -> Result<String, String> {
        let mut portable = self.snapshot()?;
        portable.windows.clear();
        portable.app_state = AppState::default();
        serde_json::to_string_pretty(&portable).map_err(|e| e.to_string())
    }
    pub fn import_json(&self, json: &str) -> Result<AppData, String> {
        let mut incoming: AppData = serde_json::from_str(json).map_err(|e| e.to_string())?;
        incoming.validate()?;
        remap_ids(&mut incoming);
        incoming.validate()?;
        self.repo.lock().unwrap().save(&incoming)?;
        Ok(incoming)
    }
    pub fn export_file(&self, path: &Path) -> Result<(), String> {
        let tmp = path.with_extension("tmp");
        std::fs::write(&tmp, self.export_json()?).map_err(|e| e.to_string())?;
        std::fs::rename(tmp, path).map_err(|e| e.to_string())
    }
}
