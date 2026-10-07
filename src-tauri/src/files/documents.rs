use super::{
    browsing::{CHUNK, TEXT_LIMIT},
    join,
    model::Document,
    sftp_error, Files,
};
use crate::error::{AppError, AppResult};
use russh_sftp::protocol::{FileAttributes, OpenFlags};
use uuid::Uuid;

impl Files {
    pub async fn save_document(
        &self,
        document: Document,
        original: &str,
        overwrite: bool,
    ) -> AppResult<Document> {
        self.check_owner(&document.owner)?;
        let _saving = self.saving.lock().await;
        if document.content.len() > TEXT_LIMIT || document.content.contains('\0') {
            return Err(AppError::invalid(
                "L’édition est limitée aux fichiers texte UTF-8 de 5 Mo",
            ));
        }
        if !self.replace_supported {
            return Err(AppError::new("file_unsafe_save", "Ce serveur ne permet pas la sauvegarde par remplacement sûr. Vos modifications sont conservées"));
        }
        let current = self.read_document(&document.path).await?;
        if current.resolved_path != document.resolved_path {
            return Err(AppError::new(
                "file_target_changed",
                "La cible du lien a changé. Rechargez le document",
            ));
        }
        if current.content != original && !overwrite {
            // A previous reply can be lost after a successful replacement.
            if current.content == document.content {
                return Ok(current);
            }
            return Err(AppError::new(
                "file_conflict",
                "Le fichier distant a été modifié. Rechargez-le ou confirmez son remplacement",
            ));
        }
        let (Some(mode), Some(uid), Some(gid)) = (current.permissions, current.uid, current.gid)
        else {
            return Err(AppError::new("file_metadata", "Le serveur ne fournit pas les permissions, le propriétaire et le groupe nécessaires à une sauvegarde protégée"));
        };
        let parent = document
            .resolved_path
            .rsplit_once('/')
            .map(|p| p.0)
            .unwrap_or(".");
        let temporary = join(parent, &format!(".via-{}.tmp", Uuid::new_v4()));
        let handle = self
            .raw
            .open(
                &temporary,
                OpenFlags::WRITE | OpenFlags::CREATE | OpenFlags::EXCLUDE,
                FileAttributes {
                    permissions: Some(0o600),
                    ..Default::default()
                },
            )
            .await
            .map_err(sftp_error)?
            .handle;
        let result = async {
            for (index, chunk) in document
                .content
                .as_bytes()
                .chunks(CHUNK as usize)
                .enumerate()
            {
                self.raw
                    .write(&handle, (index * CHUNK as usize) as u64, chunk.to_vec())
                    .await
                    .map_err(sftp_error)?;
            }
            self.raw.close(&handle).await.map_err(sftp_error)?;
            let attrs = FileAttributes {
                permissions: Some(mode & 0o7777),
                uid: Some(uid),
                gid: Some(gid),
                ..Default::default()
            };
            self.raw
                .setstat(&temporary, attrs)
                .await
                .map_err(sftp_error)?;
            let verified = self.raw.stat(&temporary).await.map_err(sftp_error)?.attrs;
            if verified.permissions.map(|p| p & 0o7777) != Some(mode & 0o7777)
                || verified.uid != Some(uid)
                || verified.gid != Some(gid)
            {
                return Err(AppError::new(
                    "file_metadata",
                    "Impossible de conserver les permissions, le propriétaire et le groupe",
                ));
            }
            let latest = self.read_document(&document.path).await?;
            if latest.resolved_path != document.resolved_path {
                return Err(AppError::new(
                    "file_target_changed",
                    "La cible du lien a changé",
                ));
            }
            if latest.content != current.content
                || latest.permissions != current.permissions
                || latest.uid != current.uid
                || latest.gid != current.gid
            {
                return Err(AppError::new(
                    "file_conflict",
                    "Le fichier a changé pendant la sauvegarde",
                ));
            }
            self.replace(&temporary, &document.resolved_path).await?;
            Ok(Document {
                content: document.content,
                ..current
            })
        }
        .await;
        if let Err(error) = result {
            let _ = self.raw.close(handle).await;
            if self.raw.remove(&temporary).await.is_err() {
                return Err(AppError::new(
                    error.code,
                    format!(
                        "{} ; un fichier temporaire peut rester à {}",
                        error.message, temporary
                    ),
                ));
            }
            return Err(error);
        }
        result
    }
}
